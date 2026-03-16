from __future__ import annotations

from datetime import date, timedelta
from calendar import monthrange

from litestar import Controller, get
from litestar.params import Parameter
from sqlalchemy import extract

from database.connection import SessionLocal
from database.models import BudgetEntry


def _entry_to_event(entry: BudgetEntry, projected: bool = False) -> dict:
    return {
        "id": entry.id,
        "entry_type": entry.entry_type,
        "amount": entry.amount,
        "category": entry.category,
        "description": entry.description,
        "date": entry.date.isoformat(),
        "is_recurring": entry.is_recurring,
        "projected": projected,
    }


def _project_recurring(entry: BudgetEntry, year: int, month: int) -> list[dict]:
    """Generate projected occurrences of a recurring entry for the given month."""
    events = []
    entry_date = entry.date
    _, days_in_month = monthrange(year, month)

    if entry.is_recurring == "daily":
        for day in range(1, days_in_month + 1):
            d = date(year, month, day)
            if d > entry_date or d == entry_date:
                evt = _entry_to_event(entry, projected=True)
                evt["date"] = d.isoformat()
                events.append(evt)

    elif entry.is_recurring == "weekly":
        # Find first occurrence in this month matching the same weekday
        first_of_month = date(year, month, 1)
        target_weekday = entry_date.weekday()
        # Find the first matching weekday in the month
        days_ahead = (target_weekday - first_of_month.weekday()) % 7
        current = first_of_month + timedelta(days=days_ahead)
        while current.month == month:
            if current >= entry_date:
                evt = _entry_to_event(entry, projected=True)
                evt["date"] = current.isoformat()
                events.append(evt)
            current += timedelta(days=7)

    elif entry.is_recurring == "monthly":
        # Same day of month as the original entry
        day = min(entry_date.day, days_in_month)
        target = date(year, month, day)
        if target >= entry_date:
            evt = _entry_to_event(entry, projected=True)
            evt["date"] = target.isoformat()
            events.append(evt)

    elif entry.is_recurring == "yearly":
        if entry_date.month == month:
            day = min(entry_date.day, days_in_month)
            target = date(year, month, day)
            if target >= entry_date:
                evt = _entry_to_event(entry, projected=True)
                evt["date"] = target.isoformat()
                events.append(evt)

    return events


class CalendarController(Controller):
    path = "/api/calendar"

    @get("/events")
    async def get_events(
        self,
        month: str = Parameter(query="month"),
    ) -> list[dict]:
        """Get all calendar events for a month, including projected recurring entries."""
        db = SessionLocal()
        try:
            year, mon = map(int, month.split("-"))

            # 1. Actual entries for this month
            actual_entries = (
                db.query(BudgetEntry)
                .filter(
                    extract("year", BudgetEntry.date) == year,
                    extract("month", BudgetEntry.date) == mon,
                )
                .order_by(BudgetEntry.date)
                .all()
            )

            actual_ids = {e.id for e in actual_entries}
            events = [_entry_to_event(e, projected=False) for e in actual_entries]

            # 2. Recurring entries from previous months - project them into this month
            recurring_entries = (
                db.query(BudgetEntry)
                .filter(
                    BudgetEntry.is_recurring.isnot(None),
                    BudgetEntry.date < date(year, mon, 1),
                )
                .all()
            )

            for entry in recurring_entries:
                if entry.id not in actual_ids:
                    projected = _project_recurring(entry, year, mon)
                    events.extend(projected)

            # Sort by date
            events.sort(key=lambda e: e["date"])
            return events
        finally:
            db.close()

    @get("/summary")
    async def get_monthly_summary(
        self,
        month: str = Parameter(query="month"),
    ) -> dict:
        """Get summary counts for the calendar month."""
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

            recurring_entries = (
                db.query(BudgetEntry)
                .filter(
                    BudgetEntry.is_recurring.isnot(None),
                    BudgetEntry.date < date(year, mon, 1),
                )
                .all()
            )

            projected_count = 0
            projected_expense = 0.0
            projected_income = 0.0
            for entry in recurring_entries:
                projections = _project_recurring(entry, year, mon)
                projected_count += len(projections)
                for p in projections:
                    if p["entry_type"] == "expense":
                        projected_expense += p["amount"]
                    else:
                        projected_income += p["amount"]

            actual_income = sum(e.amount for e in entries if e.entry_type == "income")
            actual_expense = sum(e.amount for e in entries if e.entry_type == "expense")

            return {
                "month": month,
                "actual_entries": len(entries),
                "projected_recurring": projected_count,
                "total_events": len(entries) + projected_count,
                "actual_income": actual_income,
                "actual_expense": actual_expense,
                "projected_income": projected_income,
                "projected_expense": projected_expense,
                "total_income": actual_income + projected_income,
                "total_expense": actual_expense + projected_expense,
            }
        finally:
            db.close()
