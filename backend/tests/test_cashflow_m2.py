"""Everyday cash review acceptance; uses the genuine M1 PostgreSQL fixture too."""

import copy
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
import pytest
from .test_cashflow import client as shared_client, Cash, story

client = shared_client


HEADER = "date,description,amount,type,currency,reference\n"


def upload(c, rows, **extra):
    return c.post(
        "imports",
        {
            "account_id": c.account,
            "confirmed_currency": "THB",
            "filename": "fictional.csv",
            "content": HEADER + rows,
            **extra,
        },
    )


def review(c, batch):
    r = c.client.get(
        f"/api/cash/workspaces/{c.w['id']}/imports/{batch['id']}", headers=c.headers
    )
    assert r.status_code == 200, r.text
    return r.json()


def second_workspace(c):
    other = copy.copy(c)
    r = c.client.post(
        "/api/cash/workspaces",
        headers=c.headers,
        json={
            "name": "Other purpose",
            "kind": "business",
            "currency": "THB",
            "request_key": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 201
    other.w, other.rev = r.json(), 0
    other.account = other.post("accounts", {"name": "Other cash"})["id"]
    return other


def test_durable_csv_invalid_rows_currency_and_no_preview_posting(client):
    c = story(client, "personal")
    before = c.forecast()
    b = upload(
        c,
        "2026-10-10,Coffee,65.25,expense,THB,coffee-1\n2026-10-10,Bad cents,1.999,expense,THB,x\n2026-10-10,Wrong currency,10,expense,USD,y\n2026-10-12,Future,10,income,THB,z\nnot-a-date,Bad date,10,expense,THB,a\n",
    )
    assert b["row_count"] == 5 and b["invalid_count"] == 4
    rows = review(c, b)["rows"]
    assert rows[0]["payload"]["amount"] == "65.25" and rows[0]["status"] == "pending"
    assert all(r["status"] == "invalid" and r["errors"] for r in rows[1:])
    after = c.forecast()
    assert (
        before["base"] == after["base"]
        and before["base_revision"] == after["base_revision"]
    )
    c.post(
        f"imports/{b['id']}/confirm", {"rows": [{"row_id": rows[1]["id"]}]}, status=409
    )
    assert c.forecast()["base"]["cash_today"] == "47000.00"
    c.post(
        f"imports/{b['id']}/confirm",
        {"rows": [{"row_id": rows[0]["id"], "amount": "1.00"}]},
        status=422,
    )
    saved = c.post(f"imports/{b['id']}/confirm", {"rows": [{"row_id": rows[0]["id"]}]})
    assert (
        saved["imported_count"] == 1
        and c.forecast()["base"]["cash_today"] == "46934.75"
    )
    assert (
        review(c, b)["rows"][0]["transaction_id"]
        == saved["imported_transaction_ids"][0]
    )


def test_csv_replay_new_key_reversal_and_candidate_duplicate_review(client):
    c = story(client, "personal")
    b = upload(c, "2026-10-10,Coffee,65.25,expense,THB,coffee-1\n")
    row = review(c, b)["rows"][0]
    payload = {
        "revision": c.rev,
        "request_key": str(uuid.uuid4()),
        "rows": [{"row_id": row["id"]}],
    }
    path = f"/api/cash/workspaces/{c.w['id']}/imports/{b['id']}/confirm"
    first = client.post(path, headers=c.headers, json=payload)
    assert first.status_code == 201
    assert client.post(path, headers=c.headers, json=payload).json() == first.json()
    c.rev = first.json()["revision"]
    c.post(f"imports/{b['id']}/confirm", {"rows": [{"row_id": row["id"]}]}, status=409)
    tid = first.json()["imported_transaction_ids"][0]
    c.post(f"movements/{tid}/reverse", status=200)
    c.post(f"imports/{b['id']}/confirm", {"rows": [{"row_id": row["id"]}]}, status=409)
    newer = upload(c, "2026-10-10,Coffee,65.25,expense,THB,coffee-1\n")
    nextrow = review(c, newer)["rows"][0]
    assert nextrow["possible_duplicates"]
    c.post(
        f"imports/{newer['id']}/confirm",
        {"rows": [{"row_id": nextrow["id"]}]},
        status=409,
    )
    c.post(
        f"imports/{newer['id']}/confirm",
        {"rows": [{"row_id": nextrow["id"], "decision": "keep_distinct"}]},
    )
    assert c.forecast()["base"]["cash_today"] == "46934.75"


def test_csv_same_batch_equals_are_not_auto_duplicates_or_auto_skipped(client):
    c = story(client, "personal")
    b = upload(
        c,
        "2026-10-10,Two real coffees,10,expense,THB,\n2026-10-10,Two real coffees,10,expense,THB,\n",
    )
    rows = review(c, b)["rows"]
    assert all(r["possible_duplicates"] for r in rows)
    c.post(
        f"imports/{b['id']}/confirm",
        {"rows": [{"row_id": r["id"], "decision": "keep_distinct"} for r in rows]},
    )
    assert c.forecast()["base"]["cash_today"] == "46980.00"


def test_csv_partial_match_and_atomic_bad_selection_rollback(client):
    c = story(client, "business")
    b = upload(
        c,
        "2026-10-10,Client partial,30000,income,THB,bx-104\n2026-10-10,Unselected fee,20,expense,THB,fee\n",
    )
    rows = review(c, b)["rows"]
    oid = c.occurrence("Client")["id"]
    assert any(m["id"] == oid for m in rows[0]["candidate_matches"])
    c.post(
        f"imports/{b['id']}/confirm",
        {"rows": [{"row_id": rows[0]["id"]}, {"row_id": "not-in-batch"}]},
        status=404,
    )
    assert c.forecast()["base"]["cash_today"] == "89000.00"
    c.post(
        f"imports/{b['id']}/confirm",
        {
            "rows": [
                {"row_id": rows[0]["id"], "occurrence_id": oid, "match_amount": "30001"}
            ]
        },
        status=409,
    )
    assert c.forecast()["base"]["cash_today"] == "89000.00"
    posted = c.post(
        f"imports/{b['id']}/confirm",
        {
            "rows": [
                {"row_id": rows[0]["id"], "occurrence_id": oid, "match_amount": "30000"}
            ]
        },
    )
    f = c.forecast()["base"]
    assert (
        f["cash_today"] == "119000.00"
        and f["expected_incoming"] == "60000.00"
        and f["closing_cash"] == "98000.00"
    )
    assert review(c, b)["rows"][1]["status"] == "pending"
    c.post(f"settlements/{posted['settlement_ids'][0]}/reverse", status=200)
    c.post(f"movements/{posted['imported_transaction_ids'][0]}/reverse", status=200)
    assert c.forecast()["base"]["cash_today"] == "89000.00"


def test_csv_owner_and_account_boundaries_and_limits(client):
    c, other = story(client, "personal"), Cash(client)
    b = upload(c, "2026-10-10,Coffee,10,expense,THB,\n")
    assert (
        client.get(
            f"/api/cash/workspaces/{c.w['id']}/imports/{b['id']}", headers=other.headers
        ).status_code
        == 404
    )
    other.post(
        "imports",
        {
            "account_id": c.account,
            "confirmed_currency": "THB",
            "filename": "x.csv",
            "content": HEADER + "2026-10-10,X,10,expense,THB,\n",
        },
        status=404,
    )
    other.post(
        f"imports/{b['id']}/confirm",
        {"rows": [{"row_id": review(c, b)["rows"][0]["id"]}]},
        status=404,
    )
    c.post(
        "imports",
        {
            "account_id": c.account,
            "confirmed_currency": "THB",
            "filename": "x.csv",
            "content": HEADER + "2026-10-10,X,10,expense,THB,\n" * 501,
        },
        status=422,
    )
    c.post(
        "imports",
        {
            "account_id": c.account,
            "confirmed_currency": "THB",
            "filename": "x.csv",
            "content": "date,date,amount,type,currency\n2026-10-10,X,10,expense,THB\n",
        },
        status=422,
    )
    c.post(
        "imports",
        {
            "account_id": c.account,
            "confirmed_currency": "THB",
            "filename": "x.csv",
            "content": HEADER + '2026-10-10,"unclosed,10,expense,THB,\n',
        },
        status=422,
    )


@pytest.mark.parametrize(
    "recurrence,every,expected",
    [
        ("weekly", 2, ["2028-01-31", "2028-02-14", "2028-02-28"]),
        ("biweekly", 1, ["2028-01-31", "2028-02-14", "2028-02-28"]),
        ("monthly", 1, ["2028-01-31", "2028-02-29", "2028-03-31"]),
        ("quarterly", 1, ["2028-01-31", "2028-04-30", "2028-07-31"]),
        ("yearly", 1, ["2028-01-31", "2029-01-31", "2030-01-31"]),
    ],
)
def test_recurrence_intervals_preserve_anchor_and_month_ends(
    client, recurrence, every, expected
):
    c = Cash(client)
    c.commitment(
        "Schedule",
        10,
        "expense",
        "2028-01-31",
        recurrence=recurrence,
        interval_every=every,
        end_date=expected[-1],
    )
    assert sorted(o["nominal_date"] for o in c.state()["occurrences"]) == expected


def test_split_month_end_collision_and_weekend_boundary_do_not_lose_amounts(client):
    c = Cash(client)
    c.commitment(
        "Split salary",
        100,
        "income",
        "2027-02-01",
        recurrence="split",
        recurrence_days=[28, 31],
        end_date="2027-02-28",
        weekend_rule="roll_forward",
    )
    rows = c.state()["occurrences"]
    assert len(rows) == 2 and {o["nominal_date"] for o in rows} == {"2027-02-28"}
    assert {o["schedule_slot"] for o in rows} == {28, 31} and {
        o["expected_date"] for o in rows
    } == {"2027-03-01"}
    assert sum(float(o["amount"]) for o in rows) == 200
    c.post(
        "commitments",
        {
            "account_id": c.account,
            "title": "Bad days",
            "amount": "10",
            "direction": "expense",
            "start_date": "2027-01-01",
            "recurrence": "split",
            "recurrence_days": [15, 15],
        },
        status=422,
    )


def test_horizon_extension_preserves_exceptions_matches_and_noop_base(client):
    c = Cash(client)
    plan = c.commitment(
        "Old monthly", 100, "expense", "2020-01-31", recurrence="monthly"
    )
    row = next(o for o in c.state()["occurrences"] if o["nominal_date"] == "2025-01-31")
    c.post(
        f"occurrences/{row['id']}",
        {
            "expected_date": "2026-10-12",
            "amount": "120",
            "due_date": None,
            "title": "Reviewed exception",
        },
        status=200,
    )
    payment = c.movement("Partial old bill", 20, "expense", "2026-10-10")
    c.post(
        "settlements",
        {"transaction_id": payment["id"], "occurrence_id": row["id"], "amount": "20"},
    )
    c.post(f"occurrences/{row['id']}", {"amount": "19"}, status=409)
    other = next(
        o for o in c.state()["occurrences"] if o["nominal_date"] == "2025-02-28"
    )
    c.post(f"occurrences/{other['id']}", {"cancelled": True}, status=200)
    extended = c.post(
        f"commitments/{plan['id']}/extend", {"through": "2026-12-31"}, status=200
    )
    assert extended["added_count"] == 12
    before = c.forecast()["base_revision"]
    c.post(f"commitments/{plan['id']}/extend", {"through": "2026-12-31"}, status=200)
    assert c.forecast()["base_revision"] == before
    rows = c.state()["occurrences"]
    assert len(rows) == 84 and len({o["id"] for o in rows}) == 84
    edited = next(o for o in rows if o["id"] == row["id"])
    assert (
        edited["amount"] == "120.00"
        and edited["expected_date"] == "2026-10-12"
        and edited["due_date"] is None
    )
    assert next(o for o in rows if o["id"] == other["id"])["cancelled"]
    assert c.state()["settlements"][0]["amount"] == "20.00"


def test_source_cannot_be_linked_twice_across_owner_workspaces(client):
    c = Cash(client)
    other = second_workspace(c)
    p = client.post(
        "/api/plans/",
        headers=c.headers,
        json={
            "title": "Source",
            "category": "expense",
            "amount": 100,
            "currency": "THB",
            "start_date": "2026-10-12",
        },
    ).json()
    c.commitment(
        "One source",
        100,
        "expense",
        "2026-10-12",
        source_kind="plan",
        source_id=p["id"],
    )
    other.post(
        "commitments",
        {
            "account_id": other.account,
            "title": "Same source twice",
            "amount": "100",
            "direction": "expense",
            "start_date": "2026-10-12",
            "source_kind": "plan",
            "source_id": p["id"],
        },
        status=409,
    )


def test_goal_reservation_is_not_cash_and_transfer_is_not_reserved_twice(client):
    c = story(client, "personal")
    goal = client.post(
        "/api/savings-goals/",
        headers=c.headers,
        json={"name": "Emergency purpose", "target_amount": 50000},
    ).json()
    reserved = c.post(
        "goal-allocations",
        {
            "name": "Emergency purpose",
            "account_id": c.account,
            "goal_id": goal["id"],
            "amount": "10000",
            "mode": "reserved",
            "confirmed_currency": "THB",
        },
    )
    f = c.forecast()["base"]
    assert (
        f["cash_today"] == "47000.00"
        and f["closing_cash"] == "48900.00"
        and f["reserved_cash"] == "10000.00"
        and f["headroom"] == "33900.00"
    )
    destination = c.post("accounts", {"name": "Savings cash"})["id"]
    c.post(
        "anchors",
        {
            "account_id": destination,
            "amount": "0",
            "date": "2026-10-01",
            "source": "Reviewed",
        },
    )
    transfer = c.post(
        "transfers",
        {
            "from_account_id": c.account,
            "to_account_id": destination,
            "amount": "1000",
            "date": "2026-10-10",
            "description": "Already moved savings",
        },
    )
    c.post(
        "goal-allocations",
        {
            "name": "Transferred purpose",
            "account_id": destination,
            "goal_id": goal["id"],
            "transfer_id": transfer["id"],
            "amount": "1000",
            "mode": "transferred",
            "confirmed_currency": "THB",
        },
    )
    assert (
        c.forecast()["base"]["cash_today"] == "47000.00"
        and c.forecast()["base"]["reserved_cash"] == "10000.00"
    )
    subset = c.forecast(account_ids=[destination])["base"]
    assert subset["cash_today"] == "1000.00" and subset["reserved_cash"] == "0.00"
    assert (
        client.get(f"/api/savings-goals/{goal['id']}", headers=c.headers).json()[
            "current_amount"
        ]
        == 0
    )
    c.post(f"goal-allocations/{reserved['id']}", {"released": True}, status=200)
    assert c.forecast()["base"]["headroom"] == "43900.00"


def test_entered_installments_count_once_without_debt_principal_updates(client):
    c = story(client, "personal")
    debt = client.post(
        "/api/debts/",
        headers=c.headers,
        json={
            "name": "Entered loan",
            "balance": 5000,
            "original_balance": 5000,
            "interest_rate": 12,
        },
    ).json()
    schedule = c.post(
        "installments",
        {
            "name": "Loan payments",
            "account_id": c.account,
            "debt_id": debt["id"],
            "confirmed_currency": "THB",
            "entries": [
                {"date": "2026-10-12", "amount": "200"},
                {"date": "2026-10-12", "amount": "300"},
                {"date": "2026-11-12", "amount": "400"},
            ],
        },
    )
    assert (
        schedule["entered_total"] == "900.00"
        and c.forecast()["base"]["closing_cash"] == "48400.00"
    )
    rows = [
        o
        for o in c.state()["occurrences"]
        if o["commitment_id"] == schedule["commitment_id"]
    ]
    assert len(rows) == 3 and len({o["id"] for o in rows}) == 3
    first = next(o for o in rows if o["amount"] == "200.00")
    c.movement("Loan paid", 200, "expense", "2026-10-10", occurrence_id=first["id"])
    assert c.forecast()["base"]["closing_cash"] == "48400.00"
    assert (
        client.get(f"/api/debts/{debt['id']}", headers=c.headers).json()["balance"]
        == 5000
    )
    c.post(
        "installments",
        {
            "name": "Duplicate debt",
            "account_id": c.account,
            "debt_id": debt["id"],
            "confirmed_currency": "THB",
            "entries": [{"date": "2026-10-15", "amount": "100"}],
        },
        status=409,
    )


def test_goal_and_debt_owner_currency_boundaries(client):
    c, other = Cash(client), Cash(client)
    goal = client.post(
        "/api/savings-goals/",
        headers=other.headers,
        json={"name": "Other goal", "target_amount": 1000},
    ).json()
    debt = client.post(
        "/api/debts/",
        headers=other.headers,
        json={"name": "Other loan", "balance": 1000, "original_balance": 1000},
    ).json()
    c.post(
        "goal-allocations",
        {
            "account_id": c.account,
            "name": "Foreign",
            "goal_id": goal["id"],
            "amount": "100",
            "confirmed_currency": "THB",
        },
        status=404,
    )
    c.post(
        "installments",
        {
            "account_id": c.account,
            "name": "Foreign",
            "debt_id": debt["id"],
            "confirmed_currency": "THB",
            "entries": [{"date": "2026-10-12", "amount": "100"}],
        },
        status=404,
    )
    c.post(
        "goal-allocations",
        {
            "account_id": c.account,
            "name": "Wrong currency",
            "amount": "100",
            "confirmed_currency": "USD",
        },
        status=422,
    )


def alerts(c):
    r = c.client.get(
        f"/api/cash/workspaces/{c.w['id']}/alerts",
        headers=c.headers,
        params={"as_of": "2026-10-10", "end": "2026-10-31"},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_alerts_explain_deduplicate_acknowledge_and_resolve_from_real_inputs(client):
    c = story(client, "personal")
    c.commitment("Laptop base plan", 45000, "expense", "2026-10-12")
    before = c.forecast()["base_revision"]
    c.post("alerts/evaluate", {"as_of": "2026-10-10", "end": "2026-10-31"}, status=200)
    active = [a for a in alerts(c)["alerts"] if not a["resolved_at"]]
    negative = next(a for a in active if a["kind"] == "negative_cash")
    assert (
        negative["event_date"] == "2026-10-16"
        and negative["details"]["cash"] == "-500.00"
    )
    assert any(s["title"] == "Laptop base plan" for s in negative["details"]["sources"])
    assert negative["details"]["currency"] == "THB" and negative["details"][
        "account_ids"
    ] == [c.account]
    c.post(f"alerts/{negative['id']}/acknowledge", status=200)
    c.post("alerts/evaluate", {"as_of": "2026-10-10", "end": "2026-10-31"}, status=200)
    assert c.forecast()["base_revision"] == before
    assert len(alerts(c)["alerts"]) == len(active)
    assert next(a for a in alerts(c)["alerts"] if a["id"] == negative["id"])[
        "acknowledged"
    ]
    o = c.occurrence("Laptop base plan")
    c.post(f"occurrences/{o['id']}", {"expected_date": "2026-11-12"}, status=200)
    current = alerts(c)
    assert not current["needs_evaluation"] and all(
        a["resolved_at"] for a in current["alerts"]
    )
    assert c.forecast()["base"]["closing_cash"] == "48900.00"


def test_alert_missing_balance_and_goal_gap_are_distinct(client):
    c = Cash(client)
    c.post("alerts/evaluate", {"as_of": "2026-10-10", "end": "2026-10-31"}, status=200)
    initial = alerts(c)["alerts"]
    assert (
        len(initial) == 1
        and initial[0]["kind"] == "incomplete_inputs"
        and not initial[0]["details"]["cash_known"]
    )
    c.post(
        "anchors",
        {
            "account_id": c.account,
            "amount": "6000",
            "date": "2026-10-01",
            "source": "Reviewed",
        },
    )
    assert all(a["resolved_at"] for a in alerts(c)["alerts"])
    g = c.post(
        "goal-allocations",
        {
            "account_id": c.account,
            "name": "Reserved goal",
            "amount": "2000",
            "confirmed_currency": "THB",
        },
    )
    active = [a for a in alerts(c)["alerts"] if not a["resolved_at"]]
    assert (
        len(active) == 1
        and active[0]["kind"] == "reserved_gap"
        and active[0]["details"]["cash"] == "6000.00"
    )
    assert (
        c.forecast()["base"]["first_negative_date"] is None
        and c.forecast()["base"]["first_below_buffer_date"] is None
    )
    c.post(f"goal-allocations/{g['id']}", {"released": True}, status=200)
    assert all(a["resolved_at"] for a in alerts(c)["alerts"])


def test_postgres_concurrent_csv_confirmation_posts_one_batch_once(client):
    if not os.environ.get("AEGIS_CASH_TEST_DATABASE_URL"):
        pytest.skip("Actual PostgreSQL required for concurrent CSV confirmation")
    c = story(client, "personal")
    b = upload(c, "2026-10-10,Coffee,65.25,expense,THB,\n")
    rid = review(c, b)["rows"][0]["id"]
    path = f"/api/cash/workspaces/{c.w['id']}/imports/{b['id']}/confirm"
    bodies = [
        {"revision": c.rev, "request_key": str(uuid.uuid4()), "rows": [{"row_id": rid}]}
        for _ in range(2)
    ]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda p: client.post(path, headers=c.headers, json=p), bodies)
        )
    assert sorted(r.status_code for r in results) == [201, 409]
    assert c.forecast()["base"]["cash_today"] == "46934.75"
    assert len([t for t in c.state()["movements"] if t["title"] == "Coffee"]) == 1


def test_alert_date_reviews_do_not_exhaust_a_workspace(client):
    from datetime import date, timedelta

    c = Cash(client)
    c.post(
        "anchors",
        {
            "account_id": c.account,
            "amount": "6000",
            "date": "2026-10-01",
            "source": "Reviewed scope fixture",
        },
    )
    c.commitment("Reviewed large bill", 7000, "expense", "2026-10-11")
    for i in range(25):
        c.post(
            "alerts/evaluate",
            {"as_of": "2026-10-10", "end": str(date(2026, 10, 11) + timedelta(days=i))},
            status=200,
        )
    c.movement("Funds arrived", 7000, "income", "2026-10-10")
    review = client.get(
        f"/api/cash/workspaces/{c.w['id']}/alerts?as_of=2026-10-10&end=2026-10-11",
        headers=c.headers,
    ).json()
    assert review["needs_evaluation"]
    c.post("alerts/evaluate", {"as_of": "2026-10-10", "end": "2026-10-11"}, status=200)
    refreshed = client.get(
        f"/api/cash/workspaces/{c.w['id']}/alerts?as_of=2026-10-10&end=2026-10-11",
        headers=c.headers,
    ).json()
    assert not refreshed["needs_evaluation"]
    assert all(a["resolved_at"] for a in refreshed["alerts"])
