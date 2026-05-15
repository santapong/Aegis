"""Server-backed user preferences.

Mirrors the `AppSettings` shape in `frontend/src/stores/app-store.ts`. The
frontend keeps its zustand-cached copy for optimistic UI but is now seeded
from / persisted to this table — one row per user.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


# Defaults must stay in lockstep with `defaultSettings` in app-store.ts.
DEFAULT_CURRENCY = "USD"
DEFAULT_DATE_RANGE_DAYS = 30
DEFAULT_ITEMS_PER_PAGE = 25
DEFAULT_AI_AUTO_SUGGESTIONS = True


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # One-to-one with User. Unique so a user can only ever have a single row.
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    currency: Mapped[str] = mapped_column(
        String(8), nullable=False, default=DEFAULT_CURRENCY
    )
    default_date_range_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=DEFAULT_DATE_RANGE_DAYS
    )
    items_per_page: Mapped[int] = mapped_column(
        Integer, nullable=False, default=DEFAULT_ITEMS_PER_PAGE
    )
    ai_auto_suggestions: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=DEFAULT_AI_AUTO_SUGGESTIONS
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<UserPreferences user_id={self.user_id}>"
