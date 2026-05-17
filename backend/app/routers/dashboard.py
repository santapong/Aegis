from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ..cache import get_cache, user_scope
from ..config import get_settings
from ..database import get_db
from ..models.plan import Plan, PlanStatus, Recurrence
from ..models.budget import Budget
from ..models.transaction import Transaction, TransactionType
from ..models.user import User
from ..schemas.dashboard import (
    KPISummary,
    DashboardCharts,
    ChartDataPoint,
    HealthScoreBreakdown,
    HealthScoreResponse,
    CashFlowPoint,
    CashFlowForecastResponse,
)
from ..auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
_settings = get_settings()

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
def get_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Cached for the configured default TTL (60 s by default). Reads
    # the same exact data on every dashboard render — without this,
    # a single page load fires 4 queries that scan the user's full
    # transaction history. Invalidated by transactions mutation hooks
    # (see _invalidate_dashboard in routers/transactions.py).
    cache = get_cache()
    key = user_scope("dashboard:summary", current_user.id)
    cached = cache.get(key)
    if cached is not None:
        return KPISummary(**cached)

    today = date.today()
    month_start = today.replace(day=1)

    monthly_txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.date >= month_start, Transaction.date <= today)
        .all()
    )

    monthly_income = sum(float(t.amount) for t in monthly_txns if t.type == TransactionType.income)
    monthly_expenses = sum(float(t.amount) for t in monthly_txns if t.type == TransactionType.expense)
    savings_rate = ((monthly_income - monthly_expenses) / monthly_income * 100) if monthly_income > 0 else 0

    all_txns = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    total_balance = sum(
        float(t.amount) if t.type == TransactionType.income else -float(t.amount)
        for t in all_txns
    )

    active_plans = db.query(Plan).filter(Plan.user_id == current_user.id, Plan.status.in_([PlanStatus.planned, PlanStatus.in_progress])).count()
    completed_plans = db.query(Plan).filter(Plan.user_id == current_user.id, Plan.status == PlanStatus.completed).count()

    result = KPISummary(
        total_balance=total_balance,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        savings_rate=round(savings_rate, 1),
        active_plans=active_plans,
        completed_plans=completed_plans,
    )
    cache.set(key, result, ttl=_settings.cache_default_ttl)
    return result


@router.get("/charts", response_model=DashboardCharts)
def get_charts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cache = get_cache()
    key = user_scope("dashboard:charts", current_user.id)
    cached = cache.get(key)
    if cached is not None:
        return DashboardCharts(**cached)

    today = date.today()

    # Spending by category (last 30 days)
    recent_expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
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
            .filter(Transaction.user_id == current_user.id, Transaction.date >= month_start, Transaction.date <= month_end)
            .all()
        )
        income = sum(float(t.amount) for t in month_txns if t.type == TransactionType.income)
        expenses = sum(float(t.amount) for t in month_txns if t.type == TransactionType.expense)
        monthly_trend.append({
            "month": month_start.strftime("%b %Y"),
            "income": income,
            "expenses": expenses,
        })

    result = DashboardCharts(
        spending_by_category=spending_by_category,
        monthly_trend=monthly_trend,
        budget_progress=[],
    )
    cache.set(key, result, ttl=_settings.cache_default_ttl)
    return result


