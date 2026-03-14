from __future__ import annotations

from datetime import date
from typing import Optional

from litestar import Controller, get, post, put, delete
from litestar.params import Parameter
from pydantic import BaseModel

from database.connection import SessionLocal
from database.models import Goal, Milestone


class GoalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: float = 0.0
    start_date: date
    end_date: date
    color: str = "#3b82f6"


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    color: Optional[str] = None
    status: Optional[str] = None


class MilestoneCreate(BaseModel):
    goal_id: int
    name: str
    target_amount: Optional[float] = None
    start_date: date
    end_date: date


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    progress: Optional[float] = None


def _goal_to_dict(goal: Goal) -> dict:
    return {
        "id": goal.id,
        "name": goal.name,
        "description": goal.description,
        "target_amount": goal.target_amount,
        "current_amount": goal.current_amount,
        "start_date": goal.start_date.isoformat(),
        "end_date": goal.end_date.isoformat(),
        "color": goal.color,
        "status": goal.status,
        "created_at": goal.created_at.isoformat() if goal.created_at else None,
        "milestones": [_milestone_to_dict(m) for m in goal.milestones],
    }


def _milestone_to_dict(m: Milestone) -> dict:
    return {
        "id": m.id,
        "goal_id": m.goal_id,
        "name": m.name,
        "target_amount": m.target_amount,
        "start_date": m.start_date.isoformat(),
        "end_date": m.end_date.isoformat(),
        "status": m.status,
        "progress": m.progress,
    }


class GoalController(Controller):
    path = "/api/goals"

    @get("/")
    async def list_goals(self) -> list[dict]:
        db = SessionLocal()
        try:
            goals = db.query(Goal).order_by(Goal.start_date).all()
            return [_goal_to_dict(g) for g in goals]
        finally:
            db.close()

    @post("/")
    async def create_goal(self, data: GoalCreate) -> dict:
        db = SessionLocal()
        try:
            goal = Goal(
                name=data.name,
                description=data.description,
                target_amount=data.target_amount,
                current_amount=data.current_amount,
                start_date=data.start_date,
                end_date=data.end_date,
                color=data.color,
            )
            db.add(goal)
            db.commit()
            db.refresh(goal)
            return _goal_to_dict(goal)
        finally:
            db.close()

    @get("/{goal_id:int}")
    async def get_goal(self, goal_id: int) -> dict:
        db = SessionLocal()
        try:
            goal = db.query(Goal).filter(Goal.id == goal_id).first()
            if not goal:
                return {"error": "Goal not found"}
            return _goal_to_dict(goal)
        finally:
            db.close()

    @put("/{goal_id:int}")
    async def update_goal(self, goal_id: int, data: GoalUpdate) -> dict:
        db = SessionLocal()
        try:
            goal = db.query(Goal).filter(Goal.id == goal_id).first()
            if not goal:
                return {"error": "Goal not found"}
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(goal, field, value)
            db.commit()
            db.refresh(goal)
            return _goal_to_dict(goal)
        finally:
            db.close()

    @delete("/{goal_id:int}", status_code=200)
    async def delete_goal(self, goal_id: int) -> dict:
        db = SessionLocal()
        try:
            goal = db.query(Goal).filter(Goal.id == goal_id).first()
            if not goal:
                return {"error": "Goal not found"}
            db.delete(goal)
            db.commit()
            return {"message": "Goal deleted"}
        finally:
            db.close()


class MilestoneController(Controller):
    path = "/api/milestones"

    @post("/")
    async def create_milestone(self, data: MilestoneCreate) -> dict:
        db = SessionLocal()
        try:
            milestone = Milestone(
                goal_id=data.goal_id,
                name=data.name,
                target_amount=data.target_amount,
                start_date=data.start_date,
                end_date=data.end_date,
            )
            db.add(milestone)
            db.commit()
            db.refresh(milestone)
            return _milestone_to_dict(milestone)
        finally:
            db.close()

    @put("/{milestone_id:int}")
    async def update_milestone(self, milestone_id: int, data: MilestoneUpdate) -> dict:
        db = SessionLocal()
        try:
            m = db.query(Milestone).filter(Milestone.id == milestone_id).first()
            if not m:
                return {"error": "Milestone not found"}
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(m, field, value)
            db.commit()
            db.refresh(m)
            return _milestone_to_dict(m)
        finally:
            db.close()

    @delete("/{milestone_id:int}", status_code=200)
    async def delete_milestone(self, milestone_id: int) -> dict:
        db = SessionLocal()
        try:
            m = db.query(Milestone).filter(Milestone.id == milestone_id).first()
            if not m:
                return {"error": "Milestone not found"}
            db.delete(m)
            db.commit()
            return {"message": "Milestone deleted"}
        finally:
            db.close()
