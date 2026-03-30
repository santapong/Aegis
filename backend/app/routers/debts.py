from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.debt import Debt
from ..schemas.debt import (
    DebtCreate, DebtUpdate, DebtResponse,
    PayoffPlanResponse, PayoffStep, MakePaymentRequest,
)

router = APIRouter(prefix="/api/debts", tags=["debts"])


@router.get("/", response_model=list[DebtResponse])
def list_debts(
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    return db.query(Debt).order_by(Debt.interest_rate.desc()).limit(limit).all()


@router.post("/", response_model=DebtResponse, status_code=201)
def create_debt(debt: DebtCreate, db: Session = Depends(get_db)):
    db_debt = Debt(**debt.model_dump())
    db.add(db_debt)
    db.commit()
    db.refresh(db_debt)
    return db_debt


@router.get("/payoff-plan", response_model=PayoffPlanResponse)
def get_payoff_plan(
    strategy: str = Query(default="avalanche", regex="^(avalanche|snowball)$"),
    extra_payment: float = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    debts = db.query(Debt).filter(Debt.balance > 0).all()
    if not debts:
        return PayoffPlanResponse(
            strategy=strategy, total_months=0, total_interest=0, total_paid=0, monthly_steps=[]
        )

    # Build working copies
    working = []
    for d in debts:
        working.append({
            "name": d.name,
            "balance": float(d.balance),
            "rate": float(d.interest_rate) / 100 / 12,  # monthly rate
            "min_payment": float(d.minimum_payment),
        })

    # Sort by strategy
    if strategy == "avalanche":
        working.sort(key=lambda d: d["rate"], reverse=True)
    else:  # snowball
        working.sort(key=lambda d: d["balance"])

    total_min = sum(d["min_payment"] for d in working)
    available_extra = extra_payment

    steps = []
    total_interest = 0
    month = 0
    max_months = 360  # 30 year cap

    while any(d["balance"] > 0 for d in working) and month < max_months:
        month += 1
        extra_left = available_extra

        for d in working:
            if d["balance"] <= 0:
                continue

            interest = d["balance"] * d["rate"]
            total_interest += interest
            d["balance"] += interest

            payment = d["min_payment"]
            # Apply extra to highest priority debt
            if extra_left > 0 and d == next((x for x in working if x["balance"] > 0), None):
                payment += extra_left
                extra_left = 0

            payment = min(payment, d["balance"])
            d["balance"] -= payment
            d["balance"] = max(0, round(d["balance"], 2))

            steps.append(PayoffStep(
                month=month,
                debt_name=d["name"],
                payment=round(payment, 2),
                remaining_balance=d["balance"],
                interest_paid=round(interest, 2),
            ))

    total_paid = sum(s.payment for s in steps)

    return PayoffPlanResponse(
        strategy=strategy,
        total_months=month,
        total_interest=round(total_interest, 2),
        total_paid=round(total_paid, 2),
        monthly_steps=steps,
    )


@router.get("/{debt_id}", response_model=DebtResponse)
def get_debt(debt_id: str, db: Session = Depends(get_db)):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    return debt


@router.put("/{debt_id}", response_model=DebtResponse)
def update_debt(debt_id: str, update: DebtUpdate, db: Session = Depends(get_db)):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    for key, val in update.model_dump(exclude_unset=True).items():
        setattr(debt, key, val)
    db.commit()
    db.refresh(debt)
    return debt


@router.post("/{debt_id}/payment", response_model=DebtResponse)
def make_payment(debt_id: str, req: MakePaymentRequest, db: Session = Depends(get_db)):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    debt.balance = max(0, float(debt.balance) - req.amount)
    db.commit()
    db.refresh(debt)
    return debt


@router.delete("/{debt_id}", status_code=204)
def delete_debt(debt_id: str, db: Session = Depends(get_db)):
    debt = db.query(Debt).filter(Debt.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    db.delete(debt)
    db.commit()
