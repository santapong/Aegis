from __future__ import annotations

from datetime import date, timedelta
from typing import Optional
from calendar import monthrange

from litestar import Controller, get, post, put, delete
from litestar.params import Parameter
from pydantic import BaseModel

from database.connection import SessionLocal
from database.models import BillReminder


class BillReminderCreate(BaseModel):
    name: str
    amount: float
    category: Optional[str] = None
    due_day: int
    frequency: str = "monthly"
    is_active: str = "true"
    next_due_date: Optional[date] = None
    notes: Optional[str] = None


class BillReminderUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    due_day: Optional[int] = None
    frequency: Optional[str] = None
    is_active: Optional[str] = None
    next_due_date: Optional[date] = None
    notes: Optional[str] = None


def _bill_to_dict(bill: BillReminder) -> dict:
    return {
        "id": bill.id,
        "name": bill.name,
        "amount": bill.amount,
        "category": bill.category,
        "due_day": bill.due_day,
        "frequency": bill.frequency,
        "is_active": bill.is_active,
        "last_paid_date": bill.last_paid_date.isoformat() if bill.last_paid_date else None,
        "next_due_date": bill.next_due_date.isoformat() if bill.next_due_date else None,
        "notes": bill.notes,
        "created_at": bill.created_at.isoformat() if bill.created_at else None,
    }


def _calculate_next_due_date(due_day: int, from_date: date) -> date:
    """Find the next occurrence of due_day from the given date."""
    # Clamp due_day to the max days in the current month
    _, max_day = monthrange(from_date.year, from_date.month)
    clamped_day = min(due_day, max_day)

    if from_date.day <= clamped_day:
        # Use this month
        return from_date.replace(day=clamped_day)
    else:
        # Use next month
        if from_date.month == 12:
            next_year = from_date.year + 1
            next_month = 1
        else:
            next_year = from_date.year
            next_month = from_date.month + 1
        _, max_day_next = monthrange(next_year, next_month)
        clamped_day_next = min(due_day, max_day_next)
        return date(next_year, next_month, clamped_day_next)


def _advance_due_date(current_due: date, frequency: str, due_day: int) -> date:
    """Advance next_due_date based on frequency."""
    if frequency == "quarterly":
        months_ahead = 3
    elif frequency == "yearly":
        months_ahead = 12
    else:
        months_ahead = 1

    new_month = current_due.month + months_ahead
    new_year = current_due.year + (new_month - 1) // 12
    new_month = (new_month - 1) % 12 + 1
    _, max_day = monthrange(new_year, new_month)
    clamped_day = min(due_day, max_day)
    return date(new_year, new_month, clamped_day)


class BillController(Controller):
    path = "/api/bills"

    @get("/")
    async def list_bills(self) -> list[dict]:
        db = SessionLocal()
        try:
            bills = (
                db.query(BillReminder)
                .order_by(BillReminder.next_due_date)
                .all()
            )
            return [_bill_to_dict(b) for b in bills]
        finally:
            db.close()

    @post("/")
    async def create_bill(self, data: BillReminderCreate) -> dict:
        db = SessionLocal()
        try:
            next_due = data.next_due_date
            if next_due is None:
                next_due = _calculate_next_due_date(data.due_day, date.today())

            bill = BillReminder(
                name=data.name,
                amount=data.amount,
                category=data.category,
                due_day=data.due_day,
                frequency=data.frequency,
                is_active=data.is_active,
                next_due_date=next_due,
                notes=data.notes,
            )
            db.add(bill)
            db.commit()
            db.refresh(bill)
            return _bill_to_dict(bill)
        finally:
            db.close()

    @get("/{bill_id:int}")
    async def get_bill(self, bill_id: int) -> dict:
        db = SessionLocal()
        try:
            bill = db.query(BillReminder).filter(BillReminder.id == bill_id).first()
            if not bill:
                return {"error": "Bill not found"}
            return _bill_to_dict(bill)
        finally:
            db.close()

    @put("/{bill_id:int}")
    async def update_bill(self, bill_id: int, data: BillReminderUpdate) -> dict:
        db = SessionLocal()
        try:
            bill = db.query(BillReminder).filter(BillReminder.id == bill_id).first()
            if not bill:
                return {"error": "Bill not found"}
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(bill, field, value)
            db.commit()
            db.refresh(bill)
            return _bill_to_dict(bill)
        finally:
            db.close()

    @delete("/{bill_id:int}", status_code=200)
    async def delete_bill(self, bill_id: int) -> dict:
        db = SessionLocal()
        try:
            bill = db.query(BillReminder).filter(BillReminder.id == bill_id).first()
            if not bill:
                return {"error": "Bill not found"}
            db.delete(bill)
            db.commit()
            return {"message": "Bill deleted"}
        finally:
            db.close()

    @post("/{bill_id:int}/pay")
    async def pay_bill(self, bill_id: int) -> dict:
        db = SessionLocal()
        try:
            bill = db.query(BillReminder).filter(BillReminder.id == bill_id).first()
            if not bill:
                return {"error": "Bill not found"}

            today = date.today()
            bill.last_paid_date = today

            if bill.next_due_date:
                bill.next_due_date = _advance_due_date(
                    bill.next_due_date, bill.frequency, bill.due_day
                )
            else:
                bill.next_due_date = _advance_due_date(
                    today, bill.frequency, bill.due_day
                )

            db.commit()
            db.refresh(bill)
            return _bill_to_dict(bill)
        finally:
            db.close()

    @get("/upcoming")
    async def get_upcoming(
        self,
        days: int = Parameter(query="days", default=30),
    ) -> list[dict]:
        db = SessionLocal()
        try:
            today = date.today()
            future_date = today + timedelta(days=days)
            bills = (
                db.query(BillReminder)
                .filter(
                    BillReminder.next_due_date != None,
                    BillReminder.next_due_date <= future_date,
                )
                .order_by(BillReminder.next_due_date)
                .all()
            )
            results = []
            for b in bills:
                d = _bill_to_dict(b)
                d["is_overdue"] = b.next_due_date < today if b.next_due_date else False
                results.append(d)
            return results
        finally:
            db.close()

    @get("/summary")
    async def get_summary(self) -> dict:
        db = SessionLocal()
        try:
            today = date.today()
            bills = db.query(BillReminder).all()

            monthly_total = sum(
                b.amount for b in bills
                if b.frequency == "monthly" and b.is_active == "true"
            )
            active_count = sum(1 for b in bills if b.is_active == "true")
            overdue_count = sum(
                1 for b in bills
                if b.next_due_date and b.next_due_date < today and b.is_active == "true"
            )

            upcoming_bills = [
                b for b in bills
                if b.next_due_date and b.next_due_date >= today and b.is_active == "true"
            ]
            upcoming_bills.sort(key=lambda b: b.next_due_date)

            next_bill = None
            if upcoming_bills:
                nb = upcoming_bills[0]
                next_bill = {
                    "name": nb.name,
                    "next_due_date": nb.next_due_date.isoformat(),
                }

            return {
                "monthly_total": monthly_total,
                "active_count": active_count,
                "overdue_count": overdue_count,
                "next_bill": next_bill,
            }
        finally:
            db.close()
