"""M3 business acceptance on SQLite and genuine PostgreSQL cash fixtures."""

import copy
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest

from .test_cashflow import Cash, client as shared_client, story

client = shared_client


def business(client):
    c = Cash(client, "business")
    c.post(
        "anchors",
        {
            "account_id": c.account,
            "amount": "5000",
            "date": "2026-10-01",
            "source": "Fictional checked opening",
        },
    )
    c.post("buffer", {"buffer": "100"}, status=200)
    return c


def document(c, **extra):
    return c.post(
        "business/documents",
        {
            "account_id": c.account,
            "kind": "receivable",
            "counterparty": "Customer X",
            "reference": "BX-100",
            "amount": "1000",
            "due_date": "2026-10-05",
            "expected_date": "2026-10-15",
            "confirmed_currency": "THB",
            **extra,
        },
    )


def get(c, path, **params):
    r = c.client.get(
        f"/api/cash/workspaces/{c.w['id']}/{path}", headers=c.headers, params=params
    )
    assert r.status_code == 200, r.text
    return r.json()


def snapshot(c, **extra):
    return c.post(
        "business/snapshots",
        {
            "name": "Saved fictional plan",
            "as_of": "2026-10-01",
            "end": "2026-10-31",
            **extra,
        },
    )


def test_document_is_one_plan_and_never_cash_until_recorded(client):
    c = business(client)
    before = c.forecast()["base"]["cash_today"]
    d = document(c)
    assert d["original_amount"] == d["remaining_amount"] == "1000.00"
    assert d["overdue_days"] == 5 and not d["needs_expected_date_review"]
    data = c.state()
    assert len(data["commitments"]) == len(data["occurrences"]) == 1
    assert data["movements"] == []
    f = c.forecast()["base"]
    assert f["cash_today"] == before == "5000.00"
    assert f["expected_incoming"] == "1000.00" and f["closing_cash"] == "6000.00"


def test_link_business_x_existing_plan_keeps_ids_matches_and_forecast(client):
    c = story(client, "business")
    o = c.occurrence("Client")
    initial = c.forecast()["base"]
    d = document(
        c,
        commitment_id=o["commitment_id"],
        amount="90000",
        expected_date=o["expected_date"],
        due_date=o["due_date"],
    )
    assert d["occurrence_id"] == o["id"]
    assert c.forecast()["base"] == initial
    assert len(c.state()["occurrences"]) == 4
    c.post(
        "business/documents",
        {
            "account_id": c.account,
            "commitment_id": o["commitment_id"],
            "kind": "receivable",
            "counterparty": "Second",
            "reference": "BX-dup",
            "amount": "90000",
            "expected_date": o["expected_date"],
            "due_date": o["due_date"],
            "confirmed_currency": "THB",
        },
        status=409,
    )
    result = c.post(
        f"business/documents/{d['id']}/settle",
        {"amount": "30000", "date": "2026-10-10"},
    )
    assert result["document"]["remaining_amount"] == "60000.00"
    assert c.forecast()["base"]["cash_today"] == "119000.00"
    assert c.forecast()["base"]["closing_cash"] == "98000.00"
    c.post(f"business/documents/{d['id']}", {"expected_date": "2026-11-05"}, status=200)
    assert c.forecast()["base"]["closing_cash"] == "38000.00"
    assert any(o["id"] == d["occurrence_id"] for o in c.forecast()["base"]["later"])


def test_partial_existing_and_new_settlements_unmatch_and_reverse(client):
    c = business(client)
    d = document(c)
    t = c.movement("Already received", "200", "income", "2026-10-09")
    result = c.post(
        f"business/documents/{d['id']}/settle",
        {"amount": "200", "transaction_id": t["id"]},
    )
    assert (
        result["cash_effect"] == "0.00"
        and c.forecast()["base"]["cash_today"] == "5200.00"
    )
    paid = c.post(
        f"business/documents/{d['id']}/settle", {"amount": "300", "date": "2026-10-10"}
    )
    assert (
        paid["document"]["matched_amount"]
        == paid["document"]["remaining_amount"]
        == "500.00"
    )
    assert c.forecast()["base"]["closing_cash"] == "6000.00"
    c.post(f"movements/{paid['transaction_id']}/reverse", status=409)
    c.post(f"settlements/{paid['settlement_id']}/reverse", status=200)
    c.post(f"movements/{paid['transaction_id']}/reverse", status=200)
    reviewed = get(c, "business/documents")["documents"][0]
    assert (
        reviewed["matched_amount"] == "200.00"
        and reviewed["remaining_amount"] == "800.00"
    )
    assert (
        c.forecast()["base"]["cash_today"] == "5200.00"
        and c.forecast()["base"]["closing_cash"] == "6000.00"
    )


