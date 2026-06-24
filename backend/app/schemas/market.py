from datetime import datetime
from typing import Literal

from pydantic import BaseModel

# Asset classes the picker can chart. Kept narrow on purpose: the
# frontend renders a type badge (Stock / ETF / Crypto) and the
# TradingView embed only ever sees `EXCHANGE:TICKER`.
SymbolType = Literal["stock", "etf", "crypto"]


class SymbolResult(BaseModel):
    """One typeahead row. `symbol` is the TradingView `EXCHANGE:TICKER`
    string the chart widget is keyed by — providers that can't be mapped
    to a chartable exchange are dropped upstream, never emitted here."""

    symbol: str
    name: str
    exchange: str
    type: SymbolType
    currency: str | None = None


class SymbolSearchResponse(BaseModel):
    results: list[SymbolResult]
    provider: str
    # True when running without a Finnhub key: equities search is
    # unavailable and results are crypto-only (keyless Binance).
    degraded: bool


class QuoteResponse(BaseModel):
    """A point-in-time quote. Every market field is optional so the route
    never 500s on a provider gap — `price=None` means "unavailable", and
    the frontend falls back to manual price entry."""

    symbol: str
    price: float | None = None
    currency: str | None = None
    change_percent: float | None = None
    as_of: datetime | None = None
    source: str | None = None


class MarketStatus(BaseModel):
    equities_supported: bool
    crypto_supported: bool
    providers: list[str]
