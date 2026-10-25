"""MCP tools for dashboard summaries (cheap, no AI)."""

from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

from mcp import types

from ...models.transaction import Transaction, TransactionType
from ...services.finance_reads import financial_today, cutover_active, report
from ..session import resolve_user_id, session_scope


async def get_dashboard(args: dict[str, Any]) -> str:
    period = args.get("period", "month")
    days = {"week": 7, "month": 30, "year": 365}.get(period, 30)
    user_id = resolve_user_id()
    with session_scope() as db:
        today = financial_today(db, user_id)
        start = today - timedelta(days=days)
        if cutover_active(db, user_id):
            return json.dumps(
                {"period": period, **report(db, user_id, start, today)}, default=str
            )
        txns = (
            db.query(Transaction)
            .filter(
                (Transaction.user_id == user_id) & Transaction.workspace_id.is_(None),
                Transaction.date >= start,
                Transaction.date <= today,
            )
            .all()
        )
        income = sum(float(t.amount) for t in txns if t.type == TransactionType.income)
        expenses = sum(
            float(t.amount) for t in txns if t.type == TransactionType.expense
        )
        by_cat: dict[str, float] = {}
        for t in txns:
            if t.type == TransactionType.expense:
                by_cat[t.category] = by_cat.get(t.category, 0) + float(t.amount)
        return json.dumps(
            {
                "period": period,
                "start_date": start.isoformat(),
                "end_date": today.isoformat(),
                "total_income": round(income, 2),
                "total_expenses": round(expenses, 2),
                "net": round(income - expenses, 2),
                "savings_rate_percent": round((income - expenses) / income * 100, 1)
                if income > 0
                else 0,
                "spending_by_category": {k: round(v, 2) for k, v in by_cat.items()},
                "transaction_count": len(txns),
            },
            default=str,
        )


TOOLS = [
    types.Tool(
        name="get_dashboard",
        description=(
            "Return a quick financial dashboard for the period (week/month/year): "
            "income, expenses, net, savings rate, and spending by category."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "period": {
                    "type": "string",
                    "enum": ["week", "month", "year"],
                    "default": "month",
                },
            },
        },
    ),
]


HANDLERS = {"get_dashboard": get_dashboard}
