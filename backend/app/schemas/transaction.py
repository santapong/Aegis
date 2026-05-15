from datetime import date as _Date, datetime
from pydantic import BaseModel, Field

from ..models.transaction import TransactionType, RecurringInterval

# Alias to avoid the `date: date | None` shadowing issue inside TransactionUpdate
# where a field named `date` is also typed as `date`.
date = _Date


class TagResponse(BaseModel):
    id: str
    name: str
    color: str

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    plan_id: str | None = None
    trip_id: str | None = None
    amount: float = Field(..., gt=0)
    type: TransactionType
    category: str = Field(..., max_length=100)
    date: date
    description: str | None = None
    is_recurring: bool = False
    recurring_interval: RecurringInterval | None = None
    next_due_date: date | None = None
    tag_ids: list[str] = []


class TransactionUpdate(BaseModel):
    plan_id: str | None = None
    trip_id: str | None = None
    amount: float | None = Field(default=None, gt=0)
    type: TransactionType | None = None
    category: str | None = Field(default=None, max_length=100)
    date: _Date | None = None
    description: str | None = None
    is_recurring: bool | None = None
    recurring_interval: RecurringInterval | None = None
    next_due_date: _Date | None = None
    tag_ids: list[str] | None = None


class TransactionResponse(BaseModel):
    id: str
    plan_id: str | None
    trip_id: str | None = None
    amount: float
    type: TransactionType
    category: str
    date: date
    description: str | None
    created_at: datetime
    is_recurring: bool
    recurring_interval: RecurringInterval | None
    next_due_date: date | None
    tags: list[TagResponse] = []

    model_config = {"from_attributes": True}


class TransactionSummary(BaseModel):
    total_income: float
    total_expenses: float
    net: float
    by_category: dict[str, float]
    count: int


class RecurringTransactionSummary(BaseModel):
    total_monthly_recurring: float
    recurring_income: float
    recurring_expenses: float
    subscriptions: list[TransactionResponse]


class TagCreate(BaseModel):
    name: str = Field(..., max_length=50)
    color: str = Field(default="#6B7280", max_length=7)


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class ImportPreviewRow(BaseModel):
    date: str
    description: str | None
    amount: float
    type: str
    category: str


class ImportPreviewResponse(BaseModel):
    rows: list[ImportPreviewRow]
    total_rows: int
    valid_rows: int


class ImportConfirmRequest(BaseModel):
    rows: list[ImportPreviewRow]


class ImportResultResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str]
