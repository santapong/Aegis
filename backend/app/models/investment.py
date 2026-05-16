import uuid
from datetime import datetime

from sqlalchemy import String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from ..database import Base


class Investment(Base):
    """A single holding (stock, ETF, crypto) tracked manually.

    `tradingview_symbol` is consumed by the frontend's TradingView embed
    widget (e.g. `NASDAQ:AAPL`, `SET:PTT`, `BINANCE:BTCUSDT`). Aegis itself
    never calls TradingView — the widget is a free, no-key iframe.
    `current_price` is user-edited (manual mark-to-market) so the backend
    stays free of third-party data feeds.
    """

    __tablename__ = "investments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tradingview_symbol: Mapped[str] = mapped_column(String(64), nullable=False)
    units: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    cost_basis: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    current_price: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_priced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    def __repr__(self) -> str:
        return f"<Investment {self.tradingview_symbol} units={self.units}>"
