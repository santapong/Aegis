"""Encrypted per-user secrets.

A *general* store, not an AI-specific one. The AI provider key is its first
consumer; the LINE Messaging token on the ROADMAP ("requires user-settings
token storage") is the designed-for second. That is why this is a keyed table
rather than an `api_key` column on `User` — see docs/design/006, Decision 4.

Values are encrypted at rest by `app.services.secrets` and never returned in
plaintext by any endpoint. `_ndjson_stream` in the export router carries an
explicit column denylist so this table's ciphertext cannot ride out in a data
export even if someone adds an endpoint for it later.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base

# Known key names. Not an enum column — a new consumer should not need a
# migration — but centralised so the API can reject typos rather than silently
# storing a secret nothing will ever read.
SECRET_AI_PROVIDER_KEY = "ai_provider_key"
KNOWN_SECRET_NAMES = frozenset({SECRET_AI_PROVIDER_KEY})


class UserSecret(Base):
    __tablename__ = "user_secrets"
    __table_args__ = (
        UniqueConstraint("user_id", "key_name", name="uq_user_secrets_user_key"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    key_name: Mapped[str] = mapped_column(String(64), nullable=False)
    # Fernet ciphertext. Text rather than String(n) because ciphertext length
    # grows with the plaintext and a provider token has no fixed upper bound.
    encrypted_value: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        # Deliberately omits encrypted_value: repr() lands in logs and tracebacks.
        return f"<UserSecret user_id={self.user_id} key={self.key_name}>"
