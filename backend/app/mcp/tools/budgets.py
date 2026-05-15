"""MCP tools for budgets."""
from __future__ import annotations

import json
from datetime import date
from typing import Any

from mcp import types

from ...models.budget import Budget
from ...models.transaction import Transaction, TransactionType
from ...schemas.budget import BudgetCreate, BudgetResponse, BudgetUpdate
from ..schemas import pydantic_to_mcp_schema
from ..session import resolve_user_id, session_scope


def _serialize(budget: Budget) -> dict[str, Any]:
    return json.loads(BudgetResponse.model_validate(budget).model_dump_json())


async def get_budgets(args: dict[str, Any]) -> str:
    user_id = resolve_user_id()
    with session_scope() as db:
        q = db.query(Budget).filter(Budget.user_id == user_id)
        if c := args.get("category"):
            q = q.filter(Budget.category == c)
        if args.get("active") is True:
            today = date.today()
            q = q.filter(Budget.period_start <= today, Budget.period_end >= today)
        rows = q.order_by(Budget.period_start.desc()).all()
        return json.dumps([_serialize(b) for b in rows], default=str)


async def create_budget(args: dict[str, Any]) -> str:
    payload = BudgetCreate.model_validate(args)
    user_id = resolve_user_id()
    with session_scope() as db:
        db_budget = Budget(**payload.model_dump(), user_id=user_id)
        db.add(db_budget)
        db.commit()
        db.refresh(db_budget)
        return json.dumps(_serialize(db_budget), default=str)


async def update_budget(args: dict[str, Any]) -> str:
    budget_id = args.get("budget_id")
    if not budget_id:
        raise ValueError("budget_id is required")
    update = BudgetUpdate.model_validate({k: v for k, v in args.items() if k != "budget_id"})
    user_id = resolve_user_id()
    with session_scope() as db:
        b = (
            db.query(Budget)
            .filter(Budget.id == budget_id, Budget.user_id == user_id)
            .first()
        )
        if not b:
            raise ValueError(f"Budget {budget_id} not found")
        for key, val in update.model_dump(exclude_unset=True).items():
            setattr(b, key, val)
        db.commit()
        db.refresh(b)
        return json.dumps(_serialize(b), default=str)


async def get_budget_comparison(args: dict[str, Any]) -> str:
    """Return budget-vs-actual for the period (defaults to month-to-date)."""
    user_id = resolve_user_id()
    today = date.today()
    period_start = (
        date.fromisoformat(args["period_start"]) if args.get("period_start") else today.replace(day=1)
    )
    period_end = date.fromisoformat(args["period_end"]) if args.get("period_end") else today
    with session_scope() as db:
        budgets = (
            db.query(Budget)
            .filter(
                Budget.user_id == user_id,
                Budget.period_start <= period_end,
                Budget.period_end >= period_start,
            )
            .all()
        )
        expenses = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.expense,
                Transaction.date >= period_start,
                Transaction.date <= period_end,
            )
            .all()
        )
        spent_by_cat: dict[str, float] = {}
        for t in expenses:
            spent_by_cat[t.category] = spent_by_cat.get(t.category, 0) + float(t.amount)
        rows = []
        for b in budgets:
            actual = spent_by_cat.get(b.category, 0)
            cap = float(b.amount)
            rows.append(
                {
                    "category": b.category,
                    "budget_amount": cap,
                    "actual_spent": actual,
                    "remaining": cap - actual,
                    "usage_percent": round((actual / cap * 100) if cap > 0 else 0, 1),
                    "over_budget": actual > cap,
                }
            )
        return json.dumps(
            {
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "comparisons": rows,
                "total_budgeted": sum(float(b.amount) for b in budgets),
                "total_spent": sum(r["actual_spent"] for r in rows),
            },
            default=str,
        )


TOOLS = [
    types.Tool(
        name="get_budgets",
        description="List the authenticated user's budgets. Filter by category or active=true.",
        inputSchema={
            "type": "object",
            "properties": {
                "category": {"type": "string"},
                "active": {"type": "boolean", "description": "If true, only budgets covering today"},
            },
        },
    ),
    types.Tool(
        name="get_budget_comparison",
        description=(
            "Compare budgeted amounts vs actual spending for a period. "
            "Defaults to month-to-date when no dates are provided."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "period_start": {"type": "string", "format": "date"},
                "period_end": {"type": "string", "format": "date"},
            },
        },
    ),
    types.Tool(
        name="create_budget",
        description="Create a new budget. Use trip_id to attach a budget line to a trip.",
        inputSchema=pydantic_to_mcp_schema(BudgetCreate),
    ),
    types.Tool(
        name="update_budget",
        description="Update an existing budget. Pass budget_id plus the fields to change.",
        inputSchema={
            "type": "object",
            "properties": {
                "budget_id": {"type": "string"},
                **pydantic_to_mcp_schema(BudgetUpdate).get("properties", {}),
            },
            "required": ["budget_id"],
        },
    ),
]


HANDLERS = {
    "get_budgets": get_budgets,
    "get_budget_comparison": get_budget_comparison,
    "create_budget": create_budget,
    "update_budget": update_budget,
}
