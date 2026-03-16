from __future__ import annotations

from datetime import date
from typing import Optional

from litestar import Controller, get, post, put, delete
from litestar.params import Parameter
from pydantic import BaseModel

from database.connection import SessionLocal
from database.models import Debt


class DebtCreate(BaseModel):
    name: str
    creditor: Optional[str] = None
    principal: float
    interest_rate: float = 0.0
    minimum_payment: float = 0.0
    current_balance: float
    due_day: Optional[int] = None
    start_date: date
    color: str = "#ef4444"


class DebtUpdate(BaseModel):
    name: Optional[str] = None
    creditor: Optional[str] = None
    principal: Optional[float] = None
    interest_rate: Optional[float] = None
    minimum_payment: Optional[float] = None
    current_balance: Optional[float] = None
    due_day: Optional[int] = None
    start_date: Optional[date] = None
    color: Optional[str] = None


def _debt_to_dict(debt: Debt) -> dict:
    return {
        "id": debt.id,
        "name": debt.name,
        "creditor": debt.creditor,
        "principal": debt.principal,
        "interest_rate": debt.interest_rate,
        "minimum_payment": debt.minimum_payment,
        "current_balance": debt.current_balance,
        "due_day": debt.due_day,
        "start_date": debt.start_date.isoformat(),
        "status": debt.status,
        "color": debt.color,
        "created_at": debt.created_at.isoformat() if debt.created_at else None,
    }


