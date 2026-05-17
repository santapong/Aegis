"""Application-level cache.

Sits between hot-path API routes and the database. The pluggable backend
lets the same code work in three deploys:

- **Memory** (default) — a per-process TTL dict. Good for dev and tiny
  single-pod deploys. Doesn't share state across uvicorn workers, so a
  Redis backend is strongly recommended in production.
- **Redis** — set ``CACHE_BACKEND=redis`` + ``CACHE_REDIS_URL`` to use a
  managed Redis (Upstash, ElastiCache, Memorystore, Redis Cloud) or a
  side-car. Survives restarts, shared across workers/replicas.
- **Disabled** — set ``CACHE_BACKEND=disabled`` to no-op every call.
  Useful for ruling out cache invalidation bugs during incident response.

The API is deliberately small: ``get``, ``set``, ``delete``,
``delete_prefix``. Values are JSON-serialized; complex types (datetime,
Decimal, Pydantic models) round-trip via ``pydantic_core.to_jsonable_python``.

**Cache keys** follow the convention ``<scope>:<entity>:<user_id>[:<args>]``
so a single user-scoped invalidation (``delete_prefix("dashboard:*:UID")``)
clears every cached read for that user without touching other users.
"""

from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from typing import Any

from loguru import logger
from pydantic_core import to_jsonable_python

from .config import get_settings


def _serialize(value: Any) -> str:
    """Convert any cacheable value (incl. pydantic models, datetime,
    Decimal) to a JSON string. ``to_jsonable_python`` is the same hook
    FastAPI uses internally, so anything FastAPI can return is cacheable."""
    return json.dumps(to_jsonable_python(value))


def _deserialize(raw: str | bytes | None) -> Any:
    if raw is None:
        return None
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


class CacheBackend(ABC):
    """Abstract cache backend. Sync API to match the rest of the codebase
    (FastAPI sync routes + SQLAlchemy sync sessions); async wrappers can
    be layered on later if endpoints migrate to async."""

    @abstractmethod
    def get(self, key: str) -> Any: ...

    @abstractmethod
    def set(self, key: str, value: Any, ttl: int | None = None) -> None: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def delete_prefix(self, prefix: str) -> int:
        """Delete every key starting with ``prefix``. Returns count deleted.

        On Redis this uses SCAN + DEL, not KEYS — safe to call on a hot
        cluster. On the in-memory backend it walks the dict.
        """


class NullCache(CacheBackend):
    """No-op backend. Every get returns None, every set is dropped.

    Useful when ``CACHE_BACKEND=disabled`` so we can rule out cache
    invalidation bugs during incident response without redeploying.
    """

    def get(self, key: str) -> Any:
        return None

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        return None

    def delete(self, key: str) -> None:
        return None

    def delete_prefix(self, prefix: str) -> int:
        return 0


class MemoryCache(CacheBackend):
    """Per-process TTL dict. Default backend.

    Caveats: state is lost on restart and not shared across uvicorn
    workers — a write that invalidates a key in worker A does NOT
    propagate to worker B, so worker B keeps serving stale data until
    its own TTL expires. For prod, use Redis.
    """

    def __init__(self) -> None:
        # value: (json_string, expires_at_unix_or_None)
        self._store: dict[str, tuple[str, float | None]] = {}

    def _expired(self, key: str) -> bool:
        entry = self._store.get(key)
        if entry is None:
            return True
        _, expires = entry
        if expires is not None and time.time() >= expires:
            self._store.pop(key, None)
            return True
        return False

    def get(self, key: str) -> Any:
        if self._expired(key):
            return None
        return _deserialize(self._store[key][0])

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        expires = time.time() + ttl if ttl else None
        self._store[key] = (_serialize(value), expires)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def delete_prefix(self, prefix: str) -> int:
        # Snapshot keys first — can't mutate during iteration.
        to_delete = [k for k in self._store if k.startswith(prefix)]
        for k in to_delete:
            self._store.pop(k, None)
        return len(to_delete)