@router.get("/health-score", response_model=HealthScoreResponse)
def get_health_score(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    month_start = today.replace(day=1)

    # --- Savings Rate Score (0-30) ---
    monthly_txns = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.date >= month_start, Transaction.date <= today)
        .all()
    )
    monthly_income = sum(float(t.amount) for t in monthly_txns if t.type == TransactionType.income)
    monthly_expenses = sum(float(t.amount) for t in monthly_txns if t.type == TransactionType.expense)
    savings_rate = ((monthly_income - monthly_expenses) / monthly_income * 100) if monthly_income > 0 else 0
    # 20%+ savings = full score
    savings_score = min(30.0, (savings_rate / 20) * 30) if savings_rate > 0 else 0

    # --- Budget Adherence Score (0-25) ---
    active_budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id, Budget.period_start <= today, Budget.period_end >= today)
        .all()
    )
    if active_budgets:
        adherence_scores = []
        for b in active_budgets:
            expenses_in_cat = (
                db.query(Transaction)
                .filter(
                    Transaction.user_id == current_user.id,
                    Transaction.type == TransactionType.expense,
                    Transaction.category == b.category,
                    Transaction.date >= b.period_start,
                    Transaction.date <= today,
                )
                .all()
            )
            spent = sum(float(t.amount) for t in expenses_in_cat)
            ratio = spent / float(b.amount) if float(b.amount) > 0 else 0
            # Under budget = 1.0, over budget reduces score
            adherence_scores.append(max(0, 1 - max(0, ratio - 1)))
        avg_adherence = sum(adherence_scores) / len(adherence_scores)
        budget_score = avg_adherence * 25
    else:
        budget_score = 12.5  # neutral if no budgets set

    # --- Expense Consistency Score (0-25) ---
    three_months_ago = today - timedelta(days=90)
    recent_expenses = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= three_months_ago,
        )
        .all()
    )
    monthly_totals: dict[str, float] = {}
    for t in recent_expenses:
        key = t.date.strftime("%Y-%m")
        monthly_totals[key] = monthly_totals.get(key, 0) + float(t.amount)

    if len(monthly_totals) >= 2:
        values = list(monthly_totals.values())
        avg_expense = sum(values) / len(values)
        if avg_expense > 0:
            variance = sum((v - avg_expense) ** 2 for v in values) / len(values)
            std_dev = variance ** 0.5
            cv = std_dev / avg_expense  # coefficient of variation
            consistency_score = max(0, 25 * (1 - min(cv, 1)))
        else:
            consistency_score = 25.0
    else:
        consistency_score = 12.5

    # --- Income Stability Score (0-20) ---
    recent_income = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.income,
            Transaction.date >= three_months_ago,
        )
        .all()
    )
    monthly_income_totals: dict[str, float] = {}
    for t in recent_income:
        key = t.date.strftime("%Y-%m")
        monthly_income_totals[key] = monthly_income_totals.get(key, 0) + float(t.amount)

    if len(monthly_income_totals) >= 2:
        values = list(monthly_income_totals.values())
        avg_inc = sum(values) / len(values)
        if avg_inc > 0:
            variance = sum((v - avg_inc) ** 2 for v in values) / len(values)
            std_dev = variance ** 0.5
            cv = std_dev / avg_inc
            income_score = max(0, 20 * (1 - min(cv, 1)))
        else:
            income_score = 0
    else:
        income_score = 10.0

    overall = round(savings_score + budget_score + consistency_score + income_score, 1)

    if overall >= 80:
        grade = "A"
    elif overall >= 60:
        grade = "B"
    elif overall >= 40:
        grade = "C"
    elif overall >= 20:
        grade = "D"
    else:
        grade = "F"

    breakdown = [
        HealthScoreBreakdown(name="Savings Rate", score=round(savings_score, 1), max_score=30, description="Based on your monthly savings as a percentage of income"),
        HealthScoreBreakdown(name="Budget Adherence", score=round(budget_score, 1), max_score=25, description="How well you stay within your budget limits"),
        HealthScoreBreakdown(name="Expense Consistency", score=round(consistency_score, 1), max_score=25, description="Stability of your monthly spending patterns"),
        HealthScoreBreakdown(name="Income Stability", score=round(income_score, 1), max_score=20, description="Consistency of your income over time"),
    ]

    return HealthScoreResponse(overall_score=overall, grade=grade, breakdown=breakdown)


@router.get("/cashflow-forecast", response_model=CashFlowForecastResponse)
def get_cashflow_forecast(months: int = 6, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    months = min(months, 12)
    today = date.today()

    # Current balance
    all_txns = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    current_balance = sum(
        float(t.amount) if t.type == TransactionType.income else -float(t.amount)
        for t in all_txns
    )

    # Average monthly income & expenses from last 3 months
    three_months_ago = today - timedelta(days=90)
    recent = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.date >= three_months_ago)
        .all()
    )

    monthly_income: dict[str, float] = {}
    monthly_expense: dict[str, float] = {}
    for t in recent:
        key = t.date.strftime("%Y-%m")
        if t.type == TransactionType.income:
            monthly_income[key] = monthly_income.get(key, 0) + float(t.amount)
        else:
            monthly_expense[key] = monthly_expense.get(key, 0) + float(t.amount)

    num_months = max(len(set(list(monthly_income.keys()) + list(monthly_expense.keys()))), 1)
    avg_income = sum(monthly_income.values()) / num_months if monthly_income else 0
    avg_expense = sum(monthly_expense.values()) / num_months if monthly_expense else 0

    # Factor in recurring plans
    recurring_plans = (
        db.query(Plan)
        .filter(
            Plan.user_id == current_user.id,
            Plan.recurrence != Recurrence.once,
            Plan.status.in_(["planned", "in_progress"]),
        )
        .all()
    )
    for p in recurring_plans:
        if p.recurrence == Recurrence.monthly:
            if p.category.value in ("income",):
                avg_income += float(p.amount) * 0.3  # blend with historical
            elif p.category.value in ("expense",):
                avg_expense += float(p.amount) * 0.3

    forecast = []
    running_balance = current_balance
    for i in range(1, months + 1):
        m = (today.month + i - 1) % 12 + 1
        y = today.year + (today.month + i - 1) // 12
        month_label = date(y, m, 1).strftime("%b %Y")
        running_balance += avg_income - avg_expense
        forecast.append(
            CashFlowPoint(
                month=month_label,
                projected_income=round(avg_income, 2),
                projected_expenses=round(avg_expense, 2),
                projected_balance=round(running_balance, 2),
            )
        )

    return CashFlowForecastResponse(current_balance=round(current_balance, 2), forecast=forecast)
