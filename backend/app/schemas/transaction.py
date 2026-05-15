from datetime import date as _Date, datetime
from pydantic import BaseModel, Field, field_validator

from ..models.transaction import TransactionType, RecurringInterval, WeekendRule


def _validate_recurrence_dates(v: list[int] | None) -> list[int] | None:
    if v is None:
        return v
    if not v:
        raise ValueError("recurrence_dates must be non-empty when provided")
    for d in v:
        if not isinstance(d, int) or d < 1 or d > 31:
            raise ValueError("recurrence_dates entries must be ints in 1..31")
    return sorted(set(v))

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
    date: _Date
    description: str | None = None
    is_recurring: bool = False
    recurring_interval: RecurringInterval | None = None
    next_due_date: _Date | None = None
    recurrence_dates: list[int] | None = None
    recurrence_weekend_rule: WeekendRule | None = None
    tag_ids: list[str] = []

    _validate_dates = field_validator("recurrence_dates")(_validate_recurrence_dates)


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
    recurrence_dates: list[int] | None = None
    recurrence_weekend_rule: WeekendRule | None = None
    tag_ids: list[str] | None = None

    _validate_dates = field_validator("recurrence_dates")(_validate_recurrence_dates)


class TransactionResponse(BaseModel):
    id: str
    plan_id: str | None
    trip_id: str | None = None
    amount: float
    type: TransactionType
    category: str
    date: _Date
    description: str | None
    created_at: datetime
    is_recurring: bool
    recurring_interval: RecurringInterval | None
    next_due_date: _Date | None
    recurrence_dates: list[int] | None = None
    recurrence_weekend_rule: WeekendRule | None = None
    tags: list[TagResponse] = []

    model_config = {"from_attributes": True}


class UpcomingOccurrence(BaseModel):
    """A materialized-on-the-fly future payday for a recurring transaction.

    Not persisted — derived from the source transaction's recurrence config.
    """
    transaction_id: str
    date: _Date
    amount: float
    type: TransactionType
    category: str
    description: str | None = None


class UpcomingOccurrencesResponse(BaseModel):
    occurrences: list[UpcomingOccurrence]
    window_days: int


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
