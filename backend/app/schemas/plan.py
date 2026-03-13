from datetime import date, datetime
from pydantic import BaseModel, Field

from ..models.plan import PlanCategory, PlanStatus, Recurrence, Priority


class PlanCreate(BaseModel):
    title: str = Field(..., max_length=255)
    description: str | None = None
    category: PlanCategory
    amount: float = Field(default=0, ge=0)
    currency: str = Field(default="USD", max_length=3)
    start_date: date
    end_date: date | None = None
    recurrence: Recurrence = Recurrence.once
    priority: Priority = Priority.medium
    color: str = Field(default="#3B82F6", max_length=7)
    parent_id: str | None = None


class PlanUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: PlanCategory | None = None
    amount: float | None = None
    currency: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    recurrence: Recurrence | None = None
    status: PlanStatus | None = None
    priority: Priority | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    color: str | None = None
    parent_id: str | None = None


class PlanResponse(BaseModel):
    id: str
    title: str
    description: str | None
    category: PlanCategory
    amount: float
    currency: str
    start_date: date
    end_date: date | None
    recurrence: Recurrence
    status: PlanStatus
    priority: Priority
    progress: int
    color: str
    parent_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CalendarEvent(BaseModel):
    id: str
    title: str
    start: date
    end: date | None
    color: str
    category: PlanCategory
    status: PlanStatus
    amount: float

    model_config = {"from_attributes": True}


class GanttTask(BaseModel):
    id: str
    title: str
    start: date
    end: date
    progress: int
    parent_id: str | None
    color: str
    priority: Priority
    status: PlanStatus

    model_config = {"from_attributes": True}
