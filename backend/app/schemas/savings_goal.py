from datetime import date, datetime
from pydantic import BaseModel, Field


class SavingsGoalCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(default=0, ge=0)
    deadline: date | None = None
    category: str = "general"
    color: str = "#3B82F6"
    icon: str = "piggy-bank"


class SavingsGoalUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    target_amount: float | None = None
    current_amount: float | None = None
    deadline: date | None = None
    category: str | None = None
    color: str | None = None
    icon: str | None = None


class SavingsGoalResponse(BaseModel):
    id: str
    name: str
    description: str | None
    target_amount: float
    current_amount: float
    deadline: date | None
    category: str
    color: str
    icon: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContributeRequest(BaseModel):
    amount: float = Field(..., gt=0)
