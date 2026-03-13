from datetime import date, datetime
from pydantic import BaseModel, Field

from ..models.transaction import TransactionType


class TransactionCreate(BaseModel):
    plan_id: str | None = None
    amount: float = Field(..., gt=0)
    type: TransactionType
    category: str = Field(..., max_length=100)
    date: date
    description: str | None = None


class TransactionResponse(BaseModel):
    id: str
    plan_id: str | None
    amount: float
    type: TransactionType
    category: str
    date: date
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TransactionSummary(BaseModel):
    total_income: float
    total_expenses: float
    net: float
    by_category: dict[str, float]
    count: int
