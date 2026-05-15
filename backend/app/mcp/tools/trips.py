"""MCP tools for trips."""
from __future__ import annotations

import json
from typing import Any

from mcp import types

from ...models.budget import Budget
from ...models.transaction import Transaction, TransactionType
from ...models.trip import Trip, TripStatus
from ...schemas.trip import (
    TripCategoryRollup,
    TripCreate,
    TripResponse,
    TripSummary,
    TripUpdate,
)
from ..schemas import pydantic_to_mcp_schema
from ..session import resolve_user_id, session_scope


def _serialize(trip: Trip) -> dict[str, Any]:
    return json.loads(TripResponse.model_validate(trip).model_dump_json())


async def list_trips(args: dict[str, Any]) -> str:
    user_id = resolve_user_id()
    with session_scope() as db:
        q = db.query(Trip).filter(Trip.user_id == user_id)
        if s := args.get("status"):
            q = q.filter(Trip.status == TripStatus(s))
        rows = q.order_by(Trip.start_date.desc()).all()
        return json.dumps([_serialize(t) for t in rows], default=str)


async def create_trip(args: dict[str, Any]) -> str:
    payload = TripCreate.model_validate(args)
    user_id = resolve_user_id()
    with session_scope() as db:
        db_trip = Trip(**payload.model_dump(), user_id=user_id)
        db.add(db_trip)
        db.commit()
        db.refresh(db_trip)
        return json.dumps(_serialize(db_trip), default=str)


async def update_trip(args: dict[str, Any]) -> str:
    trip_id = args.get("trip_id")
    if not trip_id:
        raise ValueError("trip_id is required")
    update = TripUpdate.model_validate({k: v for k, v in args.items() if k != "trip_id"})
    user_id = resolve_user_id()
    with session_scope() as db:
        trip = (
            db.query(Trip)
            .filter(Trip.id == trip_id, Trip.user_id == user_id)
            .first()
        )
        if not trip:
            raise ValueError(f"Trip {trip_id} not found")
        for key, val in update.model_dump(exclude_unset=True).items():
            setattr(trip, key, val)
        db.commit()
        db.refresh(trip)
        return json.dumps(_serialize(trip), default=str)


async def get_trip_summary(args: dict[str, Any]) -> str:
    trip_id = args.get("trip_id")
    if not trip_id:
        raise ValueError("trip_id is required")
    user_id = resolve_user_id()
    with session_scope() as db:
        trip = (
            db.query(Trip)
            .filter(Trip.id == trip_id, Trip.user_id == user_id)
            .first()
        )
        if not trip:
            raise ValueError(f"Trip {trip_id} not found")
        budgets = db.query(Budget).filter(Budget.trip_id == trip_id).all()
        transactions = (
            db.query(Transaction)
            .filter(
                Transaction.trip_id == trip_id,
                Transaction.type == TransactionType.expense,
            )
            .all()
        )
        budgeted: dict[str, float] = {}
        for b in budgets:
            budgeted[b.category] = budgeted.get(b.category, 0) + float(b.amount)
        spent: dict[str, float] = {}
        for t in transactions:
            spent[t.category] = spent.get(t.category, 0) + float(t.amount)
        categories = sorted(set(budgeted) | set(spent))
        rollups = [
            TripCategoryRollup(category=c, budgeted=budgeted.get(c, 0), spent=spent.get(c, 0))
            for c in categories
        ]
        summary = TripSummary(
            trip=TripResponse.model_validate(trip),
            total_budgeted=sum(budgeted.values()),
            total_spent=sum(spent.values()),
            by_category=rollups,
            transaction_count=len(transactions),
        )
        return summary.model_dump_json()


TOOLS = [
    types.Tool(
        name="list_trips",
        description="List the user's trips. Filter by status (planned/active/completed).",
        inputSchema={
            "type": "object",
            "properties": {
                "status": {"type": "string", "enum": ["planned", "active", "completed"]},
            },
        },
    ),
    types.Tool(
        name="create_trip",
        description=(
            "Create a new trip. Attach budget lines and transactions to it via "
            "trip_id on create_budget / create_transaction for rolled-up trip spending."
        ),
        inputSchema=pydantic_to_mcp_schema(TripCreate),
    ),
    types.Tool(
        name="update_trip",
        description="Update an existing trip. Pass trip_id plus the fields to change.",
        inputSchema={
            "type": "object",
            "properties": {
                "trip_id": {"type": "string"},
                **pydantic_to_mcp_schema(TripUpdate).get("properties", {}),
            },
            "required": ["trip_id"],
        },
    ),
    types.Tool(
        name="get_trip_summary",
        description=(
            "Return a rolled-up summary for one trip: total budgeted, total spent, "
            "per-category breakdown, and linked transaction count."
        ),
        inputSchema={
            "type": "object",
            "properties": {"trip_id": {"type": "string"}},
            "required": ["trip_id"],
        },
    ),
]


HANDLERS = {
    "list_trips": list_trips,
    "create_trip": create_trip,
    "update_trip": update_trip,
    "get_trip_summary": get_trip_summary,
}
