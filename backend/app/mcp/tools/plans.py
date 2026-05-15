"""MCP tools for plans."""
from __future__ import annotations

import json
from typing import Any

from mcp import types

from ...models.plan import Plan, PlanStatus
from ...schemas.plan import PlanCreate, PlanResponse, PlanUpdate
from ..schemas import pydantic_to_mcp_schema
from ..session import resolve_user_id, session_scope


def _serialize(plan: Plan) -> dict[str, Any]:
    return json.loads(PlanResponse.model_validate(plan).model_dump_json())


async def get_plans(args: dict[str, Any]) -> str:
    user_id = resolve_user_id()
    with session_scope() as db:
        q = db.query(Plan).filter(Plan.user_id == user_id)
        if s := args.get("status"):
            q = q.filter(Plan.status == PlanStatus(s))
        rows = q.order_by(Plan.start_date).all()
        return json.dumps([_serialize(p) for p in rows], default=str)


async def create_plan(args: dict[str, Any]) -> str:
    payload = PlanCreate.model_validate(args)
    user_id = resolve_user_id()
    with session_scope() as db:
        db_plan = Plan(**payload.model_dump(), user_id=user_id)
        db.add(db_plan)
        db.commit()
        db.refresh(db_plan)
        return json.dumps(_serialize(db_plan), default=str)


async def update_plan(args: dict[str, Any]) -> str:
    plan_id = args.get("plan_id")
    if not plan_id:
        raise ValueError("plan_id is required")
    update = PlanUpdate.model_validate({k: v for k, v in args.items() if k != "plan_id"})
    user_id = resolve_user_id()
    with session_scope() as db:
        plan = (
            db.query(Plan)
            .filter(Plan.id == plan_id, Plan.user_id == user_id)
            .first()
        )
        if not plan:
            raise ValueError(f"Plan {plan_id} not found")
        for key, val in update.model_dump(exclude_unset=True).items():
            setattr(plan, key, val)
        db.commit()
        db.refresh(plan)
        return json.dumps(_serialize(plan), default=str)


TOOLS = [
    types.Tool(
        name="get_plans",
        description="List the user's financial plans. Filter by status (planned/in_progress/completed/cancelled).",
        inputSchema={
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "enum": ["planned", "in_progress", "completed", "cancelled"],
                },
            },
        },
    ),
    types.Tool(
        name="create_plan",
        description="Create a new financial plan.",
        inputSchema=pydantic_to_mcp_schema(PlanCreate),
    ),
    types.Tool(
        name="update_plan",
        description="Update an existing plan. Pass plan_id plus the fields to change.",
        inputSchema={
            "type": "object",
            "properties": {
                "plan_id": {"type": "string"},
                **pydantic_to_mcp_schema(PlanUpdate).get("properties", {}),
            },
            "required": ["plan_id"],
        },
    ),
]


HANDLERS = {
    "get_plans": get_plans,
    "create_plan": create_plan,
    "update_plan": update_plan,
}