def test_credits_are_exact_audited_and_cannot_bypass_matched_amount(client):
    c = business(client)
    d = document(c)
    c.post(
        f"business/documents/{d['id']}/settle", {"amount": "400", "date": "2026-10-10"}
    )
    credited = c.post(
        f"business/documents/{d['id']}/credit",
        {"amount": "100", "reason": "Reviewed discount"},
        status=200,
    )
    assert credited["original_amount"] == "1000.00"
    assert (
        credited["effective_amount"] == "900.00"
        and credited["remaining_amount"] == "500.00"
    )
    c.post(
        f"business/documents/{d['id']}/credit",
        {"amount": "500.01", "reason": "Over credit"},
        status=409,
    )
    c.post(f"occurrences/{d['occurrence_id']}", {"amount": "800"}, status=409)
    c.post(f"occurrences/{d['occurrence_id']}", {"cancelled": True}, status=409)
    c.post(f"commitments/{d['commitment_id']}/cancel", status=409)
    assert (
        c.forecast()["base"]["cash_today"] == "5400.00"
        and c.forecast()["base"]["closing_cash"] == "5900.00"
    )
    end = c.post(
        f"business/documents/{d['id']}/credit",
        {"amount": "500", "reason": "Reviewed final credit"},
        status=200,
    )
    assert end["remaining_amount"] == "0.00" and len(end["adjustments"]) == 2
    assert c.forecast()["base"]["closing_cash"] == "5400.00"


def test_cancel_keeps_actuals_and_reason_and_overdue_requires_date_review(client):
    c = business(client)
    d = document(c, expected_date="2026-10-05")
    assert d["needs_expected_date_review"] and d["overdue_days"] == 5
    c.post(f"business/documents/{d['id']}", {"expected_date": "2026-10-16"}, status=200)
    assert not get(c, "business/documents")["documents"][0][
        "needs_expected_date_review"
    ]
    paid = c.post(
        f"business/documents/{d['id']}/settle", {"amount": "250", "date": "2026-10-10"}
    )
    cancelled = c.post(
        f"business/documents/{d['id']}/cancel",
        {"reason": "Customer cancelled unpaid scope"},
        status=200,
    )
    assert (
        cancelled["status"] == "cancelled"
        and cancelled["remaining_amount"] == "750.00"
        and cancelled["projected_remaining"] == "0.00"
    )
    assert (
        cancelled["cancellation_reason"]
        and cancelled["settlements"][0]["id"] == paid["settlement_id"]
    )
    assert (
        c.forecast()["base"]["cash_today"]
        == c.forecast()["base"]["closing_cash"]
        == "5250.00"
    )
    revision = c.forecast()["base_revision"]
    c.post(
        f"business/documents/{d['id']}/cancel",
        {"reason": "Same cancellation"},
        status=200,
    )
    assert c.forecast()["base_revision"] == revision


def test_business_guards_owner_currency_account_and_personal_workspace(client):
    c = business(client)
    other = Cash(client, "personal")
    payload = {
        "account_id": c.account,
        "kind": "bill",
        "counterparty": "Supplier",
        "reference": "SUP-1",
        "amount": "25",
        "due_date": "2026-10-20",
        "expected_date": "2026-10-21",
        "confirmed_currency": "USD",
    }
    c.post("business/documents", payload, status=422)
    c.post(
        "business/documents",
        {**payload, "confirmed_currency": "THB", "account_id": other.account},
        status=404,
    )
    other.post(
        "business/documents",
        {**payload, "account_id": other.account, "confirmed_currency": "THB"},
        status=409,
    )
    assert (
        client.get(
            f"/api/cash/workspaces/{c.w['id']}/business/documents",
            headers=other.headers,
        ).status_code
        == 404
    )
    assert get(c, "business/documents")["documents"] == []


def test_failed_new_settlement_rolls_back_record_revision_and_audit(client):
    c = business(client)
    d = document(c, kind="bill", amount="50")
    before = copy.deepcopy(c.state())
    c.post(
        f"business/documents/{d['id']}/settle",
        {"amount": "50.01", "date": "2026-10-10"},
        status=409,
    )
    assert c.state() == before
    c.post(
        f"business/documents/{d['id']}/settle",
        {"amount": "50", "date": "2026-10-11"},
        status=422,
    )
    assert c.state() == before


