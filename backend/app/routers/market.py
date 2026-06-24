"""Market-data endpoints — symbol search, quotes, and capability status.

Backs the investments symbol picker. All routes sit behind
``get_current_user`` (no anonymous access to the upstream quota) and the
existing per-IP ``RateLimitMiddleware``.

Caching is GLOBAL, not user-scoped — symbol/quote data is identical for
every user, so keys are ``market:search:<q_norm>`` / ``market:quote:<symbol>``
and are deliberately NOT registered in the user-scope invalidation list.

Resilience contract:
- Provider HTTP 429 → serve the last cached value if present, else
  ``503 {"detail": "rate_limited"}``.
- Any other provider/network error degrades to empty/None — never a 500.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_user
from ..cache import get_cache
from ..config import get_settings
from ..models.user import User
from ..schemas.market import (
    MarketStatus,
    QuoteResponse,
    SymbolResult,
    SymbolSearchResponse,
)
from ..services.market import RateLimited, get_market_service

router = APIRouter(prefix="/api/market", tags=["market"])
_settings = get_settings()


def _norm_query(q: str) -> str:
    return q.strip().lower()


@router.get("/search", response_model=SymbolSearchResponse)
def search_symbols(
    q: str = Query(..., min_length=2, max_length=64),
    current_user: User = Depends(get_current_user),
):
    service = get_market_service()
    q_norm = _norm_query(q)
    # min_length on the param counts pre-trim chars; re-check after trim
    # so "  a " can't slip a 1-char query past validation.
    if len(q_norm) < 2:
        return SymbolSearchResponse(
            results=[], provider=service.search_provider, degraded=service.degraded
        )

    cache = get_cache()
    cache_key = f"market:search:{q_norm}"
    cached = cache.get(cache_key)
    if cached is not None:
        return SymbolSearchResponse(**cached)

    try:
        results: list[SymbolResult] = service.search(q_norm)
    except RateLimited:
        # Nothing cached (checked above) → signal the client to back off.
        raise HTTPException(status_code=503, detail="rate_limited")

    response = SymbolSearchResponse(
        results=results,
        provider=service.search_provider,
        degraded=service.degraded,
    )
    cache.set(cache_key, response, _settings.market_search_ttl)
    return response


@router.get("/quote", response_model=QuoteResponse)
def get_quote(
    symbol: str = Query(..., min_length=1, max_length=64),
    current_user: User = Depends(get_current_user),
):
    service = get_market_service()
    # Normalise case so `btc:...`/`BTC:...` share one cache entry and the
    # returned symbol matches the uppercase EXCHANGE:TICKER the UI stores.
    symbol = symbol.strip().upper()

    cache = get_cache()
    cache_key = f"market:quote:{symbol}"
    cached = cache.get(cache_key)
    if cached is not None:
        return QuoteResponse(**cached)

    try:
        quote = service.quote(symbol)
    except RateLimited:
        raise HTTPException(status_code=503, detail="rate_limited")

    # Always return a well-formed QuoteResponse; null market fields mean
    # "unavailable" and the UI keeps manual price entry. We still cache
    # the null result briefly to avoid hammering a provider that has no
    # data for this symbol.
    if quote is None:
        quote = QuoteResponse(symbol=symbol)

    cache.set(cache_key, quote, _settings.market_quote_ttl)
    return quote


@router.get("/status", response_model=MarketStatus)
def market_status(current_user: User = Depends(get_current_user)):
    return get_market_service().status()
