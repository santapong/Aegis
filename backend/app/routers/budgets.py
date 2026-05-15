from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date

from ..database import get_db
from ..models.budget import Budget
from ..models.transaction import Transaction, TransactionType
from ..models.trip import Trip
from ..models.user import User
from ..schemas.budget import (
    BudgetCreate,
    BudgetUpdate,
    BudgetResponse,
    BudgetComparison,
    BudgetComparisonResponse,
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/budgets", tags=["budgets"])


def _validate_trip_ownership(db: Session, trip_id: str | None, user_id: str) -> None:
    if not trip_id:
        return
    exists = (
        db.query(Trip.id)
        .filter(Trip.id == trip_id, Trip.user_id == user_id)
        .first()
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Trip not found")


@router.post("/", response_model=BudgetResponse, status_code=201)
def create_budget(budget: BudgetCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _validate_trip_ownership(db, budget.trip_id, current_user.id)
    db_budget = Budget(**budget.model_dump(), user_id=current_user.id)
    db.add(db_budget)
    db.commit()
    db.refresh(db_budget)
    return db_budget


@router.get("/", response_model=list[BudgetResponse])
def list_budgets(
    category: str | None = None,
    active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Budget).filter(Budget.user_id == current_user.id)
    if category:
        query = query.filter(Budget.category == category)
    if active is True:
        today = date.today()
        query = query.filter(Budget.period_start <= today, Budget.period_end >= today)
    return query.order_by(Budget.period_start.desc()).all()


@router.get("/comparison", response_model=BudgetComparisonResponse)
def budget_comparison(
    period_start: date | None = None,
    period_end: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    if not period_start:
        period_start = today.replace(day=1)
    if not period_end:
        period_end = today

    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id)
        .filter(Budget.period_start <= period_end, Budget.period_end >= period_start)
        .all()
    )

    expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= period_start,
            Transaction.date <= period_end,
        )
        .all()
    )

    spent_by_category: dict[str, float] = {}
    for t in expenses:
        spent_by_category[t.category] = spent_by_category.get(t.category, 0) + float(t.amount)

    comparisons = []
    for b in budgets:
        actual = spent_by_category.get(b.category, 0)
        remaining = float(b.amount) - actual
        usage = (actual / float(b.amount) * 100) if float(b.amount) > 0 else 0
        comparisons.append(
            BudgetComparison(
                category=b.category,
                budget_amount=float(b.amount),
                actual_spent=actual,
                remaining=remaining,
                usage_percent=round(usage, 1),
                over_budget=actual > float(b.amount),
            )
        )

    total_budgeted = sum(float(b.amount) for b in budgets)
    total_spent = sum(c.actual_spent for c in comparisons)

    return BudgetComparisonResponse(
        period_start=period_start,
        period_end=period_end,
        comparisons=comparisons,
        total_budgeted=total_budgeted,
        total_spent=total_spent,
    )


@router.get("/{budget_id}", response_model=BudgetResponse)
def get_budget(budget_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return budget


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(budget_id: str, data: BudgetUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    update_data = data.model_dump(exclude_unset=True)
    if "trip_id" in update_data:
        _validate_trip_ownership(db, update_data["trip_id"], current_user.id)
    for key, val in update_data.items():
        setattr(budget, key, val)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == current_user.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
