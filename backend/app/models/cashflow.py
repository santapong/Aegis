"""Owner-scoped cash planning. Scheduled rows never post themselves to the ledger."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    String,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class Identity:
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )


class Scoped(Identity):
    workspace_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_workspaces.id", ondelete="CASCADE"), index=True
    )


class CashWorkspace(Identity, Base):
    __tablename__ = "cash_workspaces"
    __table_args__ = (UniqueConstraint("user_id", "create_key"),)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(16))
    currency: Mapped[str] = mapped_column(String(3))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Bangkok")
    buffer: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    revision: Mapped[int] = mapped_column(Integer, default=0)
    week_start: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    legacy_exclusion_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    create_key: Mapped[str] = mapped_column(String(64))
    create_hash: Mapped[str] = mapped_column(String(64))


class CashAccount(Scoped, Base):
    __tablename__ = "cash_accounts"
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(16), default="bank")
    currency: Mapped[str] = mapped_column(String(3))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)


class CashBalanceAnchor(Scoped, Base):
    __tablename__ = "cash_balance_anchors"
    __table_args__ = (UniqueConstraint("account_id", "date"),)
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("cash_accounts.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    date: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashCommitment(Scoped, Base):
    __tablename__ = "cash_commitments"
    __table_args__ = (UniqueConstraint("source_key", name="uq_cash_commitment_source"),)
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("cash_accounts.id"))
    title: Mapped[str] = mapped_column(String(255))
    direction: Mapped[str] = mapped_column(String(16))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recurrence: Mapped[str] = mapped_column(String(16), default="once")
    interval_every: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    recurrence_days: Mapped[list | None] = mapped_column(JSON, nullable=True)
    generated_through: Mapped[date | None] = mapped_column(Date, nullable=True)
    weekend_rule: Mapped[str] = mapped_column(String(16), default="strict")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    source_key: Mapped[str | None] = mapped_column(String(80), nullable=True)


class CashOccurrence(Scoped, Base):
    __tablename__ = "cash_occurrences"
    __table_args__ = (
        UniqueConstraint(
            "commitment_id",
            "nominal_date",
            "schedule_slot",
            name="uq_cash_occurrence_slot",
        ),
    )
    commitment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_commitments.id")
    )
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("cash_accounts.id"))
    title: Mapped[str] = mapped_column(String(255))
    direction: Mapped[str] = mapped_column(String(16))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    nominal_date: Mapped[date] = mapped_column(Date)
    schedule_slot: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    expected_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)


class CashSettlement(Scoped, Base):
    __tablename__ = "cash_settlements"
    transaction_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("transactions.id")
    )
    occurrence_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_occurrences.id")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashTransfer(Scoped, Base):
    __tablename__ = "cash_transfers"
    from_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_accounts.id")
    )
    to_account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_accounts.id")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(255))


class CashScenario(Scoped, Base):
    __tablename__ = "cash_scenarios"
    name: Mapped[str] = mapped_column(String(100))
    base_revision: Mapped[int] = mapped_column(Integer)
    changes: Mapped[dict] = mapped_column(JSON)


class CashAudit(Scoped, Base):
    __tablename__ = "cash_audit"
    __table_args__ = (UniqueConstraint("workspace_id", "request_key"),)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    operation: Mapped[str] = mapped_column(String(40))
    request_key: Mapped[str] = mapped_column(String(64))
    request_hash: Mapped[str] = mapped_column(String(64))
    result: Mapped[dict] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashImportBatch(Scoped, Base):
    __tablename__ = "cash_import_batches"
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("cash_accounts.id"))
    filename: Mapped[str] = mapped_column(String(160))
    currency: Mapped[str] = mapped_column(String(3))
    content_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashImportRow(Scoped, Base):
    __tablename__ = "cash_import_rows"
    __table_args__ = (
        UniqueConstraint("batch_id", "row_number"),
        UniqueConstraint("transaction_id"),
    )
    batch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_import_batches.id"), index=True
    )
    row_number: Mapped[int] = mapped_column(Integer)
    raw: Mapped[dict] = mapped_column(JSON)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    errors: Mapped[list] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    transaction_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("transactions.id"), nullable=True
    )


class CashGoalAllocation(Scoped, Base):
    __tablename__ = "cash_goal_allocations"
    __table_args__ = (UniqueConstraint("transfer_id"),)
    account_id: Mapped[str] = mapped_column(String(36), ForeignKey("cash_accounts.id"))
    goal_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("savings_goals.id", ondelete="SET NULL"), nullable=True
    )
    transfer_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("cash_transfers.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    mode: Mapped[str] = mapped_column(String(16))
    released: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashInstallmentSchedule(Scoped, Base):
    __tablename__ = "cash_installment_schedules"
    __table_args__ = (UniqueConstraint("commitment_id"),)
    commitment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_commitments.id")
    )
    debt_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("debts.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashAlertScope(Scoped, Base):
    __tablename__ = "cash_alert_scopes"
    __table_args__ = (UniqueConstraint("workspace_id", "scope_key"),)
    scope_key: Mapped[str] = mapped_column(String(64))
    as_of: Mapped[date] = mapped_column(Date)
    end: Mapped[date] = mapped_column(Date)
    account_ids: Mapped[list] = mapped_column(JSON)
    input_hash: Mapped[str] = mapped_column(String(64))
    base_revision: Mapped[int] = mapped_column(Integer)
    evaluated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashAlert(Scoped, Base):
    __tablename__ = "cash_alerts"
    __table_args__ = (UniqueConstraint("workspace_id", "dedupe_key"),)
    scope_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_alert_scopes.id"), index=True
    )
    dedupe_key: Mapped[str] = mapped_column(String(64))
    kind: Mapped[str] = mapped_column(String(24))
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    base_revision: Mapped[int] = mapped_column(Integer)
    details: Mapped[dict] = mapped_column(JSON)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class CashBusinessDocument(Scoped, Base):
    __tablename__ = "cash_business_documents"
    __table_args__ = (UniqueConstraint("commitment_id"),)
    commitment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_commitments.id")
    )
    kind: Mapped[str] = mapped_column(String(16))
    counterparty: Mapped[str] = mapped_column(String(160))
    reference: Mapped[str] = mapped_column(String(100))
    original_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashDocumentAdjustment(Scoped, Base):
    __tablename__ = "cash_document_adjustments"
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("cash_business_documents.id"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    reason: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CashForecastSnapshot(Scoped, Base):
    __tablename__ = "cash_forecast_snapshots"
    name: Mapped[str] = mapped_column(String(100))
    as_of: Mapped[date] = mapped_column(Date)
    end: Mapped[date] = mapped_column(Date)
    base_revision: Mapped[int] = mapped_column(Integer)
    engine_version: Mapped[str] = mapped_column(String(40))
    account_ids: Mapped[list] = mapped_column(JSON)
    source_hash: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
