"""Tests for the /api/market router (symbol search, quotes, status).

Providers are stubbed so these never touch the network — we exercise the
router's contract, validation, caching, auth, and error translation, not
Finnhub/Binance themselves. The one exception is ``/status``, which is
network-free (it only reports configured capability flags) and is asserted
against the real service in conftest's no-key (degraded) configuration.
"""
from app.schemas.market import QuoteResponse, SymbolResult
from app.services.market import RateLimited
from tests.conftest import _register


class _StubService:
    """Stand-in for ``MarketService`` with canned, network-free responses."""

    def __init__(self, *, results=None, quote=None, raise_rl=False,
                 provider="finnhub", degraded=False):
        self._results = results or []
        self._quote = quote
        self._raise_rl = raise_rl
        self.search_provider = provider
        self.degraded = degraded
        self.search_calls = 0

    def search(self, q):
        self.search_calls += 1
        if self._raise_rl:
            raise RateLimited()
        return self._results

    def quote(self, symbol):
        if self._raise_rl:
            raise RateLimited()
        return self._quote


def _patch_service(monkeypatch, service):
    """Swap the router's service factory for one returning ``service``."""
    monkeypatch.setattr(
        "app.routers.market.get_market_service", lambda: service
    )


# --- auth -------------------------------------------------------------------

def test_market_routes_require_auth(client):
    for path in (
        "/api/market/status",
        "/api/market/search?q=apple",
        "/api/market/quote?symbol=BINANCE:BTCUSDT",
    ):
        assert client.get(path).status_code in (401, 403), path


# --- status (real service, network-free) ------------------------------------

def test_status_degraded_without_finnhub_key(client):
    # conftest sets no FINNHUB_API_KEY → Binance-only, degraded.
    headers, _ = _register(client)
    r = client.get("/api/market/status", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["crypto_supported"] is True
    assert body["equities_supported"] is False
    assert body["providers"] == ["binance"]


# --- search: validation -----------------------------------------------------

def test_search_rejects_too_short_query(client):
    headers, _ = _register(client)
    # min_length=2 on the query param → 422 before the handler runs.
    assert client.get("/api/market/search?q=a", headers=headers).status_code == 422


def test_search_rechecks_length_after_trim(client, monkeypatch):
    # "  a " passes min_length=2 (4 raw chars) but is 1 char after trim →
    # empty result WITHOUT ever calling the provider.
    headers, _ = _register(client)
    stub = _StubService()
    _patch_service(monkeypatch, stub)
    r = client.get("/api/market/search", params={"q": "  a "}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["results"] == []
    assert stub.search_calls == 0


# --- search: happy path + caching -------------------------------------------

def test_search_returns_results_and_caches(client, monkeypatch):
    headers, _ = _register(client)
    stub = _StubService(
        provider="finnhub",
        degraded=False,
        results=[
            SymbolResult(symbol="NASDAQ:AAPL", name="Apple Inc",
                         exchange="NASDAQ", type="stock", currency="USD"),
            SymbolResult(symbol="BINANCE:BTCUSDT", name="Bitcoin",
                         exchange="BINANCE", type="crypto", currency=None),
        ],
    )
    _patch_service(monkeypatch, stub)

    r = client.get("/api/market/search", params={"q": "apple"}, headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["provider"] == "finnhub"
    assert body["degraded"] is False
    assert [x["symbol"] for x in body["results"]] == [
        "NASDAQ:AAPL", "BINANCE:BTCUSDT"
    ]
    assert body["results"][0]["type"] == "stock"

    # An identical query is served from the global cache — provider not re-hit.
    r2 = client.get("/api/market/search", params={"q": "apple"}, headers=headers)
    assert r2.status_code == 200
    assert stub.search_calls == 1


def test_search_rate_limited_returns_503(client, monkeypatch):
    headers, _ = _register(client)
    _patch_service(monkeypatch, _StubService(raise_rl=True))
    # "tesla" is a fresh key (cache miss) → provider raises → 503.
    r = client.get("/api/market/search", params={"q": "tesla"}, headers=headers)
    assert r.status_code == 503
    assert r.json()["detail"] == "rate_limited"


# --- quote ------------------------------------------------------------------

def test_quote_returns_canned_quote(client, monkeypatch):
    headers, _ = _register(client)
    _patch_service(monkeypatch, _StubService(quote=QuoteResponse(
        symbol="BINANCE:BTCUSDT", price=60000.0, currency="USD",
        change_percent=2.5, source="binance",
    )))
    # lowercase input — the router uppercases before returning/caching.
    r = client.get("/api/market/quote", params={"symbol": "binance:btcusdt"},
                   headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["price"] == 60000.0
    assert body["change_percent"] == 2.5
    assert body["source"] == "binance"


def test_quote_is_well_formed_when_unavailable(client, monkeypatch):
    headers, _ = _register(client)
    _patch_service(monkeypatch, _StubService(quote=None))
    r = client.get("/api/market/quote", params={"symbol": "NASDAQ:ZZZZ"},
                   headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["symbol"] == "NASDAQ:ZZZZ"  # echoed, uppercased
    assert body["price"] is None
    assert body["source"] is None
