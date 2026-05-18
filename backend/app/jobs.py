"""Background job queue — arq + Redis.

Long-running routes (PDF rendering today; AI summaries later) enqueue
work onto an arq queue instead of running inline on the uvicorn worker
that received the request. The HTTP request returns 202 with a job id
and the frontend polls ``/api/jobs/{job_id}/status`` until the result
is ready.

**Runtime requirement**: `CACHE_REDIS_URL` must be set. The same Redis
instance powers cache + rate limiter + job queue. If Redis isn't
configured, ``enqueue()`` raises ``JobQueueUnavailable`` and the
calling route should fall back to inline execution (see
``reports.py:export_pdf``).

**Result storage**: serialized JSON payload in Redis with a 1-hour
TTL. Generated PDFs are throwaway artifacts; if a user wants a fresh
copy they re-export. Avoids dragging in S3 for v1.

The actual worker process is launched separately:

    arq app.worker.WorkerSettings

Docker Compose runs this as the ``aegis-worker`` service. On Render,
add a Background Worker service running the same image with that
command.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Awaitable, Callable

from loguru import logger

from .config import get_settings


class JobQueueUnavailable(RuntimeError):
    """Raised when ``CACHE_REDIS_URL`` is unset — the queue can't run
    without Redis. Callers should catch and fall back to inline
    execution (synchronous response)."""


_JOB_RESULT_PREFIX = "job:result:"
_JOB_STATUS_PREFIX = "job:status:"
_JOB_TTL_SECONDS = 3600  # 1 hour — generated artifacts are throwaway


def _redis_client():
    """Return a sync Redis client used by API routes to read job
    status. The worker uses arq's own async client; reads from API
    routes happen on sync handlers so a sync client is correct here.
    """
    settings = get_settings()
    if not settings.cache_redis_url:
        raise JobQueueUnavailable(
            "CACHE_REDIS_URL is not set — job queue requires Redis."
        )
    import redis  # local import: avoid hard-dep when queue isn't used

    return redis.Redis.from_url(
        settings.cache_redis_url,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
    )


def enqueue(task_name: str, *args: Any, **kwargs: Any) -> str:
    """Push a task onto the queue and return its job_id.

    The task name must match a function registered in
    ``app.worker.WorkerSettings.functions``. Args + kwargs are JSON-
    serialised by arq, so they must be plain types (no SQLAlchemy
    models, no datetimes — use ISO strings).
    """
    settings = get_settings()
    if not settings.cache_redis_url:
        raise JobQueueUnavailable(
            "CACHE_REDIS_URL is not set — cannot enqueue job."
        )

    # arq enqueue is async-only; we wrap a one-shot event loop. Cheap
    # — opening the loop + RPUSH is < 5 ms. Worth it to keep API
    # routes sync and avoid contaminating them with async.
    import asyncio

    from arq import create_pool
    from arq.connections import RedisSettings

    job_id = str(uuid.uuid4())

    async def _push() -> None:
        pool = await create_pool(_redis_settings_from_url(settings.cache_redis_url))
        try:
            await pool.enqueue_job(task_name, *args, _job_id=job_id, **kwargs)
            await pool.set(
                f"{_JOB_STATUS_PREFIX}{job_id}",
                "queued",
                ex=_JOB_TTL_SECONDS,
            )
        finally:
            await pool.aclose()

    asyncio.run(_push())
    logger.info("Enqueued {task} as {job_id}", task=task_name, job_id=job_id)
    return job_id


def get_status(job_id: str) -> dict[str, Any]:
    """Return ``{status, result_url?, error?}`` for a job.

    Statuses: ``queued`` | ``running`` | ``done`` | ``failed`` |
    ``unknown`` (job_id not found — either expired or never existed).
    """
    client = _redis_client()
    status = client.get(f"{_JOB_STATUS_PREFIX}{job_id}")
    if status is None:
        return {"status": "unknown"}

    response: dict[str, Any] = {"status": status}
    if status == "done":
        # Result location is opaque to the API layer; the task that
        # finished writes a `result_url` field that the frontend
        # follows to download the artifact.
        result_url = client.get(f"{_JOB_RESULT_PREFIX}{job_id}:url")
        if result_url:
            response["result_url"] = result_url
    elif status == "failed":
        err = client.get(f"{_JOB_RESULT_PREFIX}{job_id}:error")
        response["error"] = err or "Job failed without an error message."
    return response


def store_result_url(job_id: str, url: str, ttl: int = _JOB_TTL_SECONDS) -> None:
    """Worker-side helper: write the result URL + flip status to done."""
    client = _redis_client()
    client.setex(f"{_JOB_RESULT_PREFIX}{job_id}:url", ttl, url)
    client.setex(f"{_JOB_STATUS_PREFIX}{job_id}", ttl, "done")


def store_result_bytes(job_id: str, payload: bytes, content_type: str, filename: str,
                       ttl: int = _JOB_TTL_SECONDS) -> str:
    """Stash binary output (e.g. a generated PDF) in Redis and return
    the URL the frontend should hit to fetch it.

    Avoids dragging in S3 — for throwaway artifacts (PDFs, CSVs) a
    1-hour TTL in Redis is fine. Operators who need persistence can
    swap the storage backend without touching the API.
    """
    import base64

    client = _redis_client()
    encoded = base64.b64encode(payload).decode("ascii")
    client.setex(
        f"{_JOB_RESULT_PREFIX}{job_id}:bytes",
        ttl,
        encoded,
    )
    client.setex(
        f"{_JOB_RESULT_PREFIX}{job_id}:meta",
        ttl,
        f"{content_type}|{filename}",
    )
    url = f"/api/jobs/{job_id}/download"
    store_result_url(job_id, url, ttl)
    return url


def fetch_result_bytes(job_id: str) -> tuple[bytes, str, str] | None:
    """API-side helper used by ``GET /api/jobs/{job_id}/download``.
    Returns ``(payload, content_type, filename)`` or None if missing.
    """
    import base64

    client = _redis_client()
    encoded = client.get(f"{_JOB_RESULT_PREFIX}{job_id}:bytes")
    meta = client.get(f"{_JOB_RESULT_PREFIX}{job_id}:meta")
    if encoded is None or meta is None:
        return None
    content_type, filename = meta.split("|", 1)
    return base64.b64decode(encoded), content_type, filename


def mark_running(job_id: str) -> None:
    client = _redis_client()
    client.setex(f"{_JOB_STATUS_PREFIX}{job_id}", _JOB_TTL_SECONDS, "running")


def mark_failed(job_id: str, error: str) -> None:
    client = _redis_client()
    client.setex(f"{_JOB_STATUS_PREFIX}{job_id}", _JOB_TTL_SECONDS, "failed")
    client.setex(
        f"{_JOB_RESULT_PREFIX}{job_id}:error",
        _JOB_TTL_SECONDS,
        error[:500],  # cap error message size
    )


def _redis_settings_from_url(url: str):
    """Parse a Redis URL into arq's ``RedisSettings`` shape."""
    from urllib.parse import urlparse

    from arq.connections import RedisSettings

    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
        database=int((parsed.path or "/0").lstrip("/") or 0),
        ssl=parsed.scheme == "rediss",
    )
