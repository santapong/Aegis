from datetime import datetime
from pydantic import BaseModel

from ..models.ai_recommendation import ActionType


class AIAnalyzeRequest(BaseModel):
    question: str | None = None
    include_plans: bool = True
    include_transactions: bool = True
    date_range_days: int = 90


class AIRecommendationResponse(BaseModel):
    id: str
    plan_id: str | None
    recommendation: str
    confidence: float
    category: str
    action_type: ActionType
    accepted: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AIForecastResponse(BaseModel):
    projected_balance: float
    projected_income: float
    projected_expenses: float
    months_ahead: int
    insights: list[str]


class CategorySpending(BaseModel):
    category: str
    amount: float


class WeeklySummaryResponse(BaseModel):
    period_start: str
    period_end: str
    total_income: float
    total_expenses: float
    net_savings: float
    income_change_percent: float
    expense_change_percent: float
    top_spending_categories: list[CategorySpending]
    transaction_count: int


class InsightItem(BaseModel):
    type: str  # "positive", "warning", "info"
    title: str
    message: str
    metric: str


class AIModelsResponse(BaseModel):
    """What the settings page needs to render the model picker."""

    provider: str
    # The model actually in effect right now: the stored override if the user
    # set one, otherwise the env default.
    current: str
    # The env default, so the UI can label the "use default" option and show
    # what clearing the override falls back to.
    default: str
    # None when the user has no override stored (i.e. `current == default`).
    override: str | None
    models: list[str]
    # True when the upstream list could not be fetched and `models` is just
    # the current model echoed back. The UI shows "couldn't list alternatives"
    # rather than an empty dropdown.
    stale: bool
    # Populated only when stale, for the UI to surface the reason.
    error: str | None = None
