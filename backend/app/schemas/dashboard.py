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
