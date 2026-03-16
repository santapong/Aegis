from __future__ import annotations

from datetime import date
from typing import Optional

from litestar import Controller, get, post, put, delete
from litestar.params import Parameter
from pydantic import BaseModel
from sqlalchemy import extract

from database.connection import SessionLocal
from database.models import BudgetEntry


INCOME_CATEGORIES = [
    "salary", "freelance", "investment", "gift", "refund", "side_hustle", "other_income"
]
EXPENSE_CATEGORIES = [
    "food", "transport", "housing", "utilities", "entertainment", "shopping",
    "healthcare", "education", "insurance", "travel", "subscriptions",
    "personal_care", "gifts_donations", "other_expense"
]


class BudgetEntryCreate(BaseModel):
    entry_type: str
    amount: float
    category: str
    description: Optional[str] = None
    date: date
    is_recurring: Optional[str] = None


class BudgetEntryUpdate(BaseModel):
    entry_type: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[date] = None
    is_recurring: Optional[str] = None


def _entry_to_dict(entry: BudgetEntry) -> dict:
    return {
        "id": entry.id,
        "entry_type": entry.entry_type,
        "amount": entry.amount,
        "category": entry.category,
        "description": entry.description,
        "date": entry.date.isoformat(),
        "is_recurring": entry.is_recurring,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


class BudgetController(Controller):
    path = "/api/budget"

    @get("/")
    async def list_entries(
        self,
        month: Optional[str] = Parameter(query="month", default=None),
        entry_type: Optional[str] = Parameter(query="entry_type", default=None),
        category: Optional[str] = Parameter(query="category", default=None),
    ) -> list[dict]:
        db = SessionLocal()
        try:
            query = db.query(BudgetEntry)
            if month:
                year, mon = map(int, month.split("-"))
                query = query.filter(
                    extract("year", BudgetEntry.date) == year,
                    extract("month", BudgetEntry.date) == mon,
                )
            if entry_type and entry_type in ("income", "expense"):
                query = query.filter(BudgetEntry.entry_type == entry_type)
            if category:
                query = query.filter(BudgetEntry.category == category)
            entries = query.order_by(BudgetEntry.date.desc(), BudgetEntry.id.desc()).all()
            return [_entry_to_dict(e) for e in entries]
        finally:
            db.close()

    @post("/")
    async def create_entry(self, data: BudgetEntryCreate) -> dict:
        db = SessionLocal()
        try:
            entry = BudgetEntry(
                entry_type=data.entry_type,
                amount=data.amount,
                category=data.category,
                description=data.description,
                date=data.date,
                is_recurring=data.is_recurring,
            )
            db.add(entry)
            db.commit()
            db.refresh(entry)
            return _entry_to_dict(entry)
        finally:
            db.close()

    @put("/{entry_id:int}")
    async def update_entry(self, entry_id: int, data: BudgetEntryUpdate) -> dict:
        db = SessionLocal()
        try:
            entry = db.query(BudgetEntry).filter(BudgetEntry.id == entry_id).first()
            if not entry:
                return {"error": "Entry not found"}
            for field, value in data.model_dump(exclude_unset=True).items():
                setattr(entry, field, value)
            db.commit()
            db.refresh(entry)
            return _entry_to_dict(entry)
        finally:
            db.close()

    @delete("/{entry_id:int}", status_code=200)
    async def delete_entry(self, entry_id: int) -> dict:
        db = SessionLocal()
        try:
            entry = db.query(BudgetEntry).filter(BudgetEntry.id == entry_id).first()
            if not entry:
                return {"error": "Entry not found"}
            db.delete(entry)
            db.commit()
            return {"message": "Entry deleted"}
        finally:
            db.close()

    @get("/summary")
    async def get_summary(
        self,
        month: str = Parameter(query="month"),
    ) -> dict:
        db = SessionLocal()
        try:
            year, mon = map(int, month.split("-"))
            entries = (
                db.query(BudgetEntry)
                .filter(
                    extract("year", BudgetEntry.date) == year,
                    extract("month", BudgetEntry.date) == mon,
                )
                .all()
            )

            total_income = sum(e.amount for e in entries if e.entry_type == "income")
            total_expenses = sum(e.amount for e in entries if e.entry_type == "expense")
            net_savings = total_income - total_expenses
            savings_rate = (net_savings / total_income * 100) if total_income > 0 else 0.0

            income_by_category: dict[str, float] = {}
            expense_by_category: dict[str, float] = {}
            for e in entries:
                if e.entry_type == "income":
                    income_by_category[e.category] = income_by_category.get(e.category, 0) + e.amount
                else:
                    expense_by_category[e.category] = expense_by_category.get(e.category, 0) + e.amount

            return {
                "month": month,
                "total_income": total_income,
                "total_expenses": total_expenses,
                "net_savings": net_savings,
                "savings_rate": round(savings_rate, 1),
                "income_by_category": income_by_category,
                "expense_by_category": expense_by_category,
                "entry_count": len(entries),
            }
        finally:
            db.close()

    @get("/categories")
    async def get_categories(self) -> dict:
        return {
            "income": INCOME_CATEGORIES,
            "expense": EXPENSE_CATEGORIES,
        }
