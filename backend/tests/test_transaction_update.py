"""Tests for the new PUT /api/transactions/{id} endpoint."""
from .conftest import _register


def test_update_transaction_round_trip(client):
    headers, _ = _register(client, email="upd@example.com", username="upd")
    r = client.post(
        "/api/transactions/",
        json={"amount": 10, "type": "expense", "category": "food", "date": "2026-05-01"},
        headers=headers,
    )
    txn_id = r.json()["id"]

    r = client.put(
        f"/api/transactions/{txn_id}",
        json={"amount": 25, "category": "groceries"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["amount"] == 25.0
    assert body["category"] == "groceries"
    # Unchanged field stays untouched
    assert body["date"] == "2026-05-01"


def test_update_unknown_transaction_404(client):
    headers, _ = _register(client, email="upd404@example.com", username="upd404")
    r = client.put(
        "/api/transactions/no-such-id",
        json={"amount": 99},
        headers=headers,
    )
    assert r.status_code == 404


def test_update_isolation(client):
    h1, _ = _register(client, email="upd-iso-1@example.com", username="updiso1")
    h2, _ = _register(client, email="upd-iso-2@example.com", username="updiso2")
    r = client.post(
        "/api/transactions/",
        json={"amount": 10, "type": "expense", "category": "food", "date": "2026-05-01"},
        headers=h1,
    )
    txn_id = r.json()["id"]
    r = client.put(f"/api/transactions/{txn_id}", json={"amount": 1}, headers=h2)
    assert r.status_code == 404


def test_update_retriggers_budget_alert(client):
    """Updating a transaction amount that pushes spend over a cap fires the alert."""
    headers, _ = _register(client, email="upd-alert@example.com", username="updalert")
    client.post(
        "/api/budgets/",
        json={
            "name": "Food",
            "amount": 100,
            "category": "food",
            "period_start": "2026-05-01",
            "period_end": "2026-05-31",
        },
        headers=headers,
    )
    r = client.post(
        "/api/transactions/",
        json={"amount": 30, "type": "expense", "category": "food", "date": "2026-05-05"},
        headers=headers,
    )
    txn_id = r.json()["id"]
    assert client.get("/api/notifications/", headers=headers).json()["items"] == []

    client.put(f"/api/transactions/{txn_id}", json={"amount": 110}, headers=headers)
    titles = [n["title"] for n in client.get("/api/notifications/", headers=headers).json()["items"]]
    assert any("Budget over" in t for t in titles), titles
