"""Bulk export endpoints for warehouse ingestion + GDPR compliance.

**Async**: this router is the spike for the async-SQLAlchemy migration
(see docs/design/002-async-sqlalchemy-migration.md). It's a good fit
because the response is long-running (streaming NDJSON for thousands
of rows) — async lets the worker yield while the response body is
trickling out to the client.

The rest of the codebase remains sync. Routes can migrate one at a
time using this as a reference. Sync and async engines share the same
database but maintain independent connection pools.

Streams NDJSON (newline-delimited JSON) so consumers can ingest at
constant memory regardless of dataset size. Format accepted natively
by Redshift's ``COPY``, BigQuery's ``bq load``, ClickHouse's
``JSONEachRow``.

Auth: requires the standard JWT, and a user can only export their own
data. See docs/analytics-warehouses.md for warehouse ingestion recipes.
"""

import json
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic_core import to_jsonable_python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..database import get_async_db
from ..models.budget import Budget
from ..models.plan import Plan
from ..models.transaction import Transaction
from ..models.user import User

router = APIRouter(prefix="/api/export", tags=["export"])


async def _ndjson_stream(rows: AsyncIterator) -> AsyncIterator[str]:
    """Yield each row as a JSON line.

    Async version of the sync helper that used to live here. The
    AsyncSession's ``stream_scalars()`` returns an async iterator that
    pulls rows from the cursor in batches — same constant-memory
    guarantee as the old ``yield_per(100)`` but composes with async
    handlers.
    """
    async for row in rows:
        data = {col.name: getattr(row, col.name) for col in row.__table__.columns}
        yield json.dumps(to_jsonable_python(data)) + "\n"


@router.get("/transactions.ndjson")
async def export_transactions(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
):
    """Stream the caller's transactions as NDJSON.

    Async version of the previous sync endpoint. Identical semantics
    + identical wire output — only the in-process I/O model changed.
    """
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.date)
        .execution_options(yield_per=100)
    )
    result = await db.stream_scalars(stmt)
    return StreamingResponse(
        _ndjson_stream(result),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=transactions.ndjson"},
    )


@router.get("/plans.ndjson")
async def export_plans(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Plan)
        .where(Plan.user_id == current_user.id)
        .order_by(Plan.start_date)
        .execution_options(yield_per=100)
    )
    result = await db.stream_scalars(stmt)
    return StreamingResponse(
        _ndjson_stream(result),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=plans.ndjson"},
    )


@router.get("/budgets.ndjson")
async def export_budgets(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Budget)
        .where(Budget.user_id == current_user.id)
        .order_by(Budget.period_start)
        .execution_options(yield_per=100)
    )
    result = await db.stream_scalars(stmt)
    return StreamingResponse(
        _ndjson_stream(result),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=budgets.ndjson"},
    )