class DebtController(Controller):
    path = "/api/debts"

    @get("/")
    async def list_debts(self) -> list[dict]:
        db = SessionLocal()
        try:
            debts = db.query(Debt).order_by(Debt.current_balance.desc()).all()
            return [_debt_to_dict(d) for d in debts]
        finally:
            db.close()

    @post("/")
    async def create_debt(self, data: DebtCreate) -> dict:
        db = SessionLocal()
        try:
            debt = Debt(
                name=data.name,
                creditor=data.creditor,
                principal=data.principal,
                interest_rate=data.interest_rate,
                minimum_payment=data.minimum_payment,
                current_balance=data.current_balance,
                due_day=data.due_day,
                start_date=data.start_date,
                color=data.color,
            )
            db.add(debt)
            db.commit()
            db.refresh(debt)
            return _debt_to_dict(debt)
        finally:
            db.close()

    @get("/{debt_id:int}")
    async def get_debt(self, debt_id: int) -> dict:
        db = SessionLocal()
        try:
            debt = db.query(Debt).filter(Debt.id == debt_id).first()
            if not debt:
                return {"error": "Debt not found"}
            return _debt_to_dict(debt)
        finally:
            db.close()

    @put("/{debt_id:int}")
    async def update_debt(self, debt_id: int, data: DebtUpdate) -> dict:
        db = SessionLocal()
        try:
            debt = db.query(Debt).filter(Debt.id == debt_id).first()
            if not debt:
                return {"error": "Debt not found"}
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(debt, field, value)
            db.commit()
            db.refresh(debt)
            return _debt_to_dict(debt)
        finally:
            db.close()

    @delete("/{debt_id:int}", status_code=200)
    async def delete_debt(self, debt_id: int) -> dict:
        db = SessionLocal()
        try:
            debt = db.query(Debt).filter(Debt.id == debt_id).first()
            if not debt:
                return {"error": "Debt not found"}
            db.delete(debt)
            db.commit()
            return {"message": "Debt deleted"}
        finally:
            db.close()

    @get("/summary")
    async def get_summary(self) -> dict:
        db = SessionLocal()
        try:
            debts = db.query(Debt).all()

            total_debt = sum(d.current_balance for d in debts)
            total_minimum_payment = sum(d.minimum_payment for d in debts)
            debt_count = len(debts)

            if total_debt > 0:
                weighted_avg_rate = sum(
                    d.interest_rate * d.current_balance for d in debts
                ) / total_debt
            else:
                weighted_avg_rate = 0.0

            if total_minimum_payment > 0:
                estimated_payoff_months = round(total_debt / total_minimum_payment, 1)
            else:
                estimated_payoff_months = None

            return {
                "total_debt": total_debt,
                "total_minimum_payment": total_minimum_payment,
                "weighted_avg_rate": round(weighted_avg_rate, 2),
                "debt_count": debt_count,
                "estimated_payoff_months": estimated_payoff_months,
            }
        finally:
            db.close()

    @get("/payoff-plan")
    async def get_payoff_plan(
        self,
        strategy: str = Parameter(query="strategy", default="avalanche"),
        extra: float = Parameter(query="extra", default=0.0),
    ) -> dict:
        db = SessionLocal()
        try:
            all_debts = db.query(Debt).all()

            # Build working list of debt balances
            working = []
            for d in all_debts:
                working.append({
                    "id": d.id,
                    "name": d.name,
                    "balance": float(d.current_balance),
                    "rate": float(d.interest_rate),
                    "minimum_payment": float(d.minimum_payment),
                    "payoff_month": None,
                })

            # Sort based on strategy
            if strategy == "snowball":
                working.sort(key=lambda x: x["balance"])
            else:
                # avalanche: highest rate first
                working.sort(key=lambda x: x["rate"], reverse=True)

            timeline = []
            total_interest_paid = 0.0
            month = 0
            max_months = 360

            # Record month 0
            total_remaining = sum(w["balance"] for w in working)
            timeline.append({
                "month": 0,
                "total_remaining": round(total_remaining, 2),
                "payments": [
                    {
                        "debt_id": w["id"],
                        "name": w["name"],
                        "balance": round(w["balance"], 2),
                        "payment": 0.0,
                        "interest": 0.0,
                    }
                    for w in working
                ],
            })

            while month < max_months:
                # Check if all debts are paid off
                if all(w["balance"] <= 0 for w in working):
                    break

                month += 1
                month_payments = []
                extra_remaining = extra

                # Apply interest to all debts
                for w in working:
                    if w["balance"] <= 0:
                        continue
                    interest = w["balance"] * w["rate"] / 12.0 / 100.0
                    w["balance"] += interest
                    total_interest_paid += interest
                    w["_interest"] = interest

                # Apply minimum payments to all debts
                for w in working:
                    if w["balance"] <= 0:
                        w["_payment"] = 0.0
                        w.setdefault("_interest", 0.0)
                        continue
                    payment = min(w["minimum_payment"], w["balance"])
                    w["balance"] -= payment
                    w["_payment"] = payment
                    if w["balance"] <= 0:
                        w["balance"] = 0.0
                        if w["payoff_month"] is None:
                            w["payoff_month"] = month

                # Apply extra payment to target debt (first unpaid in sorted order)
                for w in working:
                    if extra_remaining <= 0:
                        break
                    if w["balance"] <= 0:
                        continue
                    apply = min(extra_remaining, w["balance"])
                    w["balance"] -= apply
                    w["_payment"] += apply
                    extra_remaining -= apply
                    if w["balance"] <= 0:
                        w["balance"] = 0.0
                        if w["payoff_month"] is None:
                            w["payoff_month"] = month

                total_remaining = sum(w["balance"] for w in working)

                month_entry = {
                    "month": month,
                    "total_remaining": round(total_remaining, 2),
                    "payments": [
                        {
                            "debt_id": w["id"],
                            "name": w["name"],
                            "balance": round(w["balance"], 2),
                            "payment": round(w.get("_payment", 0.0), 2),
                            "interest": round(w.get("_interest", 0.0), 2),
                        }
                        for w in working
                    ],
                }

                # Include in timeline: every 6 months or the final month
                all_paid = all(w["balance"] <= 0 for w in working)
                if month % 6 == 0 or all_paid or total_remaining <= 0:
                    timeline.append(month_entry)

                # Clean up temp keys
                for w in working:
                    w.pop("_interest", None)
                    w.pop("_payment", None)

                if all_paid or total_remaining <= 0:
                    break

            return {
                "strategy": strategy,
                "extra_payment": extra,
                "total_months": month,
                "total_interest_paid": round(total_interest_paid, 2),
                "debts": [
                    {
                        "id": w["id"],
                        "name": w["name"],
                        "payoff_month": w["payoff_month"],
                    }
                    for w in working
                ],
                "timeline": timeline,
            }
        finally:
            db.close()
