from datetime import date, datetime
from pydantic import BaseModel, Field


class BudgetCreate(BaseModel):
    name: str = Field(..., max_length=255)
    amount: float = Field(..., gt=0)
    category: str = Field(..., max_length=100)
    period_start: date
    period_end: date
    trip_id: str | None = None


class BudgetUpdate(BaseModel):
    name: str | None = None
    amount: float | None = Field(default=None, gt=0)
    category: str | None = None
    period_start: date | None = None
    period_end: date | None = None
    trip_id: str | None = None


class BudgetResponse(BaseModel):
    id: str
    name: str
    amount: float
    spent: float
    category: str
    period_start: date
    period_end: date
    created_at: datetime
    trip_id: str | None = None

    model_config = {"from_attributes": True}


class BudgetComparison(BaseModel):
    category: str
    budget_amount: float
    actual_spent: float
    remaining: float
    usage_percent: float
    over_budget: bool


class BudgetComparisonResponse(BaseModel):
    period_start: date
    period_end: date
    comparisons: list[BudgetComparison]
    total_budgeted: float
    total_spent: float
