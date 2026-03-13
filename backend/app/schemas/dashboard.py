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
