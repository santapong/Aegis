from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.savings_goal import SavingsGoal
from ..schemas.savings_goal import (
    SavingsGoalCreate, SavingsGoalUpdate, SavingsGoalResponse, ContributeRequest,
)

router = APIRouter(prefix="/api/savings-goals", tags=["savings-goals"])


@router.get("/", response_model=list[SavingsGoalResponse])
def list_savings_goals(
    category: str | None = None,
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(SavingsGoal)
    if category:
        query = query.filter(SavingsGoal.category == category)
    return query.order_by(SavingsGoal.created_at.desc()).limit(limit).all()


@router.post("/", response_model=SavingsGoalResponse, status_code=201)
def create_savings_goal(goal: SavingsGoalCreate, db: Session = Depends(get_db)):
    db_goal = SavingsGoal(**goal.model_dump())
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal


@router.get("/{goal_id}", response_model=SavingsGoalResponse)
def get_savings_goal(goal_id: str, db: Session = Depends(get_db)):
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    return goal


@router.put("/{goal_id}", response_model=SavingsGoalResponse)
def update_savings_goal(goal_id: str, update: SavingsGoalUpdate, db: Session = Depends(get_db)):
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(goal, key, val)
    db.commit()
    db.refresh(goal)
    return goal


@router.post("/{goal_id}/contribute", response_model=SavingsGoalResponse)
def contribute_to_goal(goal_id: str, req: ContributeRequest, db: Session = Depends(get_db)):
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    goal.current_amount = float(goal.current_amount) + req.amount
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_savings_goal(goal_id: str, db: Session = Depends(get_db)):
    goal = db.query(SavingsGoal).filter(SavingsGoal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    db.delete(goal)
    db.commit()
