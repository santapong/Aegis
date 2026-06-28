"""Tests for budget templates (50/30/20, zero-based) one-click adoption.

Covers AC1 (list), AC2 (adopt sizes amounts for the current period), AC3
(idempotent re-adopt at the application layer), the round-2 gate fix
(template categories are real Aegis spend categories, so an adopted budget
tracks spend in ``GET /api/budgets/comparison`` instead of reading $0), and
the round-2 Review-gate regression checks: adopting a template must not break
the plain ``POST /api/budgets/`` create path — there is no DB unique
constraint on budgets.
"""
from datetime import date, timedelta

from app.schemas.budget import KNOWN_BUDGET_CATEGORIES

from .conftest import _register


def _first_of_month_and_end():
    today = date.today()
    start = today.replace(day=1)
    if today.month == 12:
        next_first = today.replace(year=today.year + 1, month=1, day=1)
    else:
        next_first = today.replace(month=today.month + 1, day=1)
    end = next_first - timedelta(days=1)
    return start.isoformat(), end.isoformat()


def test_list_templates_returns_catalog(client):
    headers, _ = _register(client, email="tpl-list@example.com", username="tpllist")
    r = client.get("/api/budgets/templates", headers=headers)
    assert r.status_code == 200, r.text
    templates = r.json()["templates"]
    keys = {t["key"] for t in templates}
    # AC1: at least two templates, including the named ones.
    assert len(templates) >= 2
    assert {"50-30-20", "zero-based"} <= keys

    # Every template allocates 100% of income to real, distinct categories.
    for t in templates:
        cats = [c["category"] for c in t["categories"]]
        total = round(sum(c["pct"] for c in t["categories"]), 6)
        assert total == 1.0, t["key"]
        assert len(cats) == len(set(cats)), f"{t['key']} has duplicate category"


def test_templates_use_real_aegis_categories(client):
    """Round-2 gate (CORRECTNESS): every template category must be a real
    Aegis spend category, otherwise the adopted budget can never compare
    against spend (comparison joins category by strict equality)."""
    headers, _ = _register(client, email="tpl-real@example.com", username="tplreal")
    templates = client.get("/api/budgets/templates", headers=headers).json()["templates"]
    for t in templates:
        for c in t["categories"]:
            assert c["category"] in KNOWN_BUDGET_CATEGORIES, (
                f"{t['key']}: category {c['category']!r} is not a real Aegis "
                f"category, adopted budget would read $0 forever"
            )


def test_50_30_20_preserves_tier_shape(client):
    """The 50/30/20 rule is mapped onto real categories but must still sum to
    50% needs / 30% wants / 20% savings across its tiers."""
    headers, _ = _register(client, email="tpl-tier@example.com", username="tpltier")
    templates = client.get("/api/budgets/templates", headers=headers).json()["templates"]
    fifty = next(t for t in templates if t["key"] == "50-30-20")
    by_tier: dict[str, float] = {}
    for c in fifty["categories"]:
        assert c["tier"] in {"needs", "wants", "savings"}, c
        by_tier[c["tier"]] = by_tier.get(c["tier"], 0.0) + c["pct"]
    assert round(by_tier["needs"], 6) == 0.50
    assert round(by_tier["wants"], 6) == 0.30
    assert round(by_tier["savings"], 6) == 0.20


def test_list_templates_requires_auth(client):
    r = client.get("/api/budgets/templates")
    assert r.status_code == 401


