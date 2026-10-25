"""Statement evidence; importing a statement never changes recorded money."""

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, ForeignKeyConstraint, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class StatementImport(Base):
    __tablename__ = "finance_statement_imports"
    __table_args__ = (
        UniqueConstraint("owner_id", "request_key"),
        UniqueConstraint("owner_id", "account_id", "content_hash"),
        UniqueConstraint("owner_id", "id"),
        ForeignKeyConstraint(["owner_id", "account_id"], ["ledger_accounts.owner_id", "ledger_accounts.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    account_id: Mapped[str] = mapped_column(String(36))
    request_key: Mapped[str] = mapped_column(String(80))
    request_hash: Mapped[str] = mapped_column(String(64))
    content_hash: Mapped[str] = mapped_column(String(64))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    opening_balance_minor: Mapped[int] = mapped_column(BigInteger)
    closing_balance_minor: Mapped[int] = mapped_column(BigInteger)
    line_ids: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StatementLine(Base):
    __tablename__ = "finance_statement_lines"
    __table_args__ = (
        UniqueConstraint("owner_id", "account_id", "stable_key"),
        UniqueConstraint("owner_id", "account_id", "matched_journal_id"),
        ForeignKeyConstraint(["owner_id", "account_id"], ["ledger_accounts.owner_id", "ledger_accounts.id"]),
        ForeignKeyConstraint(["owner_id", "import_id"], ["finance_statement_imports.owner_id", "finance_statement_imports.id"]),
        ForeignKeyConstraint(["owner_id", "matched_journal_id"], ["journal_entries.owner_id", "journal_entries.id"]),
        ForeignKeyConstraint(["owner_id", "draft_id"], ["finance_ledger_drafts.owner_id", "finance_ledger_drafts.id"]),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    import_id: Mapped[str] = mapped_column(String(36))
    account_id: Mapped[str] = mapped_column(String(36))
    stable_key: Mapped[str] = mapped_column(String(128))
    occurred_on: Mapped[date] = mapped_column(Date)
    amount_minor: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(20))
    reference: Mapped[str] = mapped_column(String(160), default="")
    description: Mapped[str] = mapped_column(String(500), default="")
    matched_journal_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    draft_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
