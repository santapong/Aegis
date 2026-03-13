from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ..database import get_db
from ..models.plan import Plan, PlanStatus
from ..models.transaction import Transaction, TransactionType
from ..schemas.dashboard import KPISummary, DashboardCharts, ChartDataPoint

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

CATEGORY_COLORS = {
    "food": "#EF4444",
    "transport": "#F59E0B",
    "housing": "#3B82F6",
    "entertainment": "#8B5CF6",
    "utilities": "#06B6D4",
    "healthcare": "#10B981",
    "education": "#EC4899",
    "savings": "#22C55E",
    "investment": "#6366F1",
    "other": "#6B7280",
}


@router.get("/summary", response_model=KPISummary)
def get_summary(db: Session = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)

    monthly_txns = (
        db.query(Transaction)
        .filter(Transaction.date >= month_start, Transaction.date <= today)
        .all()
    )

    monthly_income = sum(float(t.amount) for t in monthly_txns if t.type == TransactionType.income)
    monthly_expenses = sum(float(t.amount) for t in monthly_txns if t.type == TransactionType.expense)
    savings_rate = ((monthly_income - monthly_expenses) / monthly_income * 100) if monthly_income > 0 else 0

    all_txns = db.query(Transaction).all()
    total_balance = sum(
        float(t.amount) if t.type == TransactionType.income else -float(t.amount)
        for t in all_txns
    )

    active_plans = db.query(Plan).filter(Plan.status.in_([PlanStatus.planned, PlanStatus.in_progress])).count()
    completed_plans = db.query(Plan).filter(Plan.status == PlanStatus.completed).count()

    return KPISummary(
        total_balance=total_balance,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        savings_rate=round(savings_rate, 1),
        active_plans=active_plans,
        completed_plans=completed_plans,
    )


@router.get("/charts", response_model=DashboardCharts)
def get_charts(db: Session = Depends(get_db)):
    today = date.today()

    # Spending by category (last 30 days)
    recent_expenses = (
        db.query(Transaction)
        .filter(
            Transaction.type == TransactionType.expense,
            Transaction.date >= today - timedelta(days=30),
        )
        .all()
    )
    category_totals: dict[str, float] = {}
    for t in recent_expenses:
        category_totals[t.category] = category_totals.get(t.category, 0) + float(t.amount)

    spending_by_category = [
        ChartDataPoint(
            label=cat,
            value=amount,
            color=CATEGORY_COLORS.get(cat.lower(), "#6B7280"),
        )
        for cat, amount in sorted(category_totals.items(), key=lambda x: -x[1])
    ]

    # Monthly trend (last 6 months)
    monthly_trend = []
    for i in range(5, -1, -1):
        m = (today.month - i - 1) % 12 + 1
        y = today.year - (1 if today.month - i <= 0 else 0)
        month_start = date(y, m, 1)
        if m == 12:
            month_end = date(y + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(y, m + 1, 1) - timedelta(days=1)

        month_txns = (
            db.query(Transaction)
            .filter(Transaction.date >= month_start, Transaction.date <= month_end)
            .all()
        )
        income = sum(float(t.amount) for t in month_txns if t.type == TransactionType.income)
        expenses = sum(float(t.amount) for t in month_txns if t.type == TransactionType.expense)
        monthly_trend.append({
            "month": month_start.strftime("%b %Y"),
            "income": income,
            "expenses": expenses,
        })

    return DashboardCharts(
        spending_by_category=spending_by_category,
        monthly_trend=monthly_trend,
        budget_progress=[],
    )
