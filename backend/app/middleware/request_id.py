import uuid

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Assign a correlation ID to each request and surface it in logs + response headers.

    - Reads X-Request-ID from the request if present; otherwise generates a UUID4 hex.
    - Binds it into the loguru context so every log line emitted while handling the
      request carries a `request_id` extra field.
    - Echoes the ID on the response's X-Request-ID header so clients can correlate.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        with logger.contextualize(request_id=rid):
            response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response
