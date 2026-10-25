"""Public money is a decimal integer string, never a JSON float."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AccountCreate(Strict):
    name: str = Field(min_length=1, max_length=100)
    subtype: Literal["bank", "savings", "cash", "card"]
    currency: Literal["THB"] = "THB"


class OpeningItem(Strict):
    account_id: str
    signed_balance_minor: str


class OpeningsCreate(Strict):
    cutoff_at: datetime
    reviewed: bool
    accounts: list[OpeningItem] = Field(min_length=1, max_length=100)

    @field_validator("cutoff_at")
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("cutoff_at requires an explicit UTC offset")
        return value


class DraftPayload(Strict):
    type: (
        Literal[
            "income", "expense", "transfer", "card_purchase", "card_repayment", "refund"
        ]
        | None
    ) = None
    amount_minor: str | None = None
    currency: str = "THB"
    occurred_on: date | None = None
    occurred_at: datetime | None = None
    date_precision: Literal["day", "instant"] = "day"
    cutoff_resolution: Literal["after", "before"] | None = None
    source_account_id: str | None = None
    target_account_id: str | None = None
    original_expense_entry_id: str | None = None
    category: str = Field(default="uncategorized", max_length=100)
    description: str = Field(default="", max_length=500)
    trip_id: str | None = None
    tags: list[str] = Field(default_factory=list, max_length=30)
    fee_minor: str = "0"
    economic_identity: dict | None = None
    duplicate_resolution: Literal["distinct", "attach"] | None = None
    attach_to_journal_id: str | None = None
    provenance: dict = Field(default_factory=dict)
    evidence_ids: list[str] = Field(default_factory=list, max_length=20)


class DraftEdit(Strict):
    expected_version: int = Field(ge=1)
    patch: dict


class DraftAction(Strict):
    expected_version: int = Field(ge=1)


class Correction(Strict):
    correction_effective_on: date
    cutoff_resolution: Literal["after", "before"] | None = None
    reason: str = Field(min_length=1, max_length=500)
    replacement: DraftPayload | None = None


class Classification(Strict):
    category: str = Field(min_length=1, max_length=100)
    trip_id: str | None = None
    tags: list[str] = Field(default_factory=list, max_length=30)
    reason: str = Field(min_length=1, max_length=500)
