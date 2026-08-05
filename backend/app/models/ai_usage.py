"""Per-call token accounting for the AI layer.

One row per *successful* provider call. Written from `AIEngine._call_tool`,
which is the single choke point both AI entry points already pass through.

Why measured tokens rather than only a cost estimate: no provider API returns
a price for every model (Anthropic's does not), so a dollar figure always
depends on a table someone maintains. Token counts come straight off the
provider response and stay accurate with zero maintenance, which makes them
the durable substrate — cost is derived on top. See
docs/design/006-ai-provider-configuration.md, Decision 3.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class AIUsage(Base):
    __tablename__ = "ai_usage"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # Nullable so an unauthenticated / system-initiated call still meters.
    # ON DELETE CASCADE matches the rest of the schema: deleting a user takes
    # their usage history with them.
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    # Recorded per row rather than read from settings at query time: the
    # operator can switch models mid-month, and historical rows must keep
    # the model they were actually billed against.
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    # "analyze" | "forecast" — which entry point drove the call.
    operation: Mapped[str] = mapped_column(String(32), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False, index=True
    )

    def __repr__(self) -> str:
        return (
            f"<AIUsage {self.provider}/{self.model} {self.operation} "
            f"in={self.input_tokens} out={self.output_tokens}>"
        )
