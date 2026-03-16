from __future__ import annotations

from datetime import date
from typing import Optional

from litestar import Controller, get
from litestar.params import Parameter
from sqlalchemy import extract, func

from database.connection import SessionLocal
from database.models import BudgetEntry, Goal, Debt, SavingsJar


class ReportsController(Controller):
    path = "/api/reports"

    @get("/monthly-trend")
    async def monthly_trend(
        self,
        months: int = Parameter(query="months", default=6),
    ) -> list[dict]:
        db = SessionLocal()
        try:
            today = date.today()
            results = []

            for i in range(months - 1, -1, -1):
                # Calculate target month
                target_month = today.month - i
                target_year = today.year
                while target_month <= 0:
                    target_month += 12
                    target_year -= 1

                entries = (
                    db.query(BudgetEntry)
                    .filter(
                        extract("year", BudgetEntry.date) == target_year,
                        extract("month", BudgetEntry.date) == target_month,
                    )
                    .all()
                )

                income = sum(e.amount for e in entries if e.entry_type == "income")
                expenses = sum(e.amount for e in entries if e.entry_type == "expense")

                results.append({
                    "month": f"{target_year}-{target_month:02d}",
                    "income": income,
                    "expenses": expenses,
                    "net": income - expenses,
                })

            return results
        finally:
            db.close()

    @get("/category-breakdown")
    async def category_breakdown(
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
                    BudgetEntry.entry_type == "expense",
                )
                .all()
            )

            by_category: dict[str, float] = {}
            for e in entries:
                by_category[e.category] = by_category.get(e.category, 0) + e.amount

            total = sum(by_category.values())
            breakdown = []
            for cat, amount in sorted(by_category.items(), key=lambda x: -x[1]):
                breakdown.append({
                    "category": cat,
                    "amount": amount,
                    "percentage": round(amount / total * 100, 1) if total > 0 else 0,
                })

            return {"month": month, "total": total, "breakdown": breakdown}
        finally:
            db.close()

    @get("/yearly-summary")
    async def yearly_summary(
        self,
        year: int = Parameter(query="year"),
    ) -> dict:
        db = SessionLocal()
        try:
            months = []
            total_income = 0.0
            total_expenses = 0.0
            best_month = None
            worst_month = None

            for mon in range(1, 13):
                entries = (
                    db.query(BudgetEntry)
                    .filter(
                        extract("year", BudgetEntry.date) == year,
                        extract("month", BudgetEntry.date) == mon,
                    )
                    .all()
                )

                income = sum(e.amount for e in entries if e.entry_type == "income")
                expenses = sum(e.amount for e in entries if e.entry_type == "expense")
                net = income - expenses
                total_income += income
                total_expenses += expenses

                month_data = {
                    "month": f"{year}-{mon:02d}",
                    "income": income,
                    "expenses": expenses,
                    "net": net,
                }
                months.append(month_data)

                if income > 0 or expenses > 0:
                    if best_month is None or net > best_month["net"]:
                        best_month = month_data
                    if worst_month is None or net < worst_month["net"]:
                        worst_month = month_data

            return {
                "year": year,
                "months": months,
                "total_income": total_income,
                "total_expenses": total_expenses,
                "total_net": total_income - total_expenses,
                "best_month": best_month,
                "worst_month": worst_month,
            }
        finally:
            db.close()

    @get("/net-worth")
    async def net_worth(self) -> dict:
        db = SessionLocal()
        try:
            savings_total = db.query(func.coalesce(func.sum(SavingsJar.current_amount), 0)).scalar()
            goals_total = db.query(func.coalesce(func.sum(Goal.current_amount), 0)).scalar()
            debt_total = db.query(
                func.coalesce(func.sum(Debt.current_balance), 0)
            ).filter(Debt.status == "active").scalar()

            assets = float(savings_total) + float(goals_total)
            liabilities = float(debt_total)

            return {
                "net_worth": assets - liabilities,
                "assets": assets,
                "liabilities": liabilities,
                "savings_total": float(savings_total),
                "goals_total": float(goals_total),
                "debt_total": liabilities,
            }
        finally:
            db.close()
