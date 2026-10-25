from datetime import date
from decimal import Decimal
from typing import Literal, Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


Money = Decimal
CashDate = Annotated[date, Field(ge=date(1900, 1, 1), le=date(2100, 12, 31))]


class Mutation(Strict):
    revision: int = Field(ge=0)
    request_key: str = Field(min_length=8, max_length=64)


class WorkspaceCreate(Strict):
    name: str = Field(min_length=1, max_length=100)
    kind: Literal["personal", "business"]
    currency: Literal["THB", "USD"]
    timezone: str = "Asia/Bangkok"
    buffer: Money = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    week_start: int = Field(default=0, ge=0, le=6)
    request_key: str = Field(min_length=8, max_length=64)

    @field_validator("timezone")
    @classmethod
    def valid_zone(cls, v):
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown timezone")
        return v


class AccountCreate(Mutation):
    name: str = Field(min_length=1, max_length=100)
    kind: Literal["cash", "bank"] = "bank"


class AnchorCreate(Mutation):
    account_id: str
    amount: Money = Field(max_digits=12, decimal_places=2)
    date: CashDate
    source: str = Field(min_length=1, max_length=255)


class MovementCreate(Mutation):
    account_id: str
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)
    direction: Literal["income", "expense"]
    date: CashDate
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(default="Other", max_length=100)
    occurrence_id: str | None = None


class TransferCreate(Mutation):
    from_account_id: str
    to_account_id: str
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)
    date: CashDate
    description: str = Field(min_length=1, max_length=255)
    to_workspace_revision: int | None = Field(default=None, ge=0)


class CommitmentCreate(Mutation):
    account_id: str
    title: str = Field(min_length=1, max_length=255)
    direction: Literal["income", "expense"]
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)
    start_date: CashDate
    end_date: CashDate | None = None
    due_date: CashDate | None = None
    recurrence: Literal[
        "once", "weekly", "biweekly", "monthly", "quarterly", "yearly", "split"
    ] = "once"
    interval_every: int = Field(default=1, ge=1, le=24)
    recurrence_days: list[Annotated[int, Field(ge=1, le=31)]] | None = Field(
        default=None, max_length=6
    )
    weekend_rule: Literal["strict", "roll_back", "roll_forward"] = "strict"
    source_kind: Literal["plan", "transaction"] | None = None
    source_id: str | None = None

    @model_validator(mode="after")
    def split_rule(self):
        if self.recurrence == "split":
            if not self.recurrence_days or len(set(self.recurrence_days)) != len(
                self.recurrence_days
            ):
                raise ValueError(
                    "Split schedules need distinct month days between 1 and 31"
                )
        elif self.recurrence_days:
            raise ValueError("Month days are only used with a split schedule")
        if self.recurrence == "once" and self.interval_every != 1:
            raise ValueError("A one-time commitment has no repeat interval")
        return self


class OccurrenceEdit(Mutation):
    expected_date: CashDate | None = None
    due_date: CashDate | None = None
    amount: Money | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    title: str | None = Field(default=None, min_length=1, max_length=255)
    cancelled: bool | None = None


class SettlementCreate(Mutation):
    transaction_id: str
    occurrence_id: str
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)


class AllocationPreview(Strict):
    transaction_id: str
    occurrence_id: str
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)


class ScenarioChange(Strict):
    occurrence_id: str
    expected_date: CashDate


class ScenarioExtra(Strict):
    account_id: str
    title: str = Field(min_length=1, max_length=255)
    direction: Literal["income", "expense"] = "expense"
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)
    date: CashDate


class ScenarioCreate(Mutation):
    name: str = Field(min_length=1, max_length=100)
    dates: list[ScenarioChange] = Field(default_factory=list, max_length=100)
    extras: list[ScenarioExtra] = Field(default_factory=list, max_length=100)


class LegacyAdopt(Mutation):
    account_id: str
    transaction_ids: list[str] = Field(min_length=1, max_length=500)
    confirmed_currency: Literal["THB", "USD"]


class BufferUpdate(Mutation):
    buffer: Money = Field(ge=0, max_digits=12, decimal_places=2)


class ScheduleExtend(Mutation):
    through: CashDate


class ImportUpload(Mutation):
    account_id: str
    confirmed_currency: Literal["THB", "USD"]
    filename: str = Field(min_length=1, max_length=160)
    content: str = Field(min_length=1, max_length=262144)


class ImportChoice(Strict):
    row_id: str
    decision: Literal["import", "keep_distinct"] = "import"
    occurrence_id: str | None = None
    match_amount: Money | None = Field(
        default=None, gt=0, max_digits=12, decimal_places=2
    )


class ImportConfirm(Mutation):
    rows: list[ImportChoice] = Field(min_length=1, max_length=500)


class GoalAllocationCreate(Mutation):
    account_id: str
    name: str = Field(min_length=1, max_length=100)
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)
    mode: Literal["reserved", "transferred"] = "reserved"
    goal_id: str | None = None
    transfer_id: str | None = None
    confirmed_currency: Literal["THB", "USD"]


class GoalAllocationUpdate(Mutation):
    amount: Money | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    released: bool | None = None


class InstallmentEntry(Strict):
    date: CashDate
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)


class InstallmentCreate(Mutation):
    account_id: str
    name: str = Field(min_length=1, max_length=100)
    debt_id: str | None = None
    confirmed_currency: Literal["THB", "USD"]
    entries: list[InstallmentEntry] = Field(min_length=1, max_length=60)


class AlertEvaluate(Mutation):
    as_of: CashDate
    end: CashDate
    account_ids: list[str] | None = Field(default=None, max_length=50)


class BusinessDocumentCreate(Mutation):
    account_id: str
    commitment_id: str | None = None
    kind: Literal["receivable", "bill"]
    counterparty: str = Field(min_length=1, max_length=160)
    reference: str = Field(min_length=1, max_length=100)
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)
    due_date: CashDate
    expected_date: CashDate
    confirmed_currency: Literal["THB", "USD"]


class BusinessDocumentReview(Mutation):
    counterparty: str | None = Field(default=None, min_length=1, max_length=160)
    reference: str | None = Field(default=None, min_length=1, max_length=100)
    due_date: CashDate | None = None
    expected_date: CashDate | None = None


class BusinessDocumentCredit(Mutation):
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)
    reason: str = Field(min_length=1, max_length=500)


class BusinessDocumentCancel(Mutation):
    reason: str = Field(min_length=1, max_length=500)


class BusinessDocumentSettle(Mutation):
    amount: Money = Field(gt=0, max_digits=12, decimal_places=2)
    transaction_id: str | None = None
    date: CashDate | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)

    @model_validator(mode="after")
    def payment_choice(self):
        if self.transaction_id:
            if self.date is not None or self.title is not None:
                raise ValueError(
                    "Match an existing record without supplying a new date/title"
                )
        elif self.date is None:
            raise ValueError("A new recorded payment requires its actual date")
        return self


class ForecastSnapshotCreate(Mutation):
    name: str = Field(min_length=1, max_length=100)
    as_of: CashDate
    end: CashDate
    account_ids: list[str] | None = Field(default=None, max_length=50)
