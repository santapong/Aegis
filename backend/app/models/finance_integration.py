"""Private, durable integration state for the opt-in exact-money ledger.

Provider identifiers and message bodies are private operational data. They are
never accepted as authority for an owner; identity is resolved at trusted ingress.
"""

from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


def utcnow():
    return datetime.now(UTC).replace(tzinfo=None)


class FinanceLineIdentity(Base):
    __tablename__ = "finance_line_identities"
    __table_args__ = (
        UniqueConstraint("owner_id", "id"),
        Index(
            "uq_finance_line_actor",
            "channel_id",
            "actor_id",
            unique=True,
            sqlite_where=text("revoked_at IS NULL"),
            postgresql_where=text("revoked_at IS NULL"),
        ),
        Index(
            "uq_finance_line_owner",
            "channel_id",
            "owner_id",
            unique=True,
            sqlite_where=text("revoked_at IS NULL"),
            postgresql_where=text("revoked_at IS NULL"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    channel_id: Mapped[str] = mapped_column(String(128))
    actor_id: Mapped[str] = mapped_column(String(128))
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class FinanceLinkChallenge(Base):
    __tablename__ = "finance_link_challenges"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    channel_id: Mapped[str] = mapped_column(String(128))
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class FinanceInbox(Base):
    __tablename__ = "finance_inbox"
    __table_args__ = (
        UniqueConstraint("channel_id", "event_id", name="uq_finance_inbox_event"),
        UniqueConstraint("owner_id", "id"),
        ForeignKeyConstraint(
            ["owner_id", "identity_id"],
            ["finance_line_identities.owner_id", "finance_line_identities.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    channel_id: Mapped[str] = mapped_column(String(128))
    event_id: Mapped[str] = mapped_column(String(128))
    actor_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    identity_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("finance_line_identities.id"), nullable=True
    )
    owner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True, index=True
    )
    kind: Mapped[str] = mapped_column(String(24))
    state: Mapped[str] = mapped_column(String(24))
    safe_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    message_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_timestamp: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FinanceIntegrationJob(Base):
    __tablename__ = "finance_integration_jobs"
    __table_args__ = (
        UniqueConstraint("event_id", "kind", name="uq_finance_job_event_kind"),
        ForeignKeyConstraint(
            ["owner_id", "event_id"], ["finance_inbox.owner_id", "finance_inbox.id"]
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_id: Mapped[str] = mapped_column(String(36), ForeignKey("finance_inbox.id"))
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    kind: Mapped[str] = mapped_column(String(24))
    state: Mapped[str] = mapped_column(String(24), default="queued", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    generation: Mapped[int] = mapped_column(Integer, default=0)
    lease_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    available_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    safe_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FinanceEvidence(Base):
    __tablename__ = "finance_evidence"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_finance_evidence_event"),
        UniqueConstraint("owner_id", "id"),
        ForeignKeyConstraint(
            ["owner_id", "event_id"], ["finance_inbox.owner_id", "finance_inbox.id"]
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_id: Mapped[str] = mapped_column(String(36), ForeignKey("finance_inbox.id"))
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    storage_key: Mapped[str] = mapped_column(String(64))
    mime: Mapped[str] = mapped_column(String(64))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    state: Mapped[str] = mapped_column(String(24), default="captured")
    extraction: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FinanceActionCapability(Base):
    __tablename__ = "finance_action_capabilities"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_id", "identity_id"],
            ["finance_line_identities.owner_id", "finance_line_identities.id"],
        ),
        ForeignKeyConstraint(
            ["owner_id", "draft_id"],
            ["finance_ledger_drafts.owner_id", "finance_ledger_drafts.id"],
        ),
    )
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    identity_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("finance_line_identities.id")
    )
    draft_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("finance_ledger_drafts.id")
    )
    draft_version: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(16))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class FinanceNotificationOutbox(Base):
    __tablename__ = "finance_notification_outbox"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_id", "identity_id"],
            ["finance_line_identities.owner_id", "finance_line_identities.id"],
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), index=True
    )
    identity_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("finance_line_identities.id")
    )
    purpose: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict] = mapped_column(JSON)
    state: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    generation: Mapped[int] = mapped_column(Integer, default=0)
    lease_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    next_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    provider_ack: Mapped[str | None] = mapped_column(String(128), nullable=True)
    safe_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class FinanceDeliveryBudget(Base):
    __tablename__ = "finance_delivery_budgets"
    channel_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)


class FinanceEntryEvidence(Base):
    __tablename__ = "finance_entry_evidence"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_id", "evidence_id"],
            ["finance_evidence.owner_id", "finance_evidence.id"],
        ),
        ForeignKeyConstraint(
            ["owner_id", "journal_id"],
            ["journal_entries.owner_id", "journal_entries.id"],
        ),
    )
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    evidence_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    journal_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
