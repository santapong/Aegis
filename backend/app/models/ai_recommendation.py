import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Text, Float, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class ActionType(str, enum.Enum):
    reduce = "reduce"
    increase = "increase"
    reallocate = "reallocate"
    alert = "alert"


class AIRecommendation(Base):
    __tablename__ = "ai_recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    plan_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("plans.id"), nullable=True)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    action_type: Mapped[ActionType] = mapped_column(Enum(ActionType, native_enum=False), nullable=False)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<AIRecommendation {self.action_type.value} ({self.confidence:.0%})>"
