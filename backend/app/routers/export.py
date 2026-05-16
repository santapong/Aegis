"""Bulk export endpoints for warehouse ingestion + GDPR compliance.

Streams NDJSON (newline-delimited JSON) — one row per line, no
top-level array — so consumers can ingest at constant memory regardless
of dataset size. This is the format Redshift's ``COPY ... FORMAT JSON``,
BigQuery's ``bq load --source_format=NEWLINE_DELIMITED_JSON``, and
ClickHouse's ``INSERT ... FORMAT JSONEachRow`` all accept natively.

Auth: requires the standard JWT, and a user can only export their own
data. Cross-user / admin export needs a role system that doesn't exist
yet — track separately when it does.

See docs/analytics-warehouses.md for the bulk-loading recipes.
"""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic_core import to_jsonable_python
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.budget import Budget
from ..models.plan import Plan
from ..models.transaction import Transaction
from ..models.user import User

router = APIRouter(prefix="/api/export", tags=["export"])


def _ndjson_stream(rows):
    """Yield each row as a JSON line. ``to_jsonable_python`` handles
    datetime, Decimal, Enum, and SQLAlchemy model instances (when
    given as dicts) the same way FastAPI does on its own responses."""
    for row in rows:
        # SQLAlchemy declarative objects don't serialize directly — pull
        # column values via the inspector. Cheap, no relationships
        # traversed (avoids accidental N+1).
        data = {col.name: getattr(row, col.name) for col in row.__table__.columns}
        yield json.dumps(to_jsonable_python(data)) + "\n"


@router.get("/transactions.ndjson")
def export_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stream all of the caller's transactions as NDJSON.

    Volume note: a heavy user has 5-20k rows. At ~300 B per row that's
    1.5-6 MB; the stream is bounded by yield-per which never holds more
    than 100 rows in memory at once.
    """
    # yield_per pulls rows in batches from the cursor instead of
    # materialising the whole result set in Python — important because
    # this endpoint targets full-history dumps.
    rows = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.date)
        .yield_per(100)
    )
    return StreamingResponse(
        _ndjson_stream(rows),
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": "attachment; filename=transactions.ndjson",
        },
    )


@router.get("/plans.ndjson")
def export_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Plan)
        .filter(Plan.user_id == current_user.id)
        .order_by(Plan.start_date)
        .yield_per(100)
    )
    return StreamingResponse(
        _ndjson_stream(rows),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=plans.ndjson"},
    )


@router.get("/budgets.ndjson")
def export_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id)
        .order_by(Budget.period_start)
        .yield_per(100)
    )
    return StreamingResponse(
        _ndjson_stream(rows),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=budgets.ndjson"},
    )
