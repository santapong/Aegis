import uuid
import enum
from datetime import date, datetime

from sqlalchemy import String, Text, Numeric, Integer, Date, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class PlanCategory(str, enum.Enum):
    income = "income"
    expense = "expense"
    investment = "investment"
    savings = "savings"


class PlanStatus(str, enum.Enum):
    planned = "planned"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class Recurrence(str, enum.Enum):
    once = "once"
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"


class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[PlanCategory] = mapped_column(Enum(PlanCategory, native_enum=False), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recurrence: Mapped[Recurrence] = mapped_column(Enum(Recurrence, native_enum=False), default=Recurrence.once)
    status: Mapped[PlanStatus] = mapped_column(Enum(PlanStatus, native_enum=False), default=PlanStatus.planned)
    priority: Mapped[Priority] = mapped_column(Enum(Priority, native_enum=False), default=Priority.medium)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str] = mapped_column(String(7), default="#3B82F6")
    parent_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("plans.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    children: Mapped[list["Plan"]] = relationship("Plan", back_populates="parent", cascade="all, delete-orphan")
    parent: Mapped["Plan | None"] = relationship("Plan", back_populates="children", remote_side=[id])
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="plan")

    def __repr__(self) -> str:
        return f"<Plan {self.title} ({self.status.value})>"


# Avoid circular import at module level
from .transaction import Transaction  # noqa: E402, F401
