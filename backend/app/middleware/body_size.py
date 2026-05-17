"""Cap request body size at the middleware layer.

FastAPI / Starlette have no built-in body-size ceiling. Without this
middleware, a single curl with ``--data @1gb.json`` will OOM a worker
before any route handler runs. The CSV import endpoint enforces its
own 5 MB cap on the read bytes, but every other POST endpoint accepts
unbounded JSON.

Strategy: check ``Content-Length`` upfront and 413 immediately when
declared size exceeds the cap. For chunked uploads (no
``Content-Length``) we wrap the receive callable and abort if the
running total crosses the cap mid-stream.

Implementation note: this is a **pure ASGI** middleware, not a
``BaseHTTPMiddleware`` subclass. The latter wraps downstream calls in
its own anyio task group, which swallows exceptions raised inside
``receive`` and turns them into 500s instead of the 413 we want.
Talking ASGI directly lets us send the 413 response cleanly and
short-circuit the route.

Caveat: a malicious client can lie about ``Content-Length`` to
under-declare. The streaming check catches that too — it counts actual
bytes received.
"""

from __future__ import annotations

import json

from loguru import logger


class BodySizeLimitMiddleware:
    """Reject requests whose body exceeds ``max_bytes``.

    Exemptions: GET / HEAD / DELETE / OPTIONS have no body to count.
    A small set of routes (CSV imports) gets a higher per-path cap;
    add to ``_ROUTE_OVERRIDES`` if you need more.
    """

    _ROUTE_OVERRIDES: dict[str, int] = {
        "/api/transactions/import/preview": 5 * 1024 * 1024,
        "/api/transactions/import/confirm": 5 * 1024 * 1024,
    }

    _EXEMPT_METHODS = frozenset({"GET", "HEAD", "DELETE", "OPTIONS"})

    def __init__(self, app, max_bytes: int):
        self.app = app
        self.max_bytes = max_bytes

    def _cap_for(self, path: str) -> int:
        # Exact-match override; trailing slash variants get the
        # default cap. Pad the override set if a route ever ships
        # both forms.
        return self._ROUTE_OVERRIDES.get(path.rstrip("/"), self.max_bytes)

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "")
        if method in self._EXEMPT_METHODS:
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        cap = self._cap_for(path)

        # Upfront Content-Length check — cheapest path, catches honest
        # clients before we touch the body at all.
        for header, value in scope.get("headers", []):
            if header == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = 0
                if declared > cap:
                    await _send_413(send, declared, cap)
                    return
                break

        # Streaming check — wrap receive so we count actual bytes as
        # they arrive, and 413 the moment we cross the cap.
        received_so_far = 0
        cap_exceeded = False

        async def capped_receive():
            nonlocal received_so_far, cap_exceeded
            message = await receive()
            if message["type"] == "http.request":
                received_so_far += len(message.get("body", b""))
                if received_so_far > cap and not cap_exceeded:
                    cap_exceeded = True
                    logger.warning(
                        "Body size cap exceeded on {path}: {actual} > {cap}",
                        path=path,
                        actual=received_so_far,
                        cap=cap,
                    )
                    # Signal end-of-stream to the downstream app so its
                    # body-parse fails fast rather than waiting for more
                    # bytes. The app will still run; we replace its
                    # response below.
                    return {"type": "http.request", "body": b"", "more_body": False}
            return message

        # Capture the downstream response so we can replace it with a
        # 413 if the cap was exceeded mid-stream. If everything is fine,
        # we forward the captured response unchanged.
        response_started = False
        response_status = 200
        response_headers: list = []
        response_body_chunks: list[bytes] = []

        async def buffering_send(message):
            nonlocal response_started, response_status, response_headers
            if cap_exceeded:
                # Drop downstream sends — we'll emit our own 413 after
                # the app returns.
                return
            if message["type"] == "http.response.start":
                response_started = True
                response_status = message["status"]
                response_headers = message.get("headers", [])
            await send(message)

        try:
            await self.app(scope, capped_receive, buffering_send)
        finally:
            if cap_exceeded and not response_started:
                await _send_413(send, received_so_far, cap)


async def _send_413(send, actual: int, cap: int) -> None:
    body = json.dumps(
        {
            "detail": "Request body too large.",
            "max_bytes": cap,
            "received_bytes": actual,
        }
    ).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body, "more_body": False})
