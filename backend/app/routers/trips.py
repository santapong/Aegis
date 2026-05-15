from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.budget import Budget
from ..models.transaction import Transaction, TransactionType
from ..models.trip import Trip, TripStatus
from ..models.user import User
from ..schemas.trip import (
    TripCreate,
    TripUpdate,
    TripResponse,
    TripSummary,
    TripCategoryRollup,
)

router = APIRouter(prefix="/api/trips", tags=["trips"])


@router.post("/", response_model=TripResponse, status_code=201)
def create_trip(
    trip: TripCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_trip = Trip(**trip.model_dump(), user_id=current_user.id)
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip


@router.get("/", response_model=list[TripResponse])
def list_trips(
    status: TripStatus | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Trip).filter(Trip.user_id == current_user.id)
    if status:
        query = query.filter(Trip.status == status)
    return query.order_by(Trip.start_date.desc()).offset(offset).limit(limit).all()


@router.get("/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.put("/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: str,
    update: TripUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(trip, key, val)
    db.commit()
    db.refresh(trip)
    return trip


@router.delete("/{trip_id}", status_code=204)
def delete_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()


@router.get("/{trip_id}/summary", response_model=TripSummary)
def trip_summary(
    trip_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    trip = (
        db.query(Trip)
        .filter(Trip.id == trip_id, Trip.user_id == current_user.id)
        .first()
    )
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    budgets = db.query(Budget).filter(Budget.trip_id == trip_id).all()
    transactions = (
        db.query(Transaction)
        .filter(
            Transaction.trip_id == trip_id,
            Transaction.type == TransactionType.expense,
        )
        .all()
    )

    budgeted_by_category: dict[str, float] = {}
    for b in budgets:
        budgeted_by_category[b.category] = (
            budgeted_by_category.get(b.category, 0) + float(b.amount)
        )

    spent_by_category: dict[str, float] = {}
    for t in transactions:
        spent_by_category[t.category] = (
            spent_by_category.get(t.category, 0) + float(t.amount)
        )

    categories = sorted(set(budgeted_by_category) | set(spent_by_category))
    rollups = [
        TripCategoryRollup(
            category=c,
            budgeted=budgeted_by_category.get(c, 0.0),
            spent=spent_by_category.get(c, 0.0),
        )
        for c in categories
    ]

    return TripSummary(
        trip=TripResponse.model_validate(trip),
        total_budgeted=sum(budgeted_by_category.values()),
        total_spent=sum(spent_by_category.values()),
        by_category=rollups,
        transaction_count=len(transactions),
    )
