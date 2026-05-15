"""Tests for /api/preferences — the server-backed replacement for the
zustand-only settings store."""
from .conftest import _register


DEFAULTS = {
    "currency": "USD",
    "default_date_range_days": 30,
    "items_per_page": 25,
    "ai_auto_suggestions": True,
}


def test_get_preferences_auto_creates_with_defaults(client):
    headers, _ = _register(client, email="prefs1@example.com", username="prefs1")

    r = client.get("/api/preferences", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == DEFAULTS

    # A second GET must return the same row, not a fresh one — proves
    # _get_or_create is idempotent.
    r = client.get("/api/preferences", headers=headers)
    assert r.status_code == 200
    assert r.json() == DEFAULTS


def test_put_preferences_round_trip(client):
    headers, _ = _register(client, email="prefs2@example.com", username="prefs2")

    new_values = {
        "currency": "EUR",
        "default_date_range_days": 90,
        "items_per_page": 50,
        "ai_auto_suggestions": False,
    }
    r = client.put("/api/preferences", json=new_values, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json() == new_values

    # GET must reflect what PUT wrote.
    r = client.get("/api/preferences", headers=headers)
    assert r.status_code == 200
    assert r.json() == new_values


def test_partial_update_does_not_clobber_other_fields(client):
    headers, _ = _register(client, email="prefs3@example.com", username="prefs3")

    # Seed everything to non-defaults.
    client.put(
        "/api/preferences",
        json={
            "currency": "GBP",
            "default_date_range_days": 60,
            "items_per_page": 100,
            "ai_auto_suggestions": False,
        },
        headers=headers,
    )

    # PUT only currency — other fields must survive untouched.
    r = client.put(
        "/api/preferences", json={"currency": "JPY"}, headers=headers
    )
    assert r.status_code == 200
    body = r.json()
    assert body["currency"] == "JPY"
    assert body["default_date_range_days"] == 60
    assert body["items_per_page"] == 100
    assert body["ai_auto_suggestions"] is False


def test_preferences_isolated_per_user(client):
    h1, _ = _register(client, email="pref-a@example.com", username="prefa")
    h2, _ = _register(client, email="pref-b@example.com", username="prefb")

    client.put(
        "/api/preferences",
        json={"currency": "EUR", "items_per_page": 10},
        headers=h1,
    )

    # User 2 must still see defaults — their row was auto-created independently.
    r = client.get("/api/preferences", headers=h2)
    assert r.status_code == 200
    assert r.json() == DEFAULTS

    # And user 1's row is untouched by user 2's GET.
    r = client.get("/api/preferences", headers=h1)
    assert r.json()["currency"] == "EUR"
    assert r.json()["items_per_page"] == 10


def test_put_first_without_prior_get_still_creates(client):
    """PUT must be safe to call before GET — it should create the row."""
    headers, _ = _register(client, email="prefs4@example.com", username="prefs4")

    r = client.put(
        "/api/preferences", json={"currency": "THB"}, headers=headers
    )
    assert r.status_code == 200
    body = r.json()
    assert body["currency"] == "THB"
    # Other fields fall back to defaults from the freshly-created row.
    assert body["default_date_range_days"] == DEFAULTS["default_date_range_days"]
    assert body["items_per_page"] == DEFAULTS["items_per_page"]
    assert body["ai_auto_suggestions"] == DEFAULTS["ai_auto_suggestions"]


def test_preferences_requires_auth(client):
    r = client.get("/api/preferences")
    assert r.status_code in (401, 403)
    r = client.put("/api/preferences", json={"currency": "USD"})
    assert r.status_code in (401, 403)


def test_put_rejects_invalid_values(client):
    headers, _ = _register(client, email="prefs5@example.com", username="prefs5")

    # items_per_page must be positive
    r = client.put(
        "/api/preferences", json={"items_per_page": 0}, headers=headers
    )
    assert r.status_code == 422
