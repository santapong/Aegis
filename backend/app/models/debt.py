import uuid
import enum
from datetime import date, datetime

from sqlalchemy import String, Text, Numeric, Float, Date, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class DebtType(str, enum.Enum):
    credit_card = "credit_card"
    student_loan = "student_loan"
    mortgage = "mortgage"
    car_loan = "car_loan"
    personal_loan = "personal_loan"
    medical = "medical"
    other = "other"


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    original_balance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    interest_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    minimum_payment: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    debt_type: Mapped[DebtType] = mapped_column(Enum(DebtType, native_enum=False), default=DebtType.other)
    color: Mapped[str] = mapped_column(String(7), default="#EF4444")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<Debt {self.name} ${self.balance}>"