def test_settlement_retry_returns_original_without_duplicate_payment(client):
    c = business(client)
    d = document(c, amount="100")
    path = f"/api/cash/workspaces/{c.w['id']}/business/documents/{d['id']}/settle"
    body = {
        "revision": c.rev,
        "request_key": str(uuid.uuid4()),
        "amount": "100",
        "date": "2026-10-10",
    }
    first = client.post(path, headers=c.headers, json=body)
    assert first.status_code == 201
    assert client.post(path, headers=c.headers, json=body).json() == first.json()
    c.rev = first.json()["revision"]
    c.post(
        f"business/documents/{d['id']}/settle",
        {"amount": "1", "date": "2026-10-10"},
        status=409,
    )
    assert len(c.state()["movements"]) == len(c.state()["settlements"]) == 1


@pytest.mark.skipif(
    not os.environ.get("AEGIS_CASH_TEST_DATABASE_URL"),
    reason="Genuine PostgreSQL concurrency",
)
def test_concurrent_business_settlement_posts_once(client):
    c = business(client)
    d = document(c, amount="100")
    path = f"/api/cash/workspaces/{c.w['id']}/business/documents/{d['id']}/settle"
    bodies = [
        {
            "revision": c.rev,
            "request_key": str(uuid.uuid4()),
            "amount": "100",
            "date": "2026-10-10",
        }
        for _ in range(2)
    ]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda b: client.post(path, headers=c.headers, json=b), bodies)
        )
    assert sorted(r.status_code for r in results) == [201, 409]
    assert len(c.state()["movements"]) == len(c.state()["settlements"]) == 1


def test_thirteen_weeks_expose_daily_gap_even_when_week_closes_positive(client):
    c = business(client)
    c.commitment("Early bill", "6000", "expense", "2026-10-13")
    c.commitment("Late receipt", "6500", "income", "2026-10-16")
    c.commitment("Later receipt", "100", "income", "2027-04-01")
    data = get(c, "business/weeks", as_of="2026-10-10")
    assert len(data["weeks"]) == 13
    first, second = data["weeks"][:2]
    assert (
        first["week_start"] == "2026-10-05"
        and first["covered_from"] == "2026-10-10"
        and first["partial"]
    )
    assert second["closing_cash"] == "5500.00" and second["minimum"] == {
        "date": "2026-10-13",
        "cash": "-1000.00",
    }
    assert any(
        d["cash"] == "-1000.00" and d["events"][0]["title"] == "Early bill"
        for d in second["days"]
    )
    assert any(o["title"] == "Later receipt" for o in data["base"]["later"])


def test_week_boundary_is_workspace_owned_and_missing_cash_stays_unknown(client):
    c = Cash(client, "business")
    data = get(c, "business/weeks", as_of="2026-10-10")
    assert all(
        w["closing_cash"] is None and w["minimum"] is None for w in data["weeks"]
    )
    response = client.post(
        "/api/cash/workspaces",
        headers=c.headers,
        json={
            "name": "Sunday business",
            "kind": "business",
            "currency": "THB",
            "week_start": 6,
            "request_key": str(uuid.uuid4()),
        },
    )
    assert response.status_code == 201
    sunday = copy.copy(c)
    sunday.w = response.json()
    assert (
        get(sunday, "business/weeks", as_of="2026-10-10")["weeks"][0]["week_start"]
        == "2026-10-04"
    )


def test_saved_forecast_is_immutable_and_snapshot_metadata_does_not_stale_plan(client):
    c = business(client)
    d = document(c)
    baseline = c.forecast()["base_revision"]
    s = snapshot(c)
    saved = copy.deepcopy(get(c, f"business/snapshots/{s['id']}"))
    assert c.forecast()["base_revision"] == baseline
    c.post(f"business/documents/{d['id']}", {"expected_date": "2026-11-05"}, status=200)
    c.post(
        f"business/documents/{d['id']}/credit",
        {"amount": "100", "reason": "Changed scope"},
        status=200,
    )
    c.post(
        f"business/documents/{d['id']}/settle", {"amount": "200", "date": "2026-10-10"}
    )
    assert get(c, f"business/snapshots/{s['id']}") == saved
    assert saved["payload"]["forecast"]["base"]["expected_incoming"] == "1000.00"
    assert saved["payload"]["source_versions"]["occurrences"][d["occurrence_id"]]


