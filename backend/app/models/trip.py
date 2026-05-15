import enum
import uuid
from datetime import date, datetime

from sqlalchemy import String, Text, Numeric, Date, DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class TripStatus(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        Index("ix_trips_user_status", "user_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    destination: Mapped[str | None] = mapped_column(String(255), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_budget: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[TripStatus] = mapped_column(
        Enum(TripStatus, native_enum=False, length=16),
        nullable=False,
        default=TripStatus.planned,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Matches the FK `ondelete="SET NULL"` on Budget/Transaction: deleting a
    # trip preserves audit history; the linked rows just lose their trip_id.
    budgets: Mapped[list["Budget"]] = relationship("Budget", back_populates="trip")
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="trip"
    )

    def __repr__(self) -> str:
        return f"<Trip {self.title} {self.start_date}..{self.end_date}>"


from .budget import Budget  # noqa: E402, F401
from .transaction import Transaction  # noqa: E402, F401
