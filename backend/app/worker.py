"""arq worker process — runs background tasks off the API workers.

Launched as a separate process:

    arq app.worker.WorkerSettings

Docker Compose runs this as the ``aegis-worker`` service. On Render
add a Background Worker service running the same image with that
command.

Task registry: every callable that should be enqueueable goes into
``WorkerSettings.functions``. Tasks receive ``ctx`` as their first arg
(arq's context dict: job_id, redis pool, logger, etc.) — keep it
out of the function signature in any caller-facing wrapper.
"""

from __future__ import annotations

import asyncio
from typing import Any

from loguru import logger

from .config import get_settings
from .jobs import (
    _redis_settings_from_url,
    mark_failed,
    mark_running,
    store_result_bytes,
)


# ---------------------------------------------------------------------------
# Task: render PDF report
# ---------------------------------------------------------------------------

async def render_pdf_report(
    ctx: dict[str, Any],
    user_id: str,
    start_date_iso: str,
    end_date_iso: str,
) -> None:
    """Generate a PDF report for the given user + date window and
    stash the bytes in Redis. The frontend polls
    ``GET /api/jobs/{job_id}/status`` and follows ``result_url`` once
    status flips to "done".

    Heavy: WeasyPrint + matplotlib hold ~80–150 MB resident per call.
    Worker process is sized accordingly (Render Background Worker
    Starter @ 512 MB is the floor).
    """
    job_id = ctx["job_id"]
    mark_running(job_id)
    try:
        # Imports local to the task — keep them out of the worker boot
        # path so a misconfigured render module doesn't break the
        # whole worker.
        from datetime import date

        from .database import SessionLocal
        from .models.transaction import Transaction, TransactionType
        from .models.user import User
        from .services.pdf_renderer import render_report_pdf

        start = date.fromisoformat(start_date_iso)
        end = date.fromisoformat(end_date_iso)

        # Sync SQLAlchemy session — the worker runs in its own process
        # so we don't share a session with the API.
        with SessionLocal() as db:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise RuntimeError(f"User {user_id} not found")

            transactions = (
                db.query(Transaction)
                .filter(
                    Transaction.user_id == user_id,
                    Transaction.date >= start,
                    Transaction.date <= end,
                )
                .order_by(Transaction.date.desc())
                .limit(5000)
                .all()
            )

            total_income = sum(
                float(t.amount) for t in transactions if t.type == TransactionType.income
            )
            total_expenses = sum(
                float(t.amount) for t in transactions if t.type == TransactionType.expense
            )
            by_category: dict[str, float] = {}
            for t in transactions:
                if t.type == TransactionType.expense:
                    by_category[t.category] = by_category.get(t.category, 0) + float(t.amount)

            pdf_bytes = render_report_pdf(
                username=user.username,
                start=start,
                end=end,
                total_income=total_income,
                total_expenses=total_expenses,
                by_category=by_category,
            )

        filename = f"aegis-report-{start_date_iso}-{end_date_iso}.pdf"
        store_result_bytes(
            job_id,
            payload=pdf_bytes,
            content_type="application/pdf",
            filename=filename,
        )
        logger.info(
            "Job {job_id}: rendered PDF for user={uid} ({size} bytes)",
            job_id=job_id,
            uid=user_id,
            size=len(pdf_bytes),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Job {job_id}: PDF render failed", job_id=job_id)
        mark_failed(job_id, f"{type(exc).__name__}: {exc}")
        raise


# ---------------------------------------------------------------------------
# arq worker config
# ---------------------------------------------------------------------------


class WorkerSettings:
    """arq picks up this class when launched as ``arq app.worker.WorkerSettings``."""

    functions = [render_pdf_report]

    # 1 hour max — anything longer than that on a PDF render is a hung
    # WeasyPrint call and the worker is better off dying so its
    # supervisor restarts it.
    job_timeout = 60 * 60
    # Retry once on failure; a second failure marks the job failed.
    max_tries = 2

    @classmethod
    def __init_subclass__(cls, **kwargs: Any) -> None:
        # Defensive — arq itself doesn't subclass this, so the hook
        # should never fire. If it does, log so we notice.
        logger.warning("WorkerSettings subclassed by {cls}", cls=cls)

    # arq calls this once to set up its Redis connection.
    @staticmethod
    def redis_settings():
        settings = get_settings()
        if not settings.cache_redis_url:
            raise RuntimeError(
                "CACHE_REDIS_URL is not set — the worker requires Redis. "
                "Set it in the worker service's environment."
            )
        return _redis_settings_from_url(settings.cache_redis_url)


def main() -> None:
    """Convenience entrypoint — most operators just run
    ``arq app.worker.WorkerSettings``, but exposing main() lets you
    `python -m app.worker` in a pinch (useful for one-shot smoke tests).
    """
    from arq.worker import run_worker

    run_worker(WorkerSettings)  # type: ignore[arg-type]


if __name__ == "__main__":
    main()
