import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter per client IP."""

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self._hits: dict[str, list[float]] = defaultdict(list)

        # Stricter limits for sensitive endpoints
        self._strict_prefixes = ("/api/ai/", "/api/transactions/import/", "/api/payments/")
        self._strict_limit = 20  # per minute

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _clean_old_hits(self, hits: list[float], window: float = 60.0) -> list[float]:
        now = time.time()
        return [t for t in hits if now - t < window]

    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        path = request.url.path
        now = time.time()

        # Determine limit based on path
        is_strict = any(path.startswith(p) for p in self._strict_prefixes)
        limit = self._strict_limit if is_strict else self.requests_per_minute

        # Use path-specific key for strict endpoints
        key = f"{client_ip}:{path}" if is_strict else client_ip

        # Clean old entries and check
        self._hits[key] = self._clean_old_hits(self._hits[key])

        if len(self._hits[key]) >= limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": "60"},
            )

        self._hits[key].append(now)

        # Periodic cleanup of stale keys (every ~1000 requests)
        if sum(len(v) for v in self._hits.values()) > 10000:
            stale_keys = [k for k, v in self._hits.items() if not self._clean_old_hits(v)]
            for k in stale_keys:
                del self._hits[k]

        return await call_next(request)
