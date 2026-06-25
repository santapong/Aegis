"""Finnhub-backed market provider (primary).

Finnhub ``/search`` (60 req/min free, no card) covers US equities and
crypto. Crypto already arrives as TradingView-native ``BINANCE:BTCUSDT``
symbols; equities arrive as bare tickers plus a MIC, which we translate
to the TradingView exchange prefix via :data:`MIC_TO_EXCHANGE`.

Quotes are optional: if a Twelve Data key is configured we attach live
equity prices via its ``/quote`` endpoint, otherwise ``price`` is None
and the UI falls back to manual entry. (Crypto quotes are served by the
Binance provider in the façade — Finnhub free tier has no crypto quote.)
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
from loguru import logger

from ...schemas.market import QuoteResponse, SymbolResult, SymbolType
from .base import MarketProvider, RateLimited

_FINNHUB_BASE = "https://finnhub.io/api/v1"
_TWELVEDATA_BASE = "https://api.twelvedata.com"
_TIMEOUT = httpx.Timeout(6.0)
_SEARCH_LIMIT = 10

# MIC (ISO 10383 market identifier) -> TradingView exchange prefix.
# Auditable, central, and conservative: only MICs we can confidently
# chart are listed. Any result whose MIC is absent is DROPPED so we
# never emit an un-chartable ``EXCHANGE:TICKER`` to the widget.
MIC_TO_EXCHANGE: dict[str, str] = {
    # NASDAQ tiers (Global Select / Global Market / Capital Market)
    "XNAS": "NASDAQ",
    "XNGS": "NASDAQ",
    "XNMS": "NASDAQ",
    "XNCM": "NASDAQ",
    # NYSE
    "XNYS": "NYSE",
    # NYSE Arca -> charted as AMEX on TradingView, where most Arca-listed
    # US ETFs (e.g. AMEX:SPY) resolve cleanly. Cboe BZX (MIC "BATS") is
    # deliberately omitted: those tickers do NOT reliably resolve under
    # AMEX on TradingView, so we drop them rather than emit a broken chart.
    "ARCX": "AMEX",
    # NYSE American (legacy AMEX)
    "XASE": "AMEX",
    # Stock Exchange of Thailand
    "XSET": "SET",
}

# Finnhub `type` strings -> our narrow asset classes. Equity-ish types
# collapse to "stock"; ETFs are surfaced distinctly for the badge.
_ETF_TYPES = {"ETP", "ETF"}


_CRYPTO_EXCHANGES = {"BINANCE", "COINBASE", "KRAKEN"}


def _classify(finnhub_type: str | None, symbol: str) -> SymbolType:
    prefix = symbol.split(":", 1)[0].upper() if ":" in symbol else ""
    if prefix in _CRYPTO_EXCHANGES:
        return "crypto"
    if (finnhub_type or "").upper() in _ETF_TYPES:
        return "etf"
    return "stock"


class FinnhubProvider(MarketProvider):
    name = "finnhub"

    def __init__(self, api_key: str, twelvedata_api_key: str = "") -> None:
        self._api_key = api_key
        self._twelvedata_api_key = twelvedata_api_key

    # Lazy per-instance client so the httpx connection pool (and its TLS
    # handshake) is reused across requests — mirrors ai_engine's cached
    # client pattern. The façade is a process-level singleton, so this
    # client lives for the app's lifetime.
    @property
    def _client(self) -> httpx.Client:
        client = getattr(self, "_http", None)
        if client is None:
            client = httpx.Client(timeout=_TIMEOUT)
            self._http = client
        return client

    def search(self, q: str) -> list[SymbolResult]:
        try:
            resp = self._client.get(
                f"{_FINNHUB_BASE}/search",
                params={"q": q},
                headers={"X-Finnhub-Token": self._api_key},
            )
        except httpx.HTTPError as exc:
            logger.warning("finnhub search network error for {!r}: {}", q, exc)
            return []

        if resp.status_code == 429:
            raise RateLimited("finnhub 429 on /search")
        if resp.status_code >= 400:
            logger.warning("finnhub search HTTP {} for {!r}", resp.status_code, q)
            return []

        try:
            payload = resp.json()
        except ValueError:
            logger.warning("finnhub search returned non-JSON for {!r}", q)
            return []

        results: list[SymbolResult] = []
        for row in payload.get("result", []):
            symbol = self._map_symbol(row)
            if symbol is None:
                continue  # un-chartable MIC — drop it
            results.append(
                SymbolResult(
                    symbol=symbol,
                    name=row.get("description") or row.get("symbol") or symbol,
                    exchange=symbol.split(":", 1)[0],
                    type=_classify(row.get("type"), symbol),
                    currency=None,
                )
            )
            if len(results) >= _SEARCH_LIMIT:
                break
        return results

    @staticmethod
    def _map_symbol(row: dict) -> str | None:
        """Map a Finnhub search row to a chartable EXCHANGE:TICKER, or None.

        Crypto symbols already carry an exchange prefix and pass through;
        equities are reconstructed from MIC + ticker, dropping unknown MICs.
        """
        raw = (row.get("symbol") or "").strip()
        if not raw:
            return None

        # Crypto / already-prefixed (e.g. "BINANCE:BTCUSDT").
        if ":" in raw:
            return raw

        mic = (row.get("mic") or "").strip().upper()
        exchange = MIC_TO_EXCHANGE.get(mic)
        if exchange is None:
            return None

        # Prefer displaySymbol (human ticker, e.g. "BRK.B") but strip any
        # exchange suffix Finnhub sometimes appends (e.g. "TICKER.BK").
        ticker = (row.get("displaySymbol") or raw).strip().upper()
        if "." in ticker and mic == "XSET":
            ticker = ticker.split(".", 1)[0]
        return f"{exchange}:{ticker}"

    def quote(self, symbol: str) -> QuoteResponse | None:
        """Equity quote via Twelve Data (if keyed). Crypto is handled by the
        Binance provider in the façade, so we don't attempt it here."""
        if not self._twelvedata_api_key:
            return None
        if ":" not in symbol:
            return None
        exchange, ticker = symbol.split(":", 1)
        if exchange in {"BINANCE", "COINBASE", "KRAKEN"}:
            return None  # crypto — not ours

        try:
            resp = self._client.get(
                f"{_TWELVEDATA_BASE}/quote",
                params={"symbol": ticker, "apikey": self._twelvedata_api_key},
            )
        except httpx.HTTPError as exc:
            logger.warning("twelvedata quote network error for {!r}: {}", symbol, exc)
            return None

        if resp.status_code == 429:
            raise RateLimited("twelvedata 429 on /quote")
        if resp.status_code >= 400:
            logger.warning("twelvedata quote HTTP {} for {!r}", resp.status_code, symbol)
            return None

        try:
            data = resp.json()
        except ValueError:
            return None

        # Twelve Data signals soft errors (rate limit, bad symbol) in a
        # 200 body with status="error" — treat a 429-coded message as a
        # rate limit so the router can serve cache.
        if isinstance(data, dict) and data.get("status") == "error":
            if data.get("code") == 429:
                raise RateLimited("twelvedata rate limit (200 body)")
            logger.info("twelvedata quote error for {!r}: {}", symbol, data.get("message"))
            return None

        price = _to_float(data.get("close"))
        change_pct = _to_float(data.get("percent_change"))
        currency = data.get("currency")
        return QuoteResponse(
            symbol=symbol,
            price=price,
            currency=currency,
            change_percent=change_pct,
            as_of=datetime.now(timezone.utc),
            source="twelvedata",
        )


def _to_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
