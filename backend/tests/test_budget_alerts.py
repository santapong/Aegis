"""Tests for the budget overrun notification wiring."""
from .conftest import _register


def _category_budget(client, headers, *, name, amount, category, start, end, trip_id=None):
    body = {
        "name": name,
        "amount": amount,
        "category": category,
        "period_start": start,
        "period_end": end,
    }
    if trip_id:
        body["trip_id"] = trip_id
    r = client.post("/api/budgets/", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _txn(client, headers, *, amount, category, date, trip_id=None):
    body = {"amount": amount, "type": "expense", "category": category, "date": date}
    if trip_id:
        body["trip_id"] = trip_id
    r = client.post("/api/transactions/", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _notifications(client, headers):
    r = client.get("/api/notifications/", headers=headers)
    assert r.status_code == 200
    return r.json()["items"]


def test_budget_alerts_fire_at_80_and_100(client):
    headers, _ = _register(client, email="alerts@example.com", username="alerts")

    _category_budget(
        client, headers,
        name="Food", amount=100, category="food",
        start="2026-05-01", end="2026-05-31",
    )

    # 50% — no notification
    _txn(client, headers, amount=50, category="food", date="2026-05-05")
    assert _notifications(client, headers) == []

    # 80% — warning fires
    _txn(client, headers, amount=30, category="food", date="2026-05-10")
    notes = _notifications(client, headers)
    titles = [n["title"] for n in notes]
    assert any("80% used" in t for t in titles), notes

    # 100% — over fires (and 80% is NOT duplicated)
    _txn(client, headers, amount=25, category="food", date="2026-05-15")
    notes = _notifications(client, headers)
    titles = [n["title"] for n in notes]
    assert any("Budget over" in t for t in titles)
    assert sum(1 for t in titles if "80% used" in t) == 1, titles

    # Another expense in the same period must NOT re-fire either threshold
    _txn(client, headers, amount=20, category="food", date="2026-05-20")
    notes2 = _notifications(client, headers)
    assert len(notes2) == len(notes)


def test_budget_alerts_ignore_other_category(client):
    headers, _ = _register(client, email="cat@example.com", username="cat")
    _category_budget(
        client, headers,
        name="Food", amount=100, category="food",
        start="2026-05-01", end="2026-05-31",
    )
    _txn(client, headers, amount=120, category="transport", date="2026-05-05")
    assert _notifications(client, headers) == []


def test_income_transaction_does_not_fire_budget_alert(client):
    headers, _ = _register(client, email="income@example.com", username="income")
    _category_budget(
        client, headers,
        name="Food", amount=100, category="food",
        start="2026-05-01", end="2026-05-31",
    )
    r = client.post(
        "/api/transactions/",
        json={"amount": 500, "type": "income", "category": "food", "date": "2026-05-05"},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert _notifications(client, headers) == []


def test_trip_txn_evaluates_both_trip_and_monthly_budgets(client):
    """A transaction tagged with trip_id but in a category that has a separate
    monthly budget must still trip the monthly budget."""
    headers, _ = _register(client, email="both@example.com", username="bothbudgets")

    # Create a trip with a trip-budget for "lodging" only.
    r = client.post(
        "/api/trips/",
        json={"title": "Paris", "start_date": "2026-06-01", "end_date": "2026-06-07"},
        headers=headers,
    )
    trip_id = r.json()["id"]
    _category_budget(
        client, headers,
        name="Trip lodging", amount=500, category="lodging",
        start="2026-06-01", end="2026-06-07", trip_id=trip_id,
    )

    # Separately the user has a tight monthly "dining" budget.
    _category_budget(
        client, headers,
        name="Dining", amount=100, category="dining",
        start="2026-06-01", end="2026-06-30",
    )

    # Trip-tagged dining expense at 90% of the monthly dining cap should fire
    # the dining budget alert (this regressed in v1.1 where trip-tagged txns
    # short-circuited the category lookup).
    r = client.post(
        "/api/transactions/",
        json={"amount": 90, "type": "expense", "category": "dining", "date": "2026-06-02", "trip_id": trip_id},
        headers=headers,
    )
    assert r.status_code == 201
    titles = [n["title"] for n in _notifications(client, headers)]
    assert any("80% used: Dining" in t for t in titles), titles


def test_budget_alerts_for_trip_budget(client):
    """Trip-linked budgets dedupe by their actual period, not the calendar month."""
    headers, _ = _register(client, email="trip-alerts@example.com", username="tripalerts")

    r = client.post(
        "/api/trips/",
        json={"title": "Roma", "start_date": "2026-09-10", "end_date": "2026-09-17"},
        headers=headers,
    )
    trip_id = r.json()["id"]

    _category_budget(
        client, headers,
        name="Trip food", amount=200, category="dining",
        start="2026-09-10", end="2026-09-17",
        trip_id=trip_id,
    )

    # 90% in one shot — fires both 80% AND 100% checks... wait, 90% only crosses 80%
    _txn(client, headers, amount=180, category="dining", date="2026-09-11", trip_id=trip_id)
    titles = [n["title"] for n in _notifications(client, headers)]
    assert any("80% used" in t for t in titles)
    assert not any("Budget over" in t for t in titles)

    # Cross 100%
    _txn(client, headers, amount=50, category="dining", date="2026-09-12", trip_id=trip_id)
    titles = [n["title"] for n in _notifications(client, headers)]
    assert any("Budget over" in t for t in titles)
