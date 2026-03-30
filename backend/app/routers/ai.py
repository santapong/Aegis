from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta

from ..database import get_db
from ..models.transaction import Transaction, TransactionType
from ..models.ai_recommendation import AIRecommendation
from ..schemas.ai import AIAnalyzeRequest, AIRecommendationResponse, AIForecastResponse, WeeklySummaryResponse, InsightItem
from ..services.ai_engine import AIEngine

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/analyze", response_model=list[AIRecommendationResponse])
def analyze_finances(request: AIAnalyzeRequest, db: Session = Depends(get_db)):
    engine = AIEngine(db)
    recommendations = engine.analyze(
        question=request.question,
        days=request.date_range_days,
    )
    return recommendations


@router.post("/recommend", response_model=list[AIRecommendationResponse])
def get_recommendations(db: Session = Depends(get_db)):
    engine = AIEngine(db)
    return engine.analyze()


@router.post("/forecast", response_model=AIForecastResponse)
def forecast_finances(
    months: int = Query(default=3, ge=1, le=12),
    db: Session = Depends(get_db),
):
    engine = AIEngine(db)
    return engine.forecast(months_ahead=months)


@router.get("/history", response_model=list[AIRecommendationResponse])
def get_ai_history(
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
):
    return (
        db.query(AIRecommendation)
        .order_by(AIRecommendation.created_at.desc())
        .limit(limit)
        .all()
    )


@router.patch("/history/{rec_id}/accept")
def accept_recommendation(rec_id: str, db: Session = Depends(get_db)):
    rec = db.query(AIRecommendation).filter(AIRecommendation.id == rec_id).first()
    if rec:
        rec.accepted = True
        db.commit()
    return {"status": "ok"}


@router.get("/weekly-summary", response_model=WeeklySummaryResponse)
def weekly_summary(db: Session = Depends(get_db)):
    today = date.today()
    week_ago = today - timedelta(days=7)
    two_weeks_ago = today - timedelta(days=14)

    # This week's transactions
    this_week = db.query(Transaction).filter(Transaction.date >= week_ago, Transaction.date <= today).all()
    # Last week's transactions
    last_week = db.query(Transaction).filter(Transaction.date >= two_weeks_ago, Transaction.date < week_ago).all()

    this_income = sum(float(t.amount) for t in this_week if t.type == TransactionType.income)
    this_expenses = sum(float(t.amount) for t in this_week if t.type == TransactionType.expense)
    last_income = sum(float(t.amount) for t in last_week if t.type == TransactionType.income)
    last_expenses = sum(float(t.amount) for t in last_week if t.type == TransactionType.expense)

    # Category breakdown for this week
    categories: dict[str, float] = {}
    for t in this_week:
        if t.type == TransactionType.expense:
            categories[t.category] = categories.get(t.category, 0) + float(t.amount)

    top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]

    expense_change = ((this_expenses - last_expenses) / last_expenses * 100) if last_expenses > 0 else 0
    income_change = ((this_income - last_income) / last_income * 100) if last_income > 0 else 0

    return WeeklySummaryResponse(
        period_start=week_ago.isoformat(),
        period_end=today.isoformat(),
        total_income=round(this_income, 2),
        total_expenses=round(this_expenses, 2),
        net_savings=round(this_income - this_expenses, 2),
        income_change_percent=round(income_change, 1),
        expense_change_percent=round(expense_change, 1),
        top_spending_categories=[{"category": c, "amount": round(a, 2)} for c, a in top_categories],
        transaction_count=len(this_week),
    )


@router.get("/insights", response_model=list[InsightItem])
def get_insights(db: Session = Depends(get_db)):
    today = date.today()
    month_ago = today - timedelta(days=30)
    two_months_ago = today - timedelta(days=60)

    recent = db.query(Transaction).filter(Transaction.date >= month_ago).all()
    previous = db.query(Transaction).filter(Transaction.date >= two_months_ago, Transaction.date < month_ago).all()

    insights = []

    # Savings rate insight
    recent_income = sum(float(t.amount) for t in recent if t.type == TransactionType.income)
    recent_expenses = sum(float(t.amount) for t in recent if t.type == TransactionType.expense)
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
    prev_expenses = sum(float(t.amount) for t in previous if t.type == TransactionType.expense)
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
    recent_cats: dict[str, float] = {}
    prev_cats: dict[str, float] = {}
    for t in recent:
        if t.type == TransactionType.expense:
            recent_cats[t.category] = recent_cats.get(t.category, 0) + float(t.amount)
    for t in previous:
        if t.type == TransactionType.expense:
            prev_cats[t.category] = prev_cats.get(t.category, 0) + float(t.amount)

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
    if len(recent) > 0:
        avg_per_day = len(recent) / 30
        insights.append(InsightItem(
            type="info",
            title="Transaction Activity",
            message=f"You averaged {avg_per_day:.1f} transactions per day this month ({len(recent)} total).",
            metric=str(len(recent)),
        ))

    return insights
