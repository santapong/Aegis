"""Rate limiter.

Two backends share the same middleware:

- **InMemory** — per-process dict. Default. Doesn't share state across
  uvicorn workers, so a user actually gets ``workers × limit`` requests
  per minute. Fine for dev and tiny single-pod prod.
- **Redis** — uses ``redis.Redis`` with INCR + EXPIRE to count hits in
  fixed 60 s windows. Shared across every worker and replica that
  points at the same Redis. Required for any horizontal scale.

Backend selection happens at app startup based on
``CACHE_BACKEND`` / ``CACHE_REDIS_URL`` — we deliberately reuse the
same Redis as the cache layer rather than introducing a second
connection. If Redis is unreachable, the middleware falls back to the
in-memory limiter and logs a warning rather than rejecting traffic.

Trusted-proxy handling: ``X-Forwarded-For`` is honored only when
``RATE_LIMIT_TRUST_FORWARDED_FOR=true``. Without that, every request
gets bucketed by the immediate-client IP, which behind a load balancer
means every user shares one bucket. The setting exists so operators
can opt in once they've verified their proxy chain strips spoofed
headers.
"""

from __future__ import annotations

import time
from collections import defaultdict

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from ..config import get_settings


class _InMemoryLimiter:
    """Per-process sliding window. State lost on restart."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)

    def hit(self, key: str, limit: int, window: float = 60.0) -> bool:
        """Returns True if the request is allowed, False if rate-limited."""
        now = time.time()
        bucket = [t for t in self._hits[key] if now - t < window]
        if len(bucket) >= limit:
            self._hits[key] = bucket
            return False
        bucket.append(now)
        self._hits[key] = bucket

        # Garbage-collect stale buckets occasionally to bound memory.
        if sum(len(v) for v in self._hits.values()) > 10000:
            stale = [k for k, v in self._hits.items() if not v or now - v[-1] > window]
            for k in stale:
                self._hits.pop(k, None)
        return True


class _RedisLimiter:
    """Fixed-window counter per (key, minute-bucket) in Redis.

    Trade-off vs sliding-window: fixed windows allow burst-at-boundary
    (up to 2× the limit in a 1-second window straddling minute roll).
    Acceptable for the protection levels we set (100/min general,
    20/min strict).
    """

    def __init__(self, client) -> None:
        self._client = client

    def hit(self, key: str, limit: int, window: float = 60.0) -> bool:
        # Bucket name embeds the minute so adjacent windows live in
        # separate keys; the EXPIRE means we never garbage-collect
        # manually.
        bucket_id = int(time.time() // window)
        full_key = f"rl:{key}:{bucket_id}"
        try:
            count = self._client.incr(full_key)
            if count == 1:
                # Set TTL slightly longer than the window so straggling
                # requests right at the boundary still find a counter.
                self._client.expire(full_key, int(window) + 5)
            return count <= limit
        except Exception as exc:  # noqa: BLE001
            # Fail open — a Redis blip shouldn't lock everyone out.
            logger.warning("Rate limiter Redis call failed: {err}", err=exc)
            return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-client-IP rate limiter with strict-prefix overrides."""

    _strict_prefixes = (
        "/api/ai/",
        "/api/transactions/import/",
        "/api/payments/",
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/google",
    )
    _strict_limit = 20

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self._settings = get_settings()
        self._limiter = self._build_limiter()

    def _build_limiter(self):
        """Pick Redis if configured + reachable, else in-memory."""
        backend = (self._settings.cache_backend or "memory").lower()
        if backend == "redis" and self._settings.cache_redis_url:
            try:
                import redis

                client = redis.Redis.from_url(
                    self._settings.cache_redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                # Ping once to verify reachability — if Redis is down at
                # boot, fail back to in-memory rather than 503-ing every
                # request.
                client.ping()
                logger.info("Rate limiter: redis backend")
                return _RedisLimiter(client)
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Rate limiter could not reach Redis ({err}); falling "
                    "back to in-memory limiter — shared limit across "
                    "workers will NOT be enforced.",
                    err=exc,
                )
        return _InMemoryLimiter()

    def _client_id(self, request: Request) -> str:
        """Identify the caller for bucketing.

        Behind a trusted proxy (Vercel, Cloudflare, ALB), set
        ``RATE_LIMIT_TRUST_FORWARDED_FOR=true`` so the real client IP is
        used. Without that flag, X-Forwarded-For is ignored and every
        request bucketed by the proxy IP — safe default but pointless
        rate limiting in a managed deploy. Operators opt in once they've
        verified their proxy strips inbound XFF headers.
        """
        if self._settings.rate_limit_trust_forwarded_for:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        client_id = self._client_id(request)

        is_strict = any(path.startswith(p) for p in self._strict_prefixes)
        limit = self._strict_limit if is_strict else self.requests_per_minute
        # Strict endpoints get a path-scoped bucket so a login flood
        # doesn't blow the user's general allowance.
        key = f"{client_id}:{path}" if is_strict else client_id

        if not self._limiter.hit(key, limit):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": "60"},
            )

        return await call_next(request)
