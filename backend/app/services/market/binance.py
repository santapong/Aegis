"""Binance public-REST market provider (keyless, crypto only).

Used as the zero-key fallback when no Finnhub key is configured, and as
the crypto-quote source alongside Finnhub. The Binance spot API is
keyless and high-limit; everything it returns maps natively onto a
TradingView ``BINANCE:<SYMBOL>`` chart.

- Search filters the full ``/exchangeInfo`` symbol table (cached for the
  search TTL — it's large and near-static) to TRADING pairs quoted in a
  USD-ish asset, ranked so prefix matches surface first.
- Quote uses ``/ticker/24hr`` for last price + 24 h percent change.
"""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
from loguru import logger

from ...cache import get_cache
from ...schemas.market import QuoteResponse, SymbolResult
from .base import MarketProvider, RateLimited

_BINANCE_BASE = "https://api.binance.com/api/v3"
_TIMEOUT = httpx.Timeout(6.0)
_SEARCH_LIMIT = 10
# Prefer dollar-quoted pairs so the displayed price reads in USD terms.
_QUOTE_ASSETS = {"USDT", "USD", "FDUSD"}
_EXCHANGE_INFO_CACHE_KEY = "market:binance:exchangeinfo"


class BinanceProvider(MarketProvider):
    name = "binance"

    def __init__(self, exchange_info_ttl: int = 600) -> None:
        # Reuse the search TTL for the (large, near-static) symbol table.
        self._exchange_info_ttl = exchange_info_ttl

    @property
    def _client(self) -> httpx.Client:
        client = getattr(self, "_http", None)
        if client is None:
            client = httpx.Client(timeout=_TIMEOUT)
            self._http = client
        return client

    def _load_symbols(self) -> list[dict]:
        """Return a trimmed list of tradable USD-quoted symbols.

        Cached globally so we hit Binance's heavy ``/exchangeInfo`` at most
        once per TTL across all users.
        """
        cache = get_cache()
        cached = cache.get(_EXCHANGE_INFO_CACHE_KEY)
        if cached is not None:
            return cached

        try:
            resp = self._client.get(f"{_BINANCE_BASE}/exchangeInfo")
        except httpx.HTTPError as exc:
            logger.warning("binance exchangeInfo network error: {}", exc)
            return []

        if resp.status_code == 429:
            raise RateLimited("binance 429 on /exchangeInfo")
        if resp.status_code >= 400:
            logger.warning("binance exchangeInfo HTTP {}", resp.status_code)
            return []

        try:
            payload = resp.json()
        except ValueError:
            return []

        trimmed = [
            {
                "symbol": s.get("symbol", ""),
                "baseAsset": s.get("baseAsset", ""),
                "quoteAsset": s.get("quoteAsset", ""),
            }
            for s in payload.get("symbols", [])
            if s.get("status") == "TRADING" and s.get("quoteAsset") in _QUOTE_ASSETS
        ]
        cache.set(_EXCHANGE_INFO_CACHE_KEY, trimmed, self._exchange_info_ttl)
        return trimmed

    def search(self, q: str) -> list[SymbolResult]:
        symbols = self._load_symbols()
        if not symbols:
            return []

        needle = q.upper()
        prefix: list[SymbolResult] = []
        contains: list[SymbolResult] = []
        for s in symbols:
            base = s["baseAsset"].upper()
            sym = s["symbol"].upper()
            if needle not in base and needle not in sym:
                continue
            result = SymbolResult(
                symbol=f"BINANCE:{s['symbol']}",
                name=f"{s['baseAsset']} / {s['quoteAsset']}",
                exchange="BINANCE",
                type="crypto",
                currency=s["quoteAsset"],
            )
            # Rank exact base / prefix matches above substring hits.
            if base.startswith(needle) or sym.startswith(needle):
                prefix.append(result)
            else:
                contains.append(result)
            if len(prefix) >= _SEARCH_LIMIT:
                break

        ranked = (prefix + contains)[:_SEARCH_LIMIT]
        return ranked

    def quote(self, symbol: str) -> QuoteResponse | None:
        # Accept either "BINANCE:BTCUSDT" or a bare "BTCUSDT".
        base = symbol.split(":", 1)[1] if ":" in symbol else symbol
        base = base.upper()
        if ":" in symbol and not symbol.upper().startswith("BINANCE:"):
            return None  # not a Binance symbol — not ours to price

        try:
            resp = self._client.get(
                f"{_BINANCE_BASE}/ticker/24hr", params={"symbol": base}
            )
        except httpx.HTTPError as exc:
            logger.warning("binance ticker network error for {!r}: {}", symbol, exc)
            return None

        if resp.status_code == 429:
            raise RateLimited("binance 429 on /ticker/24hr")
        if resp.status_code >= 400:
            # 400 here usually means "unknown symbol" — not an error worth
            # a 500; just report no quote.
            logger.info("binance ticker HTTP {} for {!r}", resp.status_code, symbol)
            return None

        try:
            data = resp.json()
        except ValueError:
            return None

        price = _to_float(data.get("lastPrice"))
        change_pct = _to_float(data.get("priceChangePercent"))
        # Quote asset is the part of the pair after the base; we can't
        # split reliably without the table, so report the USD-ish quote
        # implied by the pair suffix when obvious.
        currency = _infer_quote_asset(base)
        return QuoteResponse(
            symbol=f"BINANCE:{base}",
            price=price,
            currency=currency,
            change_percent=change_pct,
            as_of=datetime.now(timezone.utc),
            source="binance",
        )


def _infer_quote_asset(pair: str) -> str | None:
    for quote in ("FDUSD", "USDT", "USDC", "USD"):
        if pair.endswith(quote):
            return quote
    return None


def _to_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
