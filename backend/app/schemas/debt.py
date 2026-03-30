from datetime import date, datetime
from pydantic import BaseModel, Field

from ..models.debt import DebtType


class DebtCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    balance: float = Field(..., gt=0)
    original_balance: float = Field(..., gt=0)
    interest_rate: float = Field(default=0, ge=0, le=100)
    minimum_payment: float = Field(default=0, ge=0)
    due_date: date | None = None
    debt_type: DebtType = DebtType.other
    color: str = "#EF4444"


class DebtUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    balance: float | None = None
    interest_rate: float | None = None
    minimum_payment: float | None = None
    due_date: date | None = None
    debt_type: DebtType | None = None
    color: str | None = None


class DebtResponse(BaseModel):
    id: str
    name: str
    description: str | None
    balance: float
    original_balance: float
    interest_rate: float
    minimum_payment: float
    due_date: date | None
    debt_type: DebtType
    color: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PayoffStep(BaseModel):
    month: int
    debt_name: str
    payment: float
    remaining_balance: float
    interest_paid: float


class PayoffPlanResponse(BaseModel):
    strategy: str
    total_months: int
    total_interest: float
    total_paid: float
    monthly_steps: list[PayoffStep]


class MakePaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
