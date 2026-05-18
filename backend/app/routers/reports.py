import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ..database import get_db
from ..models.transaction import Transaction, TransactionType
from ..models.user import User
from ..auth import get_current_user
# pdf_renderer is NOT imported at module level — WeasyPrint + matplotlib
# are heavy and not installed on serverless Python runtimes (Vercel,
# Cloud Run min). The PDF endpoint imports them lazily and returns 503
# if they're unavailable. Other endpoints in this router (CSV export,
# category-comparison) don't need WeasyPrint and stay functional.


router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/category-comparison")
def category_comparison(
    months: int = Query(default=6, ge=2, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    # Lower bound for the SQL window — the earliest month we'll render.
    earliest_month = (today.month - (months - 1) - 1) % 12 + 1
    earliest_year = today.year - (1 if today.month - (months - 1) <= 0 else 0)
    window_start = date(earliest_year, earliest_month, 1)

    # One GROUP BY query across the full N-month window, replacing
    # `months` separate full-month .all() calls. We re-bucket in
    # Python so the output shape (one row per month, categories nested)
    # matches the previous response.
    rows = (
        db.query(
            sa_func.extract("year", Transaction.date).label("y"),
            sa_func.extract("month", Transaction.date).label("m"),
            Transaction.category,
            sa_func.coalesce(sa_func.sum(Transaction.amount), 0).label("total"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= window_start,
            Transaction.date <= today,
        )
        .group_by("y", "m", Transaction.category)
        .all()
    )
    bucket: dict[tuple[int, int], dict[str, float]] = {}
    for y, m, category, total in rows:
        bucket.setdefault((int(y), int(m)), {})[category] = float(total or 0)

    result: list[dict] = []
    for i in range(months - 1, -1, -1):
        m = (today.month - i - 1) % 12 + 1
        y = today.year - (1 if today.month - i <= 0 else 0)
        month_start = date(y, m, 1)
        result.append({
            "month": month_start.strftime("%b %Y"),
            "categories": bucket.get((y, m), {}),
        })

    for i in range(1, len(result)):
        changes: dict[str, float | None] = {}
        for cat in set(list(result[i]["categories"].keys()) + list(result[i - 1]["categories"].keys())):
            prev = result[i - 1]["categories"].get(cat, 0)
            curr = result[i]["categories"].get(cat, 0)
            if prev > 0:
                changes[cat] = round((curr - prev) / prev * 100, 1)
            elif curr > 0:
                changes[cat] = None
            else:
                changes[cat] = 0.0
        result[i]["changes"] = changes
    if result:
        result[0]["changes"] = {}

    return result


@router.get("/export")
def export_csv(
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=50000, le=100000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Hard upper bound on rows materialized. A user with > 100k
    # transactions hitting this endpoint without pagination would
    # otherwise pull the entire history into Python at once. For most
    # users the default 50k is well above what they have; power users
    # who need more can paginate via `?start_date=&end_date=`.
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)

    transactions = query.order_by(Transaction.date.desc()).limit(limit).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Category", "Amount", "Description"])
    for t in transactions:
        writer.writerow([
            t.date.isoformat(),
            t.type.value,
            t.category,
            float(t.amount),
            t.description or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/export.pdf")
def export_pdf(
    start_date: date | None = None,
    end_date: date | None = None,
    background: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Render the reports view to a formatted PDF via WeasyPrint.

    Two execution modes:

    1. **Inline** (default) — render the PDF synchronously on the API
       worker and stream the bytes back in the response. Simple, works
       even without Redis. Burns ~800 ms of CPU on the request worker.
    2. **Background** (``?background=true`` OR auto-fallback when the
       inline path errored out) — enqueues an arq job, returns 202 with
       ``{job_id, poll_url, download_url}``. Frontend polls
       ``/api/jobs/{id}/status`` until "done" and follows ``result_url``
       to download. Requires ``CACHE_REDIS_URL`` to be configured.

    Inline is preserved for clients that prefer one round-trip (CLI,
    scripts). Background is recommended once you have > a handful of
    concurrent users — see docs/design/001-background-worker-queue.md.
    """
    # Try the background queue first if explicitly requested. Falls
    # back to inline rendering when the queue isn't available so the
    # endpoint stays functional on dev/single-pod deploys.
    if background:
        try:
            from ..jobs import JobQueueUnavailable, enqueue

            today_ = date.today()
            start_iso = (start_date or today_.replace(day=1)).isoformat()
            end_iso = (end_date or today_).isoformat()
            job_id = enqueue(
                "render_pdf_report",
                user_id=current_user.id,
                start_date_iso=start_iso,
                end_date_iso=end_iso,
            )
            return {
                "job_id": job_id,
                "status": "queued",
                "poll_url": f"/api/jobs/{job_id}/status",
                "download_url": f"/api/jobs/{job_id}/download",
            }
        except JobQueueUnavailable:
            # Redis not configured — fall through to inline render
            # rather than 503-ing. The operator sees the warning in
            # the startup log; users keep getting their PDFs.
            pass

    today = date.today()
    start = start_date or today.replace(day=1)
    end = end_date or today

    # Cap PDF rows so a power-user export doesn't OOM the WeasyPrint
    # worker. 5000 rows fills ~30 PDF pages — beyond that, the report
    # isn't a useful artifact anyway; use the CSV export with a
    # tighter date range.
    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start,
        Transaction.date <= end,
    )
    transactions = query.order_by(Transaction.date.desc()).limit(5000).all()

    total_income = sum(float(t.amount) for t in transactions if t.type == TransactionType.income)
    total_expenses = sum(float(t.amount) for t in transactions if t.type == TransactionType.expense)

    by_category: dict[str, float] = {}
    for t in transactions:
        if t.type == TransactionType.expense:
            by_category[t.category] = by_category.get(t.category, 0) + float(t.amount)
    by_category = dict(sorted(by_category.items(), key=lambda kv: kv[1], reverse=True))

    # Lazy import — WeasyPrint and matplotlib are excluded from the
    # slim Vercel deploy (see backend/requirements.txt). On full
    # deploys (Docker/Render) they're installed and this just works.
    try:
        from ..services.pdf_renderer import render_report_pdf
    except ImportError as exc:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail=(
                "PDF export is disabled on this deployment "
                "(WeasyPrint not installed). Use the CSV export instead."
            ),
        ) from exc

    pdf_bytes = render_report_pdf(
        username=current_user.username,
        start=start,
        end=end,
        total_income=total_income,
        total_expenses=total_expenses,
        by_category=by_category,
    )

    filename = f"aegis-report-{start.strftime('%Y%m%d')}-{end.strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