def test_variance_separates_amount_timing_new_unmatched_and_opening_revision(client):
    c = business(client)
    d = document(c, expected_date="2026-10-05")
    s = snapshot(c)
    c.post(
        f"business/documents/{d['id']}/settle", {"amount": "400", "date": "2026-10-06"}
    )
    c.post(
        f"business/documents/{d['id']}/credit",
        {"amount": "100", "reason": "Reviewed discount"},
        status=200,
    )
    new = document(c, reference="BX-new", amount="200", expected_date="2026-10-04")
    c.post(
        f"business/documents/{new['id']}/settle",
        {"amount": "200", "date": "2026-10-05"},
    )
    c.movement("Unmatched fee", "25", "expense", "2026-10-06")
    c.post(
        "anchors",
        {
            "account_id": c.account,
            "amount": "5500",
            "date": "2026-10-02",
            "source": "Reviewed opening revision",
        },
    )
    v = get(c, f"business/snapshots/{s['id']}/variance", reviewed_through="2026-10-10")
    assert (
        v["expected_cash"] == "6000.00"
        and v["recorded_cash"] == "6075.00"
        and v["difference"] == "75.00"
    )
    assert v["components"] == {
        "amount_change": "-100.00",
        "timing_or_unpaid": "-500.00",
        "new_sources": "200.00",
        "unmatched_activity": "-25.00",
        "internal_transfers": "0.00",
        "opening_balance_revision": "500.00",
        "unclassified": "0.00",
    }
    assert sum(map(Decimal, v["components"].values())) == Decimal(v["difference"])


def test_variance_preserves_unclassified_residual_when_source_history_missing(client):
    from app.database import get_db
    from app.models.cashflow import CashOccurrence

    c = business(client)
    d = document(c, expected_date="2026-10-05")
    s = snapshot(c)
    sessions = client.app.dependency_overrides[get_db]()
    db = next(sessions)
    # Simulate externally lost historical source; do not rewrite the saved snapshot.
    db.query(CashOccurrence).filter_by(id=d["occurrence_id"]).delete()
    db.commit()
    sessions.close()
    v = get(c, f"business/snapshots/{s['id']}/variance", reviewed_through="2026-10-10")
    assert v["difference"] == v["components"]["unclassified"] == "-1000.00"
    assert get(c, f"business/snapshots/{s['id']}")["source_hash"] == s["source_hash"]


def test_variance_keeps_snapshot_account_scope_and_transfer_effect(client):
    c = business(client)
    second = c.post("accounts", {"name": "Excluded savings"})["id"]
    c.post(
        "anchors",
        {
            "account_id": second,
            "amount": "0",
            "date": "2026-10-01",
            "source": "Checked empty savings",
        },
    )
    s = snapshot(c, account_ids=[c.account])
    c.post(
        "transfers",
        {
            "from_account_id": c.account,
            "to_account_id": second,
            "amount": "100",
            "date": "2026-10-05",
            "description": "Recorded internal transfer",
        },
    )
    v = get(c, f"business/snapshots/{s['id']}/variance", reviewed_through="2026-10-10")
    assert v["account_ids"] == [c.account]
    assert v["difference"] == v["components"]["internal_transfers"] == "-100.00"
    assert v["components"]["unclassified"] == "0.00"


def test_snapshot_unknown_cash_and_date_guards_are_explicit(client):
    c = Cash(client, "business")
    s = snapshot(c)
    v = get(c, f"business/snapshots/{s['id']}/variance", reviewed_through="2026-10-10")
    assert (
        not v["known"]
        and v["difference"] is None
        and all(x is None for x in v["components"].values())
    )
    for day in ["2026-09-30", "2026-10-11", "2026-11-01"]:
        assert (
            client.get(
                f"/api/cash/workspaces/{c.w['id']}/business/snapshots/{s['id']}/variance",
                headers=c.headers,
                params={"reviewed_through": day},
            ).status_code
            == 422
        )


def test_snapshot_integrity_and_cross_owner_access_fail_closed(client):
    from app.database import get_db
    from app.models.cashflow import CashForecastSnapshot

    c = business(client)
    s = snapshot(c)
    other = Cash(client, "business")
    assert (
        client.get(
            f"/api/cash/workspaces/{c.w['id']}/business/snapshots/{s['id']}",
            headers=other.headers,
        ).status_code
        == 404
    )
    sessions = client.app.dependency_overrides[get_db]()
    db = next(sessions)
    row = db.get(CashForecastSnapshot, s["id"])
    row.payload = {**row.payload, "week_start": 6}
    db.commit()
    sessions.close()
    assert (
        client.get(
            f"/api/cash/workspaces/{c.w['id']}/business/snapshots/{s['id']}",
            headers=c.headers,
        ).status_code
        == 409
    )
