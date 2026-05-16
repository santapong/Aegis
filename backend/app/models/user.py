import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class User(Base):
    """A user account.

    Authentication: at least one of ``hashed_password`` and
    ``google_subject`` must be set. Both can coexist — a user who first
    registered with email/password may later link a Google account, or
    vice versa. The application code enforces this; the DB schema only
    requires they be nullable.
    """

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    # Password is optional — Google-only users have no password set. The
    # /register endpoint always sets one; the Google sign-in endpoint
    # leaves it null unless the email matched an existing email/password
    # account (in which case we keep their password).
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Google ``sub`` claim. Unique per Google account; never reassigned.
    # NULL for users who never linked a Google account.
    google_subject: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<User {self.email}>"
