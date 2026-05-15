import uuid
import enum
from datetime import date, datetime

from sqlalchemy import String, Text, Numeric, Date, DateTime, Enum, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class TransactionType(str, enum.Enum):
    income = "income"
    expense = "expense"


class RecurringInterval(str, enum.Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class WeekendRule(str, enum.Enum):
    """How to shift a payday that falls on Sat/Sun.

    `strict` keeps the literal day; `roll_back`/`roll_forward` move to the
    nearest weekday. Days that already fall on a weekday are unaffected.
    """
    strict = "strict"
    roll_back = "roll_back"
    roll_forward = "roll_forward"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    plan_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("plans.id"), nullable=True)
    trip_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("trips.id", ondelete="SET NULL"), nullable=True, index=True
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType, native_enum=False), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Recurring transaction fields
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_interval: Mapped[RecurringInterval | None] = mapped_column(
        Enum(RecurringInterval, native_enum=False), nullable=True
    )
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # When set, overrides `recurring_interval`: a list of days-of-month (1-31)
    # the transaction recurs on each month, e.g. [1, 15] for a split salary.
    recurrence_dates: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    recurrence_weekend_rule: Mapped[WeekendRule | None] = mapped_column(
        Enum(WeekendRule, native_enum=False), nullable=True
    )

    plan: Mapped["Plan | None"] = relationship("Plan", back_populates="transactions")
    trip: Mapped["Trip | None"] = relationship("Trip", back_populates="transactions")
    tags: Mapped[list["Tag"]] = relationship(
        "Tag", secondary="transaction_tags", back_populates="transactions"
    )

    def __repr__(self) -> str:
        return f"<Transaction {self.type.value} {self.amount}>"


from .plan import Plan  # noqa: E402, F401
from .tag import Tag  # noqa: E402, F401
from .trip import Trip  # noqa: E402, F401
