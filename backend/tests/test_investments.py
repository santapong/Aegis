"""End-to-end tests for the /api/investments router."""
from tests.conftest import _register


def test_create_list_and_summary(client):
    headers, _ = _register(client)

    holdings = [
        {
            "name": "Apple",
            "tradingview_symbol": "NASDAQ:AAPL",
            "units": 10,
            "cost_basis": 1500,
            "current_price": 200,
        },
        {
            "name": "PTT",
            "tradingview_symbol": "SET:PTT",
            "units": 100,
            "cost_basis": 3500,
            "current_price": 40,
            "currency": "THB",
        },
        {
            "name": "Bitcoin",
            "tradingview_symbol": "BINANCE:BTCUSDT",
            "units": 0.05,
            "cost_basis": 2000,
            "current_price": 60000,
        },
    ]
    for h in holdings:
        r = client.post("/api/investments/", json=h, headers=headers)
        assert r.status_code == 201, r.text

    r = client.get("/api/investments/", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 3

    r = client.get("/api/investments/summary", headers=headers)
    assert r.status_code == 200, r.text
    summary = r.json()
    assert summary["holding_count"] == 3
    # AAPL value = 10 * 200 = 2000 (cost 1500, pl 500)
    # PTT  value = 100 * 40 = 4000 (cost 3500, pl 500)
    # BTC  value = 0.05 * 60000 = 3000 (cost 2000, pl 1000)
    assert summary["total_cost_basis"] == 7000.0
    assert summary["total_current_value"] == 9000.0
    assert summary["total_pl"] == 2000.0


def test_update_price_updates_summary(client):
    headers, _ = _register(client)
    r = client.post(
        "/api/investments/",
        json={
            "name": "Apple",
            "tradingview_symbol": "NASDAQ:AAPL",
            "units": 10,
            "cost_basis": 1500,
            "current_price": 200,
        },
        headers=headers,
    )
    assert r.status_code == 201
    inv_id = r.json()["id"]

    r = client.patch(
        f"/api/investments/{inv_id}",
        json={"current_price": 250},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    assert r.json()["current_price"] == 250
    assert r.json()["last_priced_at"] is not None

    r = client.get("/api/investments/summary", headers=headers)
    assert r.json()["total_current_value"] == 2500.0


def test_investments_isolated_per_user(client):
    h1, _ = _register(client, email="a@x.com", username="alice")
    h2, _ = _register(client, email="b@x.com", username="bobby")
    client.post(
        "/api/investments/",
        json={
            "name": "Apple",
            "tradingview_symbol": "NASDAQ:AAPL",
            "units": 1,
            "cost_basis": 200,
            "current_price": 200,
        },
        headers=h1,
    )
    assert len(client.get("/api/investments/", headers=h1).json()) == 1
    assert client.get("/api/investments/", headers=h2).json() == []
