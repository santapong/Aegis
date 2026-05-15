"""MCP tools that wrap the Aegis AI engine."""
from __future__ import annotations

import json
from typing import Any

from mcp import types

from ...services.ai_engine import AIEngine
from ..session import resolve_user_id, session_scope


async def ai_analyze(args: dict[str, Any]) -> str:
    user_id = resolve_user_id()
    with session_scope() as db:
        engine = AIEngine(db, user_id=user_id)
        recs = engine.analyze(
            question=args.get("question"),
            days=int(args.get("date_range_days", 90)),
        )
        return json.dumps(
            [
                {
                    "id": r.id,
                    "recommendation": r.recommendation,
                    "confidence": r.confidence,
                    "category": r.category,
                    "action_type": r.action_type.value,
                }
                for r in recs
            ],
            default=str,
        )


async def ai_forecast(args: dict[str, Any]) -> str:
    user_id = resolve_user_id()
    with session_scope() as db:
        engine = AIEngine(db, user_id=user_id)
        result = engine.forecast(months_ahead=int(args.get("months", 3)))
        return json.dumps(result, default=str)


async def ai_recommend(args: dict[str, Any]) -> str:
    # Same code path as analyze with no question — kept as a separate tool
    # because most clients map "recommend" to a different intent.
    user_id = resolve_user_id()
    with session_scope() as db:
        engine = AIEngine(db, user_id=user_id)
        recs = engine.analyze()
        return json.dumps(
            [
                {
                    "id": r.id,
                    "recommendation": r.recommendation,
                    "confidence": r.confidence,
                    "category": r.category,
                    "action_type": r.action_type.value,
                }
                for r in recs
            ],
            default=str,
        )


TOOLS = [
    types.Tool(
        name="ai_analyze",
        description=(
            "Ask the Aegis AI advisor to analyze recent spending and return "
            "structured recommendations. Optional `question` to focus the analysis."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "date_range_days": {"type": "integer", "default": 90, "minimum": 7, "maximum": 365},
            },
        },
    ),
    types.Tool(
        name="ai_forecast",
        description="Forecast finances N months ahead based on recent history.",
        inputSchema={
            "type": "object",
            "properties": {
                "months": {"type": "integer", "default": 3, "minimum": 1, "maximum": 12},
            },
        },
    ),
    types.Tool(
        name="ai_recommend",
        description="Get general financial recommendations without a specific question.",
        inputSchema={"type": "object", "properties": {}},
    ),
]


HANDLERS = {
    "ai_analyze": ai_analyze,
    "ai_forecast": ai_forecast,
    "ai_recommend": ai_recommend,
}
