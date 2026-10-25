"""Separate LINE finance channel: account links, confirmed drafts and durable replies."""

from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class CashDestination:
    workspace_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("cash_workspaces.id", ondelete="SET NULL"), nullable=True
    )
    account_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("cash_accounts.id", ondelete="SET NULL"), nullable=True
    )


class LineFinanceCode(CashDestination, Base):
    __tablename__ = "line_finance_codes"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class LineFinanceIdentity(CashDestination, Base):
    __tablename__ = "line_finance_identities"
    line_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )
    connection_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class LineFinanceEvent(Base):
    __tablename__ = "line_finance_events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None)
    )


class LineFinanceDraft(Base):
    __tablename__ = "line_finance_drafts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    state: Mapped[str] = mapped_column(String(16), default="pending")
    data: Mapped[dict] = mapped_column(JSON)
    transaction_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None)
    )


class LineFinanceReply(Base):
    __tablename__ = "line_finance_replies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    line_id: Mapped[str] = mapped_column(String(128))
    text: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    next_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None)
    )
