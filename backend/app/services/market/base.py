"""Market-data provider contract.

Each provider maps a third-party API onto a uniform surface the router
can compose: a symbol typeahead and an optional point-in-time quote.

Two hard rules every provider must honor so the TradingView embed never
breaks and the route never 500s:

- ``search`` may only emit ``SymbolResult``s whose ``symbol`` is a real,
  chartable ``EXCHANGE:TICKER`` string. Anything that can't be mapped to
  a known exchange is dropped, not guessed.
- Implementations raise :class:`RateLimited` on an upstream 429 so the
  router can fall back to cache (or surface a 503). All other network /
  decode errors are swallowed and returned as empty / ``None`` — a flaky
  provider degrades the feature, it does not take down the request.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ...schemas.market import QuoteResponse, SymbolResult


class RateLimited(Exception):
    """Raised when an upstream provider returns HTTP 429.

    The router catches this to serve a cached value if present, else to
    translate it into ``503 {"detail": "rate_limited"}``.
    """


class MarketProvider(ABC):
    """A single market-data source (Finnhub, Binance, …)."""

    #: Short identifier surfaced in ``SymbolSearchResponse.provider`` and
    #: ``QuoteResponse.source`` (e.g. "finnhub", "binance", "twelvedata").
    name: str = "unknown"

    @abstractmethod
    def search(self, q: str) -> list[SymbolResult]:
        """Return up to ~10 chartable matches for ``q`` (already normalized).

        Raises :class:`RateLimited` on upstream 429; returns ``[]`` on any
        other failure.
        """

    @abstractmethod
    def quote(self, symbol: str) -> QuoteResponse | None:
        """Return a quote for an ``EXCHANGE:TICKER`` symbol, or ``None`` if
        this provider can't price it.

        Raises :class:`RateLimited` on upstream 429; returns ``None`` on any
        other failure.
        """
