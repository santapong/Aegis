from fastapi import APIRouter, Depends
from sqlalchemy import case, func as sa_func
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
    DashboardBundleResponse,
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

    # SQL aggregation — replaces a current-month .all() + all-time
    # .all() + Python sums (worst case all-time scan materialized to
    # compute one scalar). Two queries: one for monthly totals,
    # one for all-time balance. Both use the (user_id, date) and
    # (user_id, type, date) composite indexes from v0.9.7.
    income_sum = sa_func.coalesce(
        sa_func.sum(
            case((Transaction.type == TransactionType.income, Transaction.amount), else_=0)
        ),
        0,
    )
    expense_sum = sa_func.coalesce(
        sa_func.sum(
            case((Transaction.type == TransactionType.expense, Transaction.amount), else_=0)
        ),
        0,
    )

    monthly_row = (
        db.query(income_sum.label("income"), expense_sum.label("expense"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= month_start,
            Transaction.date <= today,
        )
        .one()
    )
    monthly_income = float(monthly_row.income or 0)
    monthly_expenses = float(monthly_row.expense or 0)
    savings_rate = (
        ((monthly_income - monthly_expenses) / monthly_income * 100)
        if monthly_income > 0
        else 0
    )

    balance_row = (
        db.query((income_sum - expense_sum).label("balance"))
        .filter(Transaction.user_id == current_user.id)
        .one()
    )
    total_balance = float(balance_row.balance or 0)

    active_plans = (
        db.query(sa_func.count(Plan.id))
        .filter(
            Plan.user_id == current_user.id,
            Plan.status.in_([PlanStatus.planned, PlanStatus.in_progress]),
        )
        .scalar()
        or 0
    )
    completed_plans = (
        db.query(sa_func.count(Plan.id))
        .filter(Plan.user_id == current_user.id, Plan.status == PlanStatus.completed)
        .scalar()
        or 0
    )

    result = KPISummary(
        total_balance=total_balance,
        monthly_income=monthly_income,
        monthly_expenses=monthly_expenses,
        savings_rate=round(savings_rate, 1),
        active_plans=int(active_plans),
        completed_plans=int(completed_plans),
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

    # Spending by category (last 30 days) — single GROUP BY query,
    # replaces a full 30-day .all() + Python aggregation loop.
    category_rows = (
        db.query(
            Transaction.category,
            sa_func.coalesce(sa_func.sum(Transaction.amount), 0).label("total"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= today - timedelta(days=30),
        )
        .group_by(Transaction.category)
        .order_by(sa_func.sum(Transaction.amount).desc())
        .all()
    )
    spending_by_category = [
        ChartDataPoint(
            label=category,
            value=float(total or 0),
            color=CATEGORY_COLORS.get((category or "").lower(), "#6B7280"),
        )
        for category, total in category_rows
    ]

    # Monthly trend (last 6 months) — was 6 separate full-month .all()s
    # in a Python loop. One GROUP BY over a 6-month window replaces all
    # of them. We then re-bucket in Python so the month-name string
    # formatting matches the previous shape. Empty months still appear
    # in the output with zero values (the frontend chart expects 6
    # rows).
    six_months_ago = date(today.year, today.month, 1) - timedelta(days=1)
    six_months_ago = date(
        six_months_ago.year, six_months_ago.month, 1
    ) - timedelta(days=150)  # roughly 5 months earlier
    six_months_ago = date(six_months_ago.year, six_months_ago.month, 1)

    income_sum = sa_func.coalesce(
        sa_func.sum(
            case((Transaction.type == TransactionType.income, Transaction.amount), else_=0)
        ),
        0,
    )
    expense_sum = sa_func.coalesce(
        sa_func.sum(
            case((Transaction.type == TransactionType.expense, Transaction.amount), else_=0)
        ),
        0,
    )
    # We need to group by (year, month) portably across SQLite + Postgres
    # + MySQL. SQLAlchemy's func.extract works on all three for DATE
    # columns. Result keys are (year, month) → (income, expense).
    monthly_rows = (
        db.query(
            sa_func.extract("year", Transaction.date).label("y"),
            sa_func.extract("month", Transaction.date).label("m"),
            income_sum.label("income"),
            expense_sum.label("expense"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= six_months_ago,
            Transaction.date <= today,
        )
        .group_by("y", "m")
        .all()
    )
    bucket: dict[tuple[int, int], tuple[float, float]] = {
        (int(y), int(m)): (float(income or 0), float(expense or 0))
        for y, m, income, expense in monthly_rows
    }

    monthly_trend = []
    for i in range(5, -1, -1):
        m = (today.month - i - 1) % 12 + 1
        y = today.year - (1 if today.month - i <= 0 else 0)
        month_start = date(y, m, 1)
        income, expense = bucket.get((y, m), (0.0, 0.0))
        monthly_trend.append({
            "month": month_start.strftime("%b %Y"),
            "income": income,
            "expenses": expense,
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
    cache = get_cache()
    cache_key = user_scope("dashboard:health-score", current_user.id)
    cached = cache.get(cache_key)
    if cached is not None:
        return HealthScoreResponse(**cached)

    today = date.today()
    month_start = today.replace(day=1)
    three_months_ago = today - timedelta(days=90)

    income_sum = sa_func.coalesce(
        sa_func.sum(
            case((Transaction.type == TransactionType.income, Transaction.amount), else_=0)
        ),
        0,
    )
    expense_sum = sa_func.coalesce(
        sa_func.sum(
            case((Transaction.type == TransactionType.expense, Transaction.amount), else_=0)
        ),
        0,
    )

    # --- Savings Rate Score (0-30) — one aggregate query, was full
    # current-month scan + Python loop.
    monthly_row = (
        db.query(income_sum.label("income"), expense_sum.label("expense"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= month_start,
            Transaction.date <= today,
        )
        .one()
    )
    monthly_income = float(monthly_row.income or 0)
    monthly_expenses = float(monthly_row.expense or 0)
    savings_rate = ((monthly_income - monthly_expenses) / monthly_income * 100) if monthly_income > 0 else 0
    savings_score = min(30.0, (savings_rate / 20) * 30) if savings_rate > 0 else 0

    # --- Budget Adherence Score (0-25) — one aggregate over the union
    # of all active-budget categories, grouped by category. Was N+1:
    # one .all() per active budget. For a user with 10 active budgets
    # and a full month of expenses this drops 10 queries to 2.
    active_budgets = (
        db.query(Budget)
        .filter(Budget.user_id == current_user.id, Budget.period_start <= today, Budget.period_end >= today)
        .all()
    )
    if active_budgets:
        # Aggregate expense totals per (category, period_start)
        # combination so we can match each budget to its window.
        category_spend: dict[str, float] = {}
        if active_budgets:
            categories = {b.category for b in active_budgets}
            # min(period_start) sets the lower bound for our single
            # query; we still match each budget to its own window in
            # Python to handle staggered periods.
            min_period_start = min(b.period_start for b in active_budgets)
            spend_rows = (
                db.query(
                    Transaction.category,
                    Transaction.date,
                    Transaction.amount,
                )
                .filter(
                    Transaction.user_id == current_user.id,
                    Transaction.type == TransactionType.expense,
                    Transaction.category.in_(categories),
                    Transaction.date >= min_period_start,
                    Transaction.date <= today,
                )
                .all()
            )
            # Single in-memory aggregate keyed by (category, period
            # boundaries) — bounded by active budget count.
            for b in active_budgets:
                spent = sum(
                    float(r.amount)
                    for r in spend_rows
                    if r.category == b.category and b.period_start <= r.date <= today
                )
                category_spend[b.id] = spent

        adherence_scores = []
        for b in active_budgets:
            cap = float(b.amount)
            if cap <= 0:
                continue
            spent = category_spend.get(b.id, 0.0)
            ratio = spent / cap
            adherence_scores.append(max(0, 1 - max(0, ratio - 1)))
        budget_score = (
            (sum(adherence_scores) / len(adherence_scores)) * 25 if adherence_scores else 12.5
        )
    else:
        budget_score = 12.5

    # --- Expense Consistency + Income Stability (0-25 + 0-20) — one
    # combined GROUP BY (year, month) query gives both 3-month monthly
    # series. Was 2 full scans + 2 Python loops.
    series_rows = (
        db.query(
            sa_func.extract("year", Transaction.date).label("y"),
            sa_func.extract("month", Transaction.date).label("m"),
            income_sum.label("income"),
            expense_sum.label("expense"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= three_months_ago,
            Transaction.date <= today,
        )
        .group_by("y", "m")
        .all()
    )
    monthly_expense_values: list[float] = []
    monthly_income_values: list[float] = []
    for _, _, income, expense in series_rows:
        if float(expense or 0) > 0:
            monthly_expense_values.append(float(expense))
        if float(income or 0) > 0:
            monthly_income_values.append(float(income))

    def _stability_score(values: list[float], max_points: float) -> float:
        if len(values) < 2:
            return max_points / 2
        avg = sum(values) / len(values)
        if avg <= 0:
            return 0.0
        variance = sum((v - avg) ** 2 for v in values) / len(values)
        cv = (variance ** 0.5) / avg
        return max(0.0, max_points * (1 - min(cv, 1)))

    consistency_score = _stability_score(monthly_expense_values, 25.0)
    income_score = _stability_score(monthly_income_values, 20.0)

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

    result = HealthScoreResponse(overall_score=overall, grade=grade, breakdown=breakdown)
    cache.set(cache_key, result, ttl=_settings.cache_default_ttl)
    return result


@router.get("/cashflow-forecast", response_model=CashFlowForecastResponse)
def get_cashflow_forecast(months: int = 6, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    months = min(months, 12)

    cache = get_cache()
    cache_key = user_scope("dashboard:cashflow", current_user.id, str(months))
    cached = cache.get(cache_key)
    if cached is not None:
        return CashFlowForecastResponse(**cached)

    today = date.today()
    three_months_ago = today - timedelta(days=90)

    income_sum = sa_func.coalesce(
        sa_func.sum(
            case((Transaction.type == TransactionType.income, Transaction.amount), else_=0)
        ),
        0,
    )
    expense_sum = sa_func.coalesce(
        sa_func.sum(
            case((Transaction.type == TransactionType.expense, Transaction.amount), else_=0)
        ),
        0,
    )

    # Current balance — single aggregate query (was full all-time scan
    # + Python sum, the worst hit on this route at 100k transactions).
    balance_row = (
        db.query((income_sum - expense_sum).label("balance"))
        .filter(Transaction.user_id == current_user.id)
        .one()
    )
    current_balance = float(balance_row.balance or 0)

    # Per-month aggregates over the last 90 days. One GROUP BY query
    # replaces a full 90-day .all() + Python type-and-month loop.
    series_rows = (
        db.query(
            sa_func.extract("year", Transaction.date).label("y"),
            sa_func.extract("month", Transaction.date).label("m"),
            income_sum.label("income"),
            expense_sum.label("expense"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= three_months_ago,
        )
        .group_by("y", "m")
        .all()
    )
    months_in_window = max(len(series_rows), 1)
    avg_income = (
        sum(float(income or 0) for _, _, income, _ in series_rows) / months_in_window
        if series_rows
        else 0
    )
    avg_expense = (
        sum(float(expense or 0) for _, _, _, expense in series_rows) / months_in_window
        if series_rows
        else 0
    )

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

    result = CashFlowForecastResponse(
        current_balance=round(current_balance, 2), forecast=forecast
    )
    cache.set(cache_key, result, ttl=_settings.cache_default_ttl)
    return result


@router.get("/bundle", response_model=DashboardBundleResponse)
def get_dashboard_bundle(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One round-trip for the entire dashboard page.

    Replaces the 6-endpoint fan-out (summary, charts, health-score,
    cashflow-forecast, anomalies, weekly-summary, insights) the
    dashboard mounted on every page load. Each component query had
    its own rewrite-proxy hop on Vercel + Render — at p99 that's 6×
    the latency on first paint.

    The bundle has its own ``dashboard:bundle:<user_id>`` cache key
    that's invalidated alongside every other dashboard scope via
    ``_GLOBAL_USER_SCOPES``. On a cache miss it calls each underlying
    handler function directly (not via HTTP) — those handlers have
    their own per-scope caches, so a fresh bundle call can still hit
    several scope-level caches inline.

    AI bits are optional: if the upstream AI provider isn't
    configured the weekly_summary / insights handlers raise 503; we
    catch and return `None` / `[]` so the rest of the dashboard
    renders even without AI.
    """
    # Local imports to dodge module-level circular: ai + transactions
    # routers both import from dashboard indirectly via cache scopes.
    from ..routers.ai import get_insights, weekly_summary
    from ..routers.transactions import detect_anomalies
    from fastapi import HTTPException

    cache = get_cache()
    cache_key = user_scope("dashboard:bundle", current_user.id)
    cached = cache.get(cache_key)
    if cached is not None:
        return DashboardBundleResponse(**cached)

    summary = get_summary(db=db, current_user=current_user)
    charts = get_charts(db=db, current_user=current_user)
    health_score = get_health_score(db=db, current_user=current_user)
    cashflow_forecast = get_cashflow_forecast(
        months=6, db=db, current_user=current_user
    )
    anomalies = detect_anomalies(
        days=90, threshold=2.0, db=db, current_user=current_user
    )

    # AI calls are wrapped: if the provider isn't configured the
    # handler raises HTTPException(503). Degrade gracefully so the
    # rest of the dashboard renders.
    weekly: dict | None = None
    insights: list[dict] = []
    try:
        weekly = weekly_summary(db=db, current_user=current_user).model_dump()
    except HTTPException as exc:
        if exc.status_code != 503:
            raise
    try:
        insights = [i.model_dump() for i in get_insights(db=db, current_user=current_user)]
    except HTTPException as exc:
        if exc.status_code != 503:
            raise

    result = DashboardBundleResponse(
        summary=summary,
        charts=charts,
        health_score=health_score,
        cashflow_forecast=cashflow_forecast,
        anomalies=anomalies,
        weekly_summary=weekly,
        insights=insights,
    )
    cache.set(cache_key, result, ttl=_settings.cache_default_ttl)
    return result