class RedisCache(CacheBackend):
    """Redis-backed cache. Requires ``redis>=5.0`` and a reachable Redis.

    Uses the sync client (``redis.Redis``) so it composes with FastAPI's
    sync routes. Reads/writes are pipelined where it matters; pattern
    deletes use SCAN to avoid blocking the server on large key spaces.
    """

    def __init__(self, url: str) -> None:
        # Import lazily so the redis dep is only required when this
        # backend is actually selected.
        import redis  # type: ignore[import-not-found]

        self._client = redis.Redis.from_url(
            url,
            decode_responses=True,
            # Tight defaults — a slow Redis shouldn't pin a request.
            socket_connect_timeout=2,
            socket_timeout=2,
            retry_on_timeout=False,
            health_check_interval=30,
        )

    def get(self, key: str) -> Any:
        try:
            return _deserialize(self._client.get(key))
        except Exception as exc:  # noqa: BLE001
            # Never let a cache miss become a hard failure.
            logger.warning("Cache GET failed for {key}: {err}", key=key, err=exc)
            return None

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        try:
            if ttl:
                self._client.setex(key, ttl, _serialize(value))
            else:
                self._client.set(key, _serialize(value))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Cache SET failed for {key}: {err}", key=key, err=exc)

    def delete(self, key: str) -> None:
        try:
            self._client.delete(key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Cache DEL failed for {key}: {err}", key=key, err=exc)

    def delete_prefix(self, prefix: str) -> int:
        # SCAN + DEL — never use KEYS in prod, it's O(N) blocking.
        pattern = f"{prefix}*"
        deleted = 0
        try:
            for key in self._client.scan_iter(match=pattern, count=200):
                self._client.delete(key)
                deleted += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Cache prefix delete failed for {prefix}: {err}",
                prefix=prefix,
                err=exc,
            )
        return deleted


_cache_singleton: CacheBackend | None = None


def get_cache() -> CacheBackend:
    """Return the configured cache backend (created lazily, cached)."""
    global _cache_singleton
    if _cache_singleton is not None:
        return _cache_singleton

    settings = get_settings()
    backend = (settings.cache_backend or "memory").lower()

    if backend == "disabled":
        logger.info("Cache backend: disabled (NullCache)")
        _cache_singleton = NullCache()
    elif backend == "redis":
        if not settings.cache_redis_url:
            logger.warning(
                "CACHE_BACKEND=redis but CACHE_REDIS_URL is empty — falling "
                "back to in-memory cache. Set CACHE_REDIS_URL to enable Redis."
            )
            _cache_singleton = MemoryCache()
        else:
            try:
                _cache_singleton = RedisCache(settings.cache_redis_url)
                logger.info("Cache backend: redis ({url})", url=_redact(settings.cache_redis_url))
            except Exception as exc:  # noqa: BLE001
                # If Redis isn't reachable at startup, we don't want to
                # take the whole app down — fall back to in-memory and
                # log loudly.
                logger.error(
                    "Cache backend redis failed to initialize ({err}); "
                    "falling back to in-memory cache",
                    err=exc,
                )
                _cache_singleton = MemoryCache()
    else:
        logger.info("Cache backend: memory")
        _cache_singleton = MemoryCache()

    return _cache_singleton


def reset_cache_for_tests() -> None:
    """Test helper — drop the singleton so the next ``get_cache()`` call
    rebuilds against (potentially-changed) settings."""
    global _cache_singleton
    _cache_singleton = None


def _redact(url: str) -> str:
    """Mask the password in a connection URL before logging."""
    try:
        if "@" not in url:
            return url
        scheme_userinfo, host = url.split("@", 1)
        if "://" in scheme_userinfo and ":" in scheme_userinfo.rsplit("/", 1)[-1]:
            scheme, userinfo = scheme_userinfo.split("://", 1)
            if ":" in userinfo:
                user, _ = userinfo.split(":", 1)
                return f"{scheme}://{user}:***@{host}"
        return url
    except Exception:  # noqa: BLE001
        return "<unparseable-redis-url>"


# ---------------------------------------------------------------------------
# Helpers for the common pattern: ``dashboard:summary:<user_id>``.
# ---------------------------------------------------------------------------


def user_scope(scope: str, user_id: str, *args: str) -> str:
    """Build a canonical cache key.

    Format: ``<scope>:<user_id>[:<arg>...]``. Putting the user_id second
    makes prefix invalidation cheap: ``delete_prefix(f"{scope}:{user_id}")``
    clears one user's slice of one scope without scanning every key.
    """
    if args:
        return ":".join((scope, user_id, *args))
    return f"{scope}:{user_id}"


def invalidate_user(scopes: list[str], user_id: str) -> None:
    """Invalidate every cache entry for ``user_id`` across the listed
    scopes. Call this from mutation handlers (transaction create,
    budget update, plan delete, etc.).
    """
    cache = get_cache()
    for scope in scopes:
        cache.delete_prefix(f"{scope}:{user_id}")