def test_adopt_creates_budget_per_category_for_current_period(client):
    headers, _ = _register(client, email="adopt@example.com", username="adopt")

    # Resolve the catalog so the test follows the real category split rather
    # than hard-coding it (the split is allowed to evolve as long as the
    # contract — one row per category, amount = round(income*pct,2) — holds).
    template = next(
        t
        for t in client.get("/api/budgets/templates", headers=headers).json()["templates"]
        if t["key"] == "50-30-20"
    )

    r = client.post(
        "/api/budgets/templates/50-30-20/adopt",
        json={"monthly_income": 5000},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    rows = r.json()
    assert len(rows) == len(template["categories"])

    start, end = _first_of_month_and_end()
    by_cat = {row["category"]: row for row in rows}
    # AC2: amount == round(income * pct, 2); period is the current month.
    for c in template["categories"]:
        assert by_cat[c["category"]]["amount"] == round(5000 * c["pct"], 2)
    for row in rows:
        assert row["period_start"] == start
        assert row["period_end"] == end
        assert row["id"]
        assert row["name"]

    # The rows are actually persisted and listable.
    listed = client.get("/api/budgets/", headers=headers).json()
    assert {b["category"] for b in listed} == {c["category"] for c in template["categories"]}


def test_adopted_budget_tracks_real_spend_in_comparison(client):
    """Round-2 gate (CORRECTNESS): the whole point of aligning categories —
    an adopted budget must compare against real spend, not read 0% forever."""
    headers, _ = _register(client, email="track@example.com", username="track")
    start, end = _first_of_month_and_end()

    r = client.post(
        "/api/budgets/templates/zero-based/adopt",
        json={"monthly_income": 4000},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    groceries_budget = next(b for b in r.json() if b["category"] == "groceries")

    # Log a real grocery expense inside the current period.
    spend_date = date.today().replace(day=1).isoformat()
    txn = client.post(
        "/api/transactions/",
        json={"amount": 120, "type": "expense", "category": "groceries", "date": spend_date},
        headers=headers,
    )
    assert txn.status_code == 201, txn.text

    comp = client.get(
        f"/api/budgets/comparison?period_start={start}&period_end={end}",
        headers=headers,
    )
    assert comp.status_code == 200, comp.text
    by_cat = {c["category"]: c for c in comp.json()["comparisons"]}
    assert "groceries" in by_cat, "adopted category missing from comparison"
    # The spend is tracked against the adopted budget — not $0.
    assert by_cat["groceries"]["actual_spent"] == 120.0
    assert by_cat["groceries"]["budget_amount"] == groceries_budget["amount"]
    assert by_cat["groceries"]["usage_percent"] > 0


def test_adopt_amount_rounding(client):
    headers, _ = _register(client, email="round@example.com", username="rounder")
    r = client.post(
        "/api/budgets/templates/50-30-20/adopt",
        json={"monthly_income": 3333.33},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    template = next(
        t
        for t in client.get("/api/budgets/templates", headers=headers).json()["templates"]
        if t["key"] == "50-30-20"
    )
    pct_by_cat = {c["category"]: c["pct"] for c in template["categories"]}
    by_cat = {row["category"]: row["amount"] for row in r.json()}
    # Amounts are exactly round(income * pct, 2). Assert the contract by
    # recomputing it rather than hard-coding floats (IEEE-754 + round-half-to-
    # even can land off the naive expectation).
    for cat, amount in by_cat.items():
        assert amount == round(3333.33 * pct_by_cat[cat], 2), cat


def test_adopt_is_idempotent_no_duplicates(client):
    headers, _ = _register(client, email="idem@example.com", username="idempotent")

    first = client.post(
        "/api/budgets/templates/zero-based/adopt",
        json={"monthly_income": 4000},
        headers=headers,
    )
    assert first.status_code == 201, first.text
    first_rows = first.json()
    first_ids = sorted(row["id"] for row in first_rows)

    # AC3: re-adopt the same template+period -> zero new rows, same ids.
    second = client.post(
        "/api/budgets/templates/zero-based/adopt",
        json={"monthly_income": 4000},
        headers=headers,
    )
    assert second.status_code == 201, second.text
    second_ids = sorted(row["id"] for row in second.json())
    assert second_ids == first_ids

    # Total budget rows for these categories is exactly one per category.
    listed = client.get("/api/budgets/", headers=headers).json()
    cats = [b["category"] for b in listed]
    assert len(cats) == len(set(cats)) == len(first_rows)


def test_adopt_against_existing_rows_no_duplicates(client):
    """Idempotency: adopt over a period that already holds the template's rows
    creates nothing new and returns the existing set.

    Inserts the full template set directly (a committed prior adopt / another
    tab) and then calls adopt: the route's existence check sees them and skips
    every insert, returning the existing rows with no duplicates. This is the
    sequential idempotency guarantee; a true simultaneous double-commit is the
    documented low-severity gap (design 005, Decision 2).
    """
    from app.models.budget import Budget
    from app.schemas.budget import BUDGET_TEMPLATES_BY_KEY
    from app.database import get_db
    from app.main import app

    headers, user_id = _register(client, email="race@example.com", username="racer")
    template = BUDGET_TEMPLATES_BY_KEY["50-30-20"]
    start_s, end_s = _first_of_month_and_end()
    period_start = date.fromisoformat(start_s)
    period_end = date.fromisoformat(end_s)

    # Pre-insert the full set via the same DB session the app uses, mimicking a
    # concurrent request that committed between this request's existence check
    # and its commit.
    db = next(app.dependency_overrides[get_db]())
    try:
        for c in template.categories:
            db.add(
                Budget(
                    user_id=user_id,
                    name=f"pre — {c.category}",
                    amount=1,
                    category=c.category,
                    period_start=period_start,
                    period_end=period_end,
                )
            )
        db.commit()
    finally:
        db.close()

    # Adopt now races against pre-existing rows. Must succeed and return
    # exactly the existing set, with no duplicates created.
    r = client.post(
        "/api/budgets/templates/50-30-20/adopt",
        json={"monthly_income": 5000},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    assert len(r.json()) == len(template.categories)

    listed = client.get("/api/budgets/", headers=headers).json()
    cats = [b["category"] for b in listed]
    assert len(cats) == len(set(cats)) == len(template.categories), cats


def test_adopt_unknown_template_404(client):
    headers, _ = _register(client, email="nokey@example.com", username="nokey")
    r = client.post(
        "/api/budgets/templates/does-not-exist/adopt",
        json={"monthly_income": 1000},
        headers=headers,
    )
    assert r.status_code == 404


def test_adopt_rejects_non_positive_income(client):
    headers, _ = _register(client, email="badincome@example.com", username="badincome")
    r = client.post(
        "/api/budgets/templates/50-30-20/adopt",
        json={"monthly_income": 0},
        headers=headers,
    )
    assert r.status_code == 422


def test_adopt_is_user_scoped(client):
    """One user's adoption must not collide with another's idempotency check."""
    h1, _ = _register(client, email="u1@example.com", username="u1scoped")
    h2, _ = _register(client, email="u2@example.com", username="u2scoped")

    r1 = client.post(
        "/api/budgets/templates/50-30-20/adopt",
        json={"monthly_income": 6000}, headers=h1,
    )
    r2 = client.post(
        "/api/budgets/templates/50-30-20/adopt",
        json={"monthly_income": 2000}, headers=h2,
    )
    assert r1.status_code == 201 and r2.status_code == 201
    # Each user got their own rows sized to their own income — the savings
    # line (20%) is unambiguous across both incomes.
    s1 = next(row["amount"] for row in r1.json() if row["category"] == "savings")
    s2 = next(row["amount"] for row in r2.json() if row["category"] == "savings")
    assert s1 == round(6000 * 0.20, 2)
    assert s2 == round(2000 * 0.20, 2)


def test_create_budget_allows_duplicate_category_period(client):
    """Round-2 Review regression: the plain create endpoint keeps its
    pre-existing behavior — multiple budgets in the same category+period are
    allowed (201), not a 500. Pins that templates did NOT add a DB unique
    constraint that would break manual budget creation (the round-2 blocker)."""
    headers, _ = _register(client, email="dup@example.com", username="dupcreate")
    start, end = _first_of_month_and_end()
    body = {
        "name": "Groceries",
        "amount": 300,
        "category": "groceries",
        "period_start": start,
        "period_end": end,
    }
    r1 = client.post("/api/budgets/", json=body, headers=headers)
    r2 = client.post(
        "/api/budgets/",
        json={**body, "name": "Groceries 2", "amount": 150},
        headers=headers,
    )
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text
    assert r1.json()["id"] != r2.json()["id"]


def test_manual_create_after_adopt_same_category_ok(client):
    """Round-2 Review regression (the exact probe): adopting a template and
    then creating a manual budget in one of the adopted categories for the same
    period must succeed (201), not raise a unique-constraint 500."""
    headers, _ = _register(client, email="adoptcreate@example.com", username="adoptcreate")
    start, end = _first_of_month_and_end()

    adopt = client.post(
        "/api/budgets/templates/zero-based/adopt",
        json={"monthly_income": 4000},
        headers=headers,
    )
    assert adopt.status_code == 201, adopt.text

    extra = client.post(
        "/api/budgets/",
        json={
            "name": "Extra groceries",
            "amount": 50,
            "category": "groceries",
            "period_start": start,
            "period_end": end,
        },
        headers=headers,
    )
    assert extra.status_code == 201, extra.text
