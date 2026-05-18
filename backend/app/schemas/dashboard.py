from pydantic import BaseModel


class KPISummary(BaseModel):
    total_balance: float
    monthly_income: float
    monthly_expenses: float
    savings_rate: float
    active_plans: int
    completed_plans: int


class ChartDataPoint(BaseModel):
    label: str
    value: float
    color: str | None = None


class DashboardCharts(BaseModel):
    spending_by_category: list[ChartDataPoint]
    monthly_trend: list[dict]
    budget_progress: list[dict]


class HealthScoreBreakdown(BaseModel):
    name: str
    score: float
    max_score: float
    description: str


class HealthScoreResponse(BaseModel):
    overall_score: float
    grade: str
    breakdown: list[HealthScoreBreakdown]


class CashFlowPoint(BaseModel):
    month: str
    projected_income: float
    projected_expenses: float
    projected_balance: float


class CashFlowForecastResponse(BaseModel):
    current_balance: float
    forecast: list[CashFlowPoint]


class AnomalyItem(BaseModel):
    transaction_id: str
    date: str
    category: str
    amount: float
    average_for_category: float
    deviation_ratio: float
    description: str | None = None


class AnomaliesResponse(BaseModel):
    anomalies: list[AnomalyItem]
    total_count: int


class DashboardBundleResponse(BaseModel):
    """Single round-trip payload for the dashboard page.

    The dashboard previously mounted 6+ separate queries (summary,
    charts, health-score, cashflow-forecast, anomalies, insights,
    weekly-summary). Each one was its own HTTP round-trip — under
    Vercel + Render that's 6× the rewrite-proxy latency on first
    paint. The bundle endpoint returns all of them in one shot and
    is itself cached with the same per-user invalidation rules
    (`dashboard:bundle` in `_GLOBAL_USER_SCOPES`).

    Optional fields use lower-case `None` rather than missing-key so
    the frontend can render the page in a degraded state when, for
    example, AI insights aren't configured for this deployment.
    """

    summary: KPISummary
    charts: DashboardCharts
    health_score: HealthScoreResponse
    cashflow_forecast: CashFlowForecastResponse
    anomalies: AnomaliesResponse
    # AI-derived; nullable for deployments where the AI provider isn't
    # configured (the underlying handlers raise 503 in that case — the
    # bundle catches and returns None instead of failing the whole
    # response).
    weekly_summary: dict | None = None
    insights: list[dict] = []
