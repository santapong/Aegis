import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Table, Column, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


# Many-to-many association table
transaction_tags = Table(
    "transaction_tags",
    Base.metadata,
    Column("transaction_id", String(36), ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String(36), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (
        # Tag names are unique **per user**, not globally. The old
        # globally-unique constraint meant Alice creating "groceries"
        # blocked Bob from ever creating his own "groceries" tag — that
        # bug is fixed by the v0.9.5 migration.
        UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6B7280")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", secondary=transaction_tags, back_populates="tags"
    )

    def __repr__(self) -> str:
        return f"<Tag {self.name}>"


from .transaction import Transaction  # noqa: E402, F401
