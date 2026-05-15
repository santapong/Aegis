"""Tests for the Trip entity + /api/trips/{id}/summary rollup."""
from .conftest import _register


def test_trip_crud(client):
    headers, _ = _register(client, email="trip@example.com", username="trip")

    # Create
    r = client.post(
        "/api/trips/",
        json={
            "title": "Thailand May 2026",
            "destination": "Bangkok",
            "start_date": "2026-05-20",
            "end_date": "2026-05-27",
            "total_budget": 2000,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    trip = r.json()
    assert trip["status"] == "planned"
    trip_id = trip["id"]

    # List
    r = client.get("/api/trips/", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1

    # Update
    r = client.put(
        f"/api/trips/{trip_id}",
        json={"status": "active", "notes": "Confirmed flights"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "active"
    assert r.json()["notes"] == "Confirmed flights"

    # Delete
    r = client.delete(f"/api/trips/{trip_id}", headers=headers)
    assert r.status_code == 204
    r = client.get(f"/api/trips/{trip_id}", headers=headers)
    assert r.status_code == 404


def test_trip_summary_rolls_up_linked_budgets_and_transactions(client):
    headers, _ = _register(client, email="rollup@example.com", username="rollup")

    # Create trip
    r = client.post(
        "/api/trips/",
        json={
            "title": "Tokyo",
            "start_date": "2026-06-01",
            "end_date": "2026-06-07",
        },
        headers=headers,
    )
    trip_id = r.json()["id"]

    # Two budget lines under the trip
    client.post(
        "/api/budgets/",
        json={
            "name": "Flights",
            "amount": 800,
            "category": "flights",
            "period_start": "2026-06-01",
            "period_end": "2026-06-07",
            "trip_id": trip_id,
        },
        headers=headers,
    )
    client.post(
        "/api/budgets/",
        json={
            "name": "Hotel",
            "amount": 600,
            "category": "lodging",
            "period_start": "2026-06-01",
            "period_end": "2026-06-07",
            "trip_id": trip_id,
        },
        headers=headers,
    )

    # Three transactions, one belongs to a category with no budget (still rolled up)
    for txn in [
        {"amount": 750, "type": "expense", "category": "flights", "date": "2026-06-01", "trip_id": trip_id},
        {"amount": 400, "type": "expense", "category": "lodging", "date": "2026-06-02", "trip_id": trip_id},
        {"amount": 50,  "type": "expense", "category": "food",    "date": "2026-06-03", "trip_id": trip_id},
    ]:
        r = client.post("/api/transactions/", json=txn, headers=headers)
        assert r.status_code == 201, r.text

    # An unrelated transaction with no trip_id must NOT be rolled into the trip
    client.post(
        "/api/transactions/",
        json={"amount": 999, "type": "expense", "category": "flights", "date": "2026-06-04"},
        headers=headers,
    )

    r = client.get(f"/api/trips/{trip_id}/summary", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_budgeted"] == 1400.0
    assert body["total_spent"] == 1200.0
    assert body["transaction_count"] == 3
    cats = {c["category"]: c for c in body["by_category"]}
    assert cats["flights"]["budgeted"] == 800.0
    assert cats["flights"]["spent"] == 750.0
    assert cats["food"]["budgeted"] == 0.0
    assert cats["food"]["spent"] == 50.0


def test_trip_isolation_per_user(client):
    h1, _ = _register(client, email="u1@example.com", username="user1")
    h2, _ = _register(client, email="u2@example.com", username="user2")

    r = client.post(
        "/api/trips/",
        json={"title": "Mine", "start_date": "2026-07-01", "end_date": "2026-07-02"},
        headers=h1,
    )
    trip_id = r.json()["id"]

    # Other user cannot see or summary it
    r = client.get(f"/api/trips/{trip_id}", headers=h2)
    assert r.status_code == 404
    r = client.get(f"/api/trips/{trip_id}/summary", headers=h2)
    assert r.status_code == 404
    r = client.get("/api/trips/", headers=h2)
    assert r.json() == []


def test_trip_rejects_end_before_start(client):
    headers, _ = _register(client, email="bad-dates@example.com", username="baddates")
    r = client.post(
        "/api/trips/",
        json={"title": "Backwards", "start_date": "2026-08-10", "end_date": "2026-08-01"},
        headers=headers,
    )
    assert r.status_code == 422
