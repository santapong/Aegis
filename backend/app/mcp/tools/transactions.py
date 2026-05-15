"""MCP tools for transactions."""
from __future__ import annotations

import json
from datetime import date
from typing import Any

from mcp import types
from sqlalchemy import or_

from sqlalchemy.orm import Session

from ...models.tag import Tag
from ...models.transaction import Transaction, TransactionType
from ...models.trip import Trip
from ...schemas.transaction import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from ...services.notification_service import evaluate_budget_thresholds
from ..schemas import pydantic_to_mcp_schema
from ..session import resolve_user_id, session_scope


def _check_trip_owner(db: Session, trip_id: str | None, user_id: str) -> None:
    if not trip_id:
        return
    owned = (
        db.query(Trip.id)
        .filter(Trip.id == trip_id, Trip.user_id == user_id)
        .first()
    )
    if not owned:
        raise ValueError(f"Trip {trip_id} not found")


def _serialize(txn: Transaction) -> dict[str, Any]:
    return json.loads(TransactionResponse.model_validate(txn).model_dump_json())


async def list_transactions(args: dict[str, Any]) -> str:
    user_id = resolve_user_id()
    with session_scope() as db:
        q = db.query(Transaction).filter(Transaction.user_id == user_id)
        if t := args.get("type"):
            q = q.filter(Transaction.type == TransactionType(t))
        if c := args.get("category"):
            q = q.filter(Transaction.category == c)
        if start := args.get("start_date"):
            q = q.filter(Transaction.date >= date.fromisoformat(start))
        if end := args.get("end_date"):
            q = q.filter(Transaction.date <= date.fromisoformat(end))
        if trip := args.get("trip_id"):
            q = q.filter(Transaction.trip_id == trip)
        if search := args.get("q"):
            needle = f"%{search.strip()}%"
            q = q.filter(
                or_(Transaction.description.ilike(needle), Transaction.category.ilike(needle))
            )
        limit = min(int(args.get("limit", 100)), 500)
        offset = max(int(args.get("offset", 0)), 0)
        rows = q.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()
        return json.dumps([_serialize(t) for t in rows], default=str)


async def create_transaction(args: dict[str, Any]) -> str:
    payload = TransactionCreate.model_validate(args)
    user_id = resolve_user_id()
    with session_scope() as db:
        _check_trip_owner(db, payload.trip_id, user_id)
        tag_ids = payload.tag_ids
        data = payload.model_dump(exclude={"tag_ids"})
        db_txn = Transaction(**data, user_id=user_id)
        if tag_ids:
            db_txn.tags = (
                db.query(Tag).filter(Tag.id.in_(tag_ids), Tag.user_id == user_id).all()
            )
        db.add(db_txn)
        db.commit()
        db.refresh(db_txn)
        evaluate_budget_thresholds(db, user_id=user_id, transaction=db_txn)
        return json.dumps(_serialize(db_txn), default=str)


async def update_transaction(args: dict[str, Any]) -> str:
    txn_id = args.get("transaction_id")
    if not txn_id:
        raise ValueError("transaction_id is required")
    update = TransactionUpdate.model_validate({k: v for k, v in args.items() if k != "transaction_id"})
    user_id = resolve_user_id()
    with session_scope() as db:
        db_txn = (
            db.query(Transaction)
            .filter(Transaction.id == txn_id, Transaction.user_id == user_id)
            .first()
        )
        if not db_txn:
            raise ValueError(f"Transaction {txn_id} not found")
        data = update.model_dump(exclude_unset=True)
        if "trip_id" in data:
            _check_trip_owner(db, data["trip_id"], user_id)
        tag_ids = data.pop("tag_ids", None)
        for key, val in data.items():
            setattr(db_txn, key, val)
        if tag_ids is not None:
            db_txn.tags = (
                db.query(Tag).filter(Tag.id.in_(tag_ids), Tag.user_id == user_id).all()
                if tag_ids else []
            )
        db.commit()
        db.refresh(db_txn)
        evaluate_budget_thresholds(db, user_id=user_id, transaction=db_txn)
        return json.dumps(_serialize(db_txn), default=str)


_LIST_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["income", "expense"]},
        "category": {"type": "string"},
        "start_date": {"type": "string", "format": "date"},
        "end_date": {"type": "string", "format": "date"},
        "trip_id": {"type": "string"},
        "q": {"type": "string", "description": "Free-text search on description/category"},
        "limit": {"type": "integer", "minimum": 1, "maximum": 500, "default": 100},
        "offset": {"type": "integer", "minimum": 0, "default": 0},
    },
}


TOOLS = [
    types.Tool(
        name="list_transactions",
        description=(
            "List the authenticated user's transactions, with optional filters "
            "(type, category, date range, trip, free-text). Returns JSON array."
        ),
        inputSchema=_LIST_SCHEMA,
    ),
    types.Tool(
        name="create_transaction",
        description=(
            "Create a new transaction for the authenticated user. Triggers "
            "budget-overrun notifications when the affected budget crosses "
            "80% or 100% of its cap."
        ),
        inputSchema=pydantic_to_mcp_schema(TransactionCreate),
    ),
    types.Tool(
        name="update_transaction",
        description=(
            "Update an existing transaction (the 'correct useful data' loop). "
            "Pass the transaction_id plus only the fields you want to change. "
            "Re-evaluates budget thresholds after the change."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "transaction_id": {"type": "string"},
                **pydantic_to_mcp_schema(TransactionUpdate).get("properties", {}),
            },
            "required": ["transaction_id"],
        },
    ),
]


HANDLERS = {
    "list_transactions": list_transactions,
    "create_transaction": create_transaction,
    "update_transaction": update_transaction,
}
