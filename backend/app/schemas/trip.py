from datetime import date, datetime
from pydantic import BaseModel, Field, model_validator

from ..models.trip import TripStatus


class TripCreate(BaseModel):
    title: str = Field(..., max_length=255)
    destination: str | None = Field(default=None, max_length=255)
    start_date: date
    end_date: date
    total_budget: float | None = Field(default=None, ge=0)
    status: TripStatus = TripStatus.planned
    notes: str | None = None

    @model_validator(mode="after")
    def _check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    destination: str | None = Field(default=None, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    total_budget: float | None = Field(default=None, ge=0)
    status: TripStatus | None = None
    notes: str | None = None


class TripResponse(BaseModel):
    id: str
    title: str
    destination: str | None
    start_date: date
    end_date: date
    total_budget: float | None
    status: TripStatus
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TripCategoryRollup(BaseModel):
    category: str
    budgeted: float
    spent: float


class TripSummary(BaseModel):
    trip: TripResponse
    total_budgeted: float
    total_spent: float
    by_category: list[TripCategoryRollup]
    transaction_count: int
