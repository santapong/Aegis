"""Market-data service façade.

Picks a provider topology from configuration and presents one surface to
the router:

- **Finnhub key set** → Finnhub for equities + crypto *search*, with
  Binance attached for crypto *quotes* (Finnhub free tier has none) and
  Twelve Data (if keyed) for equity quotes. Not degraded.
- **No Finnhub key** → Binance only: crypto search + quotes, no equities.
  ``degraded=True`` and ``equities_supported=False``.

``get_market_service()`` returns a process-level singleton so the
underlying httpx pools live for the app's lifetime — mirroring the
cached-client intent in ``ai_engine``.
"""

from __future__ import annotations

from functools import lru_cache

from ...config import get_settings
from ...schemas.market import MarketStatus, QuoteResponse, SymbolResult
from .base import MarketProvider, RateLimited
from .binance import BinanceProvider
from .finnhub import FinnhubProvider

__all__ = ["MarketService", "get_market_service", "RateLimited"]


class MarketService:
    """Composes the configured providers behind ``search`` / ``quote``.

    The router owns caching and HTTP error translation; this façade owns
    *routing* a request to the right provider. ``RateLimited`` is allowed
    to propagate so the router can serve cache or 503.
    """

    def __init__(
        self,
        *,
        finnhub: FinnhubProvider | None,
        binance: BinanceProvider,
        twelvedata_configured: bool,
    ) -> None:
        self._finnhub = finnhub
        self._binance = binance
        self._twelvedata_configured = twelvedata_configured

    # --- capability flags (drive /status and degraded banner) ----------
    @property
    def degraded(self) -> bool:
        """True when there's no equities provider (Binance-only mode)."""
        return self._finnhub is None

    @property
    def equities_supported(self) -> bool:
        return self._finnhub is not None

    @property
    def crypto_supported(self) -> bool:
        return True  # Binance is always present

    @property
    def search_provider(self) -> str:
        return self._finnhub.name if self._finnhub is not None else self._binance.name

    @property
    def active_providers(self) -> list[str]:
        providers: list[str] = []
        if self._finnhub is not None:
            providers.append("finnhub")
            if self._twelvedata_configured:
                providers.append("twelvedata")
        providers.append("binance")
        return providers

    def status(self) -> MarketStatus:
        return MarketStatus(
            equities_supported=self.equities_supported,
            crypto_supported=self.crypto_supported,
            providers=self.active_providers,
        )

    # --- operations -----------------------------------------------------
    def search(self, q: str) -> list[SymbolResult]:
        """Return chartable matches for ``q`` (already normalized)."""
        if self._finnhub is not None:
            return self._finnhub.search(q)
        return self._binance.search(q)

    def quote(self, symbol: str) -> QuoteResponse | None:
        """Quote a symbol, routing crypto → Binance and equities → Finnhub
        (Twelve Data under the hood)."""
        is_crypto = symbol.upper().startswith(("BINANCE:", "COINBASE:", "KRAKEN:"))
        if is_crypto:
            return self._binance.quote(symbol)
        if self._finnhub is not None:
            return self._finnhub.quote(symbol)
        return None


@lru_cache(maxsize=1)
def get_market_service() -> MarketService:
    """Return the configured market service (singleton).

    Cached so the httpx connection pools inside the providers are reused
    across requests. Call ``get_market_service.cache_clear()`` in tests
    after mutating settings.
    """
    settings = get_settings()
    finnhub: FinnhubProvider | None = None
    if settings.finnhub_api_key:
        finnhub = FinnhubProvider(
            settings.finnhub_api_key, settings.twelvedata_api_key
        )
    binance = BinanceProvider(exchange_info_ttl=settings.market_search_ttl)
    return MarketService(
        finnhub=finnhub,
        binance=binance,
        twelvedata_configured=bool(settings.twelvedata_api_key),
    )
