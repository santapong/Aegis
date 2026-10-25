"""Exact, owner-scoped financial truth. Legacy cash planning is not replayed here."""

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class LedgerAccount(Base):
    __tablename__ = "ledger_accounts"
    __table_args__ = (
        UniqueConstraint("owner_id", "id"),
        UniqueConstraint("owner_id", "system_key"),
        CheckConstraint("currency = 'THB'", name="ck_ledger_account_thb"),
        CheckConstraint(
            "kind IN ('asset','liability','income','expense','equity')",
            name="ck_ledger_account_kind",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(16))
    subtype: Mapped[str] = mapped_column(String(16))
    currency: Mapped[str] = mapped_column(String(3), default="THB")
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    system_key: Mapped[str | None] = mapped_column(String(32), nullable=True)


class LedgerOpening(Base):
    __tablename__ = "ledger_openings"
    __table_args__ = (
        UniqueConstraint("account_id"),
        UniqueConstraint("owner_id", "setup_key", "account_id"),
        ForeignKeyConstraint(
            ["owner_id", "account_id"],
            ["ledger_accounts.owner_id", "ledger_accounts.id"],
        ),
        ForeignKeyConstraint(
            ["owner_id", "journal_id"],
            ["journal_entries.owner_id", "journal_entries.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    account_id: Mapped[str] = mapped_column(String(36))
    cutoff_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    signed_balance_minor: Mapped[int] = mapped_column(BigInteger)
    journal_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    setup_key: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class LedgerDraft(Base):
    __tablename__ = "finance_ledger_drafts"
    __table_args__ = (
        UniqueConstraint("owner_id", "id"),
        ForeignKeyConstraint(
            ["owner_id", "posted_journal_id"],
            ["journal_entries.owner_id", "journal_entries.id"],
            use_alter=True,
            name="fk_draft_posted_journal",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(24), default="pending")
    payload: Mapped[dict] = mapped_column(JSON)
    posted_journal_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("owner_id", "id"),
        UniqueConstraint("source_draft_id"),
        UniqueConstraint("reversal_of"),
        ForeignKeyConstraint(
            ["owner_id", "source_draft_id"],
            ["finance_ledger_drafts.owner_id", "finance_ledger_drafts.id"],
            use_alter=True,
            name="fk_journal_source_draft",
        ),
        ForeignKeyConstraint(
            ["owner_id", "reversal_of"],
            ["journal_entries.owner_id", "journal_entries.id"],
        ),
        ForeignKeyConstraint(
            ["owner_id", "original_expense_entry_id"],
            ["journal_entries.owner_id", "journal_entries.id"],
        ),
        CheckConstraint("currency = 'THB'", name="ck_journal_thb"),
        CheckConstraint("precision IN ('day','instant')", name="ck_journal_precision"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    kind: Mapped[str] = mapped_column(String(24))
    currency: Mapped[str] = mapped_column(String(3), default="THB")
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    occurred_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    precision: Mapped[str] = mapped_column(String(12))
    source_draft_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reversal_of: Mapped[str | None] = mapped_column(String(36), nullable=True)
    original_expense_entry_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True
    )
    correction_group: Mapped[str | None] = mapped_column(String(36), nullable=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    created_txid: Mapped[int] = mapped_column(BigInteger, server_default=text("0"))


class Posting(Base):
    __tablename__ = "ledger_postings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_id", "journal_id"],
            ["journal_entries.owner_id", "journal_entries.id"],
        ),
        ForeignKeyConstraint(
            ["owner_id", "account_id"],
            ["ledger_accounts.owner_id", "ledger_accounts.id"],
        ),
        CheckConstraint("amount_minor <> 0", name="ck_posting_nonzero"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    journal_id: Mapped[str] = mapped_column(String(36), index=True)
    account_id: Mapped[str] = mapped_column(String(36), index=True)
    amount_minor: Mapped[int] = mapped_column(BigInteger)


class FinancialTransactionProjection(Base):
    __tablename__ = "financial_transaction_projections"
    __table_args__ = (
        UniqueConstraint("journal_entry_id"),
        ForeignKeyConstraint(
            ["owner_id", "journal_entry_id"],
            ["journal_entries.owner_id", "journal_entries.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    journal_entry_id: Mapped[str] = mapped_column(String(36))
    operation_kind: Mapped[str] = mapped_column(String(24))
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    income_effect_minor: Mapped[int] = mapped_column(BigInteger)
    expense_effect_minor: Mapped[int] = mapped_column(BigInteger)
    category: Mapped[str] = mapped_column(String(100), default="uncategorized")
    trip_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("trips.id"), nullable=True
    )
    tags: Mapped[list] = mapped_column(JSON, default=list)


class LedgerIdempotency(Base):
    __tablename__ = "ledger_idempotency"
    __table_args__ = (UniqueConstraint("owner_id", "namespace", "key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    namespace: Mapped[str] = mapped_column(String(128))
    key: Mapped[str] = mapped_column(String(128))
    request_hash: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict] = mapped_column(JSON)


class EconomicIdentity(Base):
    __tablename__ = "ledger_economic_identities"
    __table_args__ = (
        UniqueConstraint("owner_id", "key_hash"),
        ForeignKeyConstraint(
            ["owner_id", "journal_id"],
            ["journal_entries.owner_id", "journal_entries.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    key_hash: Mapped[str] = mapped_column(String(64))
    journal_id: Mapped[str] = mapped_column(String(36))


class LedgerAudit(Base):
    __tablename__ = "ledger_audits"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    operation: Mapped[str] = mapped_column(String(40))
    resource_id: Mapped[str] = mapped_column(String(36))
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class LedgerNotification(Base):
    __tablename__ = "ledger_notifications"
    __table_args__ = (UniqueConstraint("journal_id", "purpose"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    draft_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    journal_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("journal_entries.id")
    )
    purpose: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="pending")
