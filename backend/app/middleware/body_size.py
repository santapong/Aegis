"""Cap request body size at the middleware layer.

FastAPI / Starlette have no built-in body-size ceiling. Without this
middleware, a single curl with ``--data @1gb.json`` will OOM a worker
before any route handler runs. The CSV import endpoint enforces its
own 5 MB cap on the read bytes, but every other POST endpoint accepts
unbounded JSON.

Strategy: check ``Content-Length`` upfront and 413 immediately when
declared size exceeds the cap. For chunked uploads (no
``Content-Length``) we wrap the receive stream and abort if the
running total crosses the cap mid-stream.

Caveat: a malicious client can lie about ``Content-Length`` to
under-declare. The streaming check catches that too — it counts actual
bytes received.
"""

from __future__ import annotations

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests whose body exceeds ``max_bytes``.

    Exemptions: GET / HEAD / DELETE / OPTIONS have no body to count.
    The CSV import path has its own larger cap; we don't special-case
    it here because the import path's cap (5 MB) is below this
    middleware's default (5 MB) only by coincidence. Operators who
    raise either should think about both.
    """

    # Routes allowed to exceed the default cap, e.g. multi-MB CSV
    # uploads. Each gets a per-route override.
    _ROUTE_OVERRIDES: dict[str, int] = {
        "/api/transactions/import/preview": 5 * 1024 * 1024,
        "/api/transactions/import/confirm": 5 * 1024 * 1024,
    }

    def __init__(self, app, max_bytes: int):
        super().__init__(app)
        self.max_bytes = max_bytes

    def _cap_for(self, path: str) -> int:
        return self._ROUTE_OVERRIDES.get(path, self.max_bytes)

    async def dispatch(self, request: Request, call_next):
        if request.method in ("GET", "HEAD", "DELETE", "OPTIONS"):
            return await call_next(request)

        cap = self._cap_for(request.url.path)

        # Upfront Content-Length check — cheapest path, catches honest
        # clients immediately.
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                declared = int(content_length)
            except ValueError:
                declared = 0
            if declared > cap:
                return _too_large(declared, cap)

        # Streaming check — handles chunked transfers and Content-Length
        # liars. Wrap ``receive`` so we count actual bytes as they
        # arrive, and bail the moment we cross the cap.
        original_receive = request.receive
        received_so_far = 0

        async def counting_receive():
            nonlocal received_so_far
            message = await original_receive()
            if message["type"] == "http.request":
                received_so_far += len(message.get("body", b""))
                if received_so_far > cap:
                    # Raise to short-circuit the route. Starlette's
                    # exception handler will translate to 500 by default,
                    # so we log + raise a specific RuntimeError caught
                    # below.
                    raise _BodyTooLarge(received_so_far, cap)
            return message

        # Mutate the request's receive callable. Starlette allows this;
        # the typing is loose enough.
        request._receive = counting_receive  # type: ignore[attr-defined]

        try:
            return await call_next(request)
        except _BodyTooLarge as exc:
            logger.warning(
                "Body size cap exceeded on {path}: {actual} > {cap}",
                path=request.url.path,
                actual=exc.actual,
                cap=exc.cap,
            )
            return _too_large(exc.actual, exc.cap)


class _BodyTooLarge(Exception):
    def __init__(self, actual: int, cap: int) -> None:
        super().__init__(f"body {actual} > cap {cap}")
        self.actual = actual
        self.cap = cap


def _too_large(actual: int, cap: int) -> JSONResponse:
    return JSONResponse(
        status_code=413,
        content={
            "detail": "Request body too large.",
            "max_bytes": cap,
            "received_bytes": actual,
        },
    )
