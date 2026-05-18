from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func as sa_func
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ..cache import get_cache, user_scope
from ..config import get_settings
from ..database import get_db
from ..models.transaction import Transaction, TransactionType
from ..models.ai_recommendation import AIRecommendation
from ..models.user import User
from ..schemas.ai import AIAnalyzeRequest, AIRecommendationResponse, AIForecastResponse, WeeklySummaryResponse, InsightItem
from ..services.ai_engine import AIEngine
from ..auth import get_current_user

_settings = get_settings()

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/analyze", response_model=list[AIRecommendationResponse])
def analyze_finances(request: AIAnalyzeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    engine = AIEngine(db, user_id=current_user.id)
    recommendations = engine.analyze(
        question=request.question,
        days=request.date_range_days,
    )
    return recommendations


@router.post("/recommend", response_model=list[AIRecommendationResponse])
def get_recommendations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    engine = AIEngine(db, user_id=current_user.id)
    return engine.analyze()


@router.post("/forecast", response_model=AIForecastResponse)
def forecast_finances(
    months: int = Query(default=3, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engine = AIEngine(db, user_id=current_user.id)
    return engine.forecast(months_ahead=months)


@router.get("/history", response_model=list[AIRecommendationResponse])
def get_ai_history(
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(AIRecommendation)
        .filter(AIRecommendation.user_id == current_user.id)
        .order_by(AIRecommendation.created_at.desc())
        .limit(limit)
        .all()
    )


@router.patch("/history/{rec_id}/accept")
def accept_recommendation(rec_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rec = db.query(AIRecommendation).filter(AIRecommendation.id == rec_id, AIRecommendation.user_id == current_user.id).first()
    if rec:
        rec.accepted = True
        db.commit()
    return {"status": "ok"}


@router.get("/weekly-summary", response_model=WeeklySummaryResponse)
def weekly_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cache = get_cache()
    cache_key = user_scope("ai:weekly-summary", current_user.id)
    cached = cache.get(cache_key)
    if cached is not None:
        return WeeklySummaryResponse(**cached)

    today = date.today()
    week_ago = today - timedelta(days=7)
    two_weeks_ago = today - timedelta(days=14)

    # SQL-side aggregation: one query covering both weeks, grouped by
    # week bucket + type + category. Was two full .all() scans plus
    # four Python loops.
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

    # Two summary rows — current week and prior week.
    this_row = (
        db.query(
            income_sum.label("inc"),
            expense_sum.label("exp"),
            sa_func.count(Transaction.id).label("cnt"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= week_ago,
            Transaction.date <= today,
        )
        .one()
    )
    last_row = (
        db.query(income_sum.label("inc"), expense_sum.label("exp"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= two_weeks_ago,
            Transaction.date < week_ago,
        )
        .one()
    )
    this_income = float(this_row.inc or 0)
    this_expenses = float(this_row.exp or 0)
    last_income = float(last_row.inc or 0)
    last_expenses = float(last_row.exp or 0)

    # Top-5 categories for current-week expenses — one GROUP BY, no
    # full-row .all().
    category_rows = (
        db.query(
            Transaction.category,
            sa_func.coalesce(sa_func.sum(Transaction.amount), 0).label("total"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= week_ago,
            Transaction.date <= today,
        )
        .group_by(Transaction.category)
        .order_by(sa_func.sum(Transaction.amount).desc())
        .limit(5)
        .all()
    )
    top_categories = [(cat, float(total or 0)) for cat, total in category_rows]

    expense_change = ((this_expenses - last_expenses) / last_expenses * 100) if last_expenses > 0 else 0
    income_change = ((this_income - last_income) / last_income * 100) if last_income > 0 else 0

    result = WeeklySummaryResponse(
        period_start=week_ago.isoformat(),
        period_end=today.isoformat(),
        total_income=round(this_income, 2),
        total_expenses=round(this_expenses, 2),
        net_savings=round(this_income - this_expenses, 2),
        income_change_percent=round(income_change, 1),
        expense_change_percent=round(expense_change, 1),
        top_spending_categories=[{"category": c, "amount": round(a, 2)} for c, a in top_categories],
        transaction_count=int(this_row.cnt or 0),
    )
    cache.set(cache_key, result, ttl=_settings.cache_default_ttl)
    return result


@router.get("/insights", response_model=list[InsightItem])
def get_insights(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cache = get_cache()
    cache_key = user_scope("ai:insights", current_user.id)
    cached = cache.get(cache_key)
    if cached is not None:
        return [InsightItem(**item) for item in cached]

    today = date.today()
    month_ago = today - timedelta(days=30)
    two_months_ago = today - timedelta(days=60)

    # SQL aggregation — was two full .all() scans (60-day window total)
    # plus four Python passes. Now one GROUP BY over the full window
    # bucketed by (bucket, type, category) gives us every number used
    # below. Returns ≤ 2 × types × categories rows (typically 4-60).
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

    # "bucket" is 1 for current month, 0 for prior month. Computed in
    # SQL so we only do one round-trip; portable across all engines
    # via CASE (no date_trunc dialect quirks).
    bucket_expr = case((Transaction.date >= month_ago, 1), else_=0).label("bucket")
    cnt = sa_func.count(Transaction.id).label("cnt")

    # Aggregate 1: totals per (bucket, type) — gives income / expense
    # for current AND prior month plus the transaction count.
    totals_rows = (
        db.query(
            bucket_expr,
            Transaction.type,
            sa_func.coalesce(sa_func.sum(Transaction.amount), 0).label("total"),
            cnt,
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= two_months_ago,
            Transaction.date < today + timedelta(days=1),
        )
        .group_by(bucket_expr, Transaction.type)
        .all()
    )
    recent_income = 0.0
    recent_expenses = 0.0
    prev_expenses = 0.0
    recent_count = 0
    for bucket, txn_type, total, count in totals_rows:
        total_f = float(total or 0)
        if int(bucket) == 1:  # current month
            recent_count += int(count or 0)
            if txn_type == TransactionType.income:
                recent_income = total_f
            else:
                recent_expenses = total_f
        else:  # prior month
            if txn_type == TransactionType.expense:
                prev_expenses = total_f

    # Aggregate 2: expense totals per (bucket, category) — gives both
    # months of per-category data for the "biggest increase" insight.
    cat_rows = (
        db.query(
            bucket_expr,
            Transaction.category,
            sa_func.coalesce(sa_func.sum(Transaction.amount), 0).label("total"),
        )
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= two_months_ago,
            Transaction.date < today + timedelta(days=1),
        )
        .group_by(bucket_expr, Transaction.category)
        .all()
    )
    recent_cats: dict[str, float] = {}
    prev_cats: dict[str, float] = {}
    for bucket, category, total in cat_rows:
        if int(bucket) == 1:
            recent_cats[category] = float(total or 0)
        else:
            prev_cats[category] = float(total or 0)

    insights = []

    # Savings rate insight
    if recent_income > 0:
        savings_rate = (recent_income - recent_expenses) / recent_income * 100
        if savings_rate >= 20:
            insights.append(InsightItem(
                type="positive",
                title="Strong Savings Rate",
                message=f"You're saving {savings_rate:.0f}% of your income this month. Great job!",
                metric=f"{savings_rate:.0f}%",
            ))
        elif savings_rate < 10:
            insights.append(InsightItem(
                type="warning",
                title="Low Savings Rate",
                message=f"Your savings rate is {savings_rate:.0f}%. Consider reducing discretionary spending.",
                metric=f"{savings_rate:.0f}%",
            ))

    # Spending trend
    if prev_expenses > 0:
        change = (recent_expenses - prev_expenses) / prev_expenses * 100
        if change > 15:
            insights.append(InsightItem(
                type="warning",
                title="Spending Increase",
                message=f"Your spending increased by {change:.0f}% compared to last month.",
                metric=f"+{change:.0f}%",
            ))
        elif change < -10:
            insights.append(InsightItem(
                type="positive",
                title="Spending Decrease",
                message=f"Your spending decreased by {abs(change):.0f}% compared to last month.",
                metric=f"{change:.0f}%",
            ))

    # Top growing category
    biggest_increase = None
    biggest_change = 0
    for cat, amount in recent_cats.items():
        prev_amount = prev_cats.get(cat, 0)
        if prev_amount > 0:
            change = (amount - prev_amount) / prev_amount * 100
            if change > biggest_change:
                biggest_change = change
                biggest_increase = cat

    if biggest_increase and biggest_change > 20:
        insights.append(InsightItem(
            type="info",
            title=f"Rising: {biggest_increase.title()}",
            message=f"Spending on {biggest_increase} increased {biggest_change:.0f}% this month.",
            metric=f"+{biggest_change:.0f}%",
        ))

    # Transaction frequency
    if recent_count > 0:
        avg_per_day = recent_count / 30
        insights.append(InsightItem(
            type="info",
            title="Transaction Activity",
            message=f"You averaged {avg_per_day:.1f} transactions per day this month ({recent_count} total).",
            metric=str(recent_count),
        ))

    cache.set(cache_key, [i.model_dump() for i in insights], ttl=_settings.cache_default_ttl)
    return insights
