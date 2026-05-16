import uuid
from datetime import date, datetime

from sqlalchemy import String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    trip_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("trips.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    spent: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    trip: Mapped["Trip | None"] = relationship("Trip", back_populates="budgets")

    def __repr__(self) -> str:
        return f"<Budget {self.name} {self.spent}/{self.amount}>"


from .trip import Trip  # noqa: E402, F401
