from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date

from ..database import get_db
from ..models.plan import Plan, PlanCategory, PlanStatus
from ..models.user import User
from ..schemas.plan import PlanCreate, PlanUpdate, PlanResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.post("/", response_model=PlanResponse, status_code=201)
def create_plan(plan: PlanCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_plan = Plan(**plan.model_dump(), user_id=current_user.id)
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.get("/", response_model=list[PlanResponse])
def list_plans(
    category: PlanCategory | None = None,
    status: PlanStatus | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Plan).filter(Plan.user_id == current_user.id)
    if category:
        query = query.filter(Plan.category == category)
    if status:
        query = query.filter(Plan.status == status)
    if start_date:
        query = query.filter(Plan.start_date >= start_date)
    if end_date:
        query = query.filter(Plan.start_date <= end_date)
    return query.order_by(Plan.start_date).offset(offset).limit(limit).all()


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(plan_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == current_user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.put("/{plan_id}", response_model=PlanResponse)
def update_plan(plan_id: str, plan_update: PlanUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == current_user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    for field, value in plan_update.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/{plan_id}", status_code=204)
def delete_plan(plan_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == current_user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    db.delete(plan)
    db.commit()


@router.patch("/{plan_id}/progress", response_model=PlanResponse)
def update_progress(plan_id: str, progress: int = Query(..., ge=0, le=100), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == current_user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.progress = progress
    if progress == 100:
        plan.status = PlanStatus.completed
    elif progress > 0:
        plan.status = PlanStatus.in_progress
    db.commit()
    db.refresh(plan)
    return plan
