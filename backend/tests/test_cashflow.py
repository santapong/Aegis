"""M0/M1 API acceptance; optionally runs against a real disposable PostgreSQL schema."""

import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.database import Base, get_db
from app.config import get_settings
from app.services import cashflow
from .conftest import _register


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(get_settings(), "cashflow_workspaces_enabled", True)
    monkeypatch.setattr(cashflow, "local_today", lambda w: date(2026, 10, 10))
    url = os.environ.get("AEGIS_CASH_TEST_DATABASE_URL")
    admin = None
    schema = None
    if url:
        from sqlalchemy.engine import make_url

        parsed = make_url(url)
        assert (
            parsed.get_backend_name() == "postgresql"
            and parsed.database == "aegis_cash_test"
        ), "Only the dedicated disposable test database is allowed"
        schema = "cash_test_" + uuid.uuid4().hex
        admin = create_engine(url)
        with admin.begin() as conn:
            conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    else:
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def fk(conn, record):
            conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)

    def override():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
        if admin:
            with admin.begin() as conn:
                conn.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
            admin.dispose()


class Cash:
    def __init__(self, client, kind="personal"):
        self.client = client
        self.headers, _ = _register(
            client, email=uuid.uuid4().hex + "@example.com", username=uuid.uuid4().hex
        )
        r = client.post(
            "/api/cash/workspaces",
            headers=self.headers,
            json={
                "name": kind,
                "kind": kind,
                "currency": "THB",
                "buffer": "5000.00" if kind == "personal" else "10000.00",
                "request_key": str(uuid.uuid4()),
            },
        )
        assert r.status_code == 201, r.text
        self.w = r.json()
        self.rev = 0
        self.account = self.post("accounts", {"name": "Everyday cash"})["id"]

    def post(self, path, data=None, status=201):
        body = {**(data or {}), "revision": self.rev, "request_key": str(uuid.uuid4())}
        r = self.client.post(
            f"/api/cash/workspaces/{self.w['id']}/{path}",
            headers=self.headers,
            json=body,
        )
        assert r.status_code == status, r.text
        if status in [200, 201]:
            self.rev = r.json()["revision"]
            return r.json()
        return r

    def movement(self, title, amount, direction, day, **extra):
        return self.post(
            "movements",
            {
                "account_id": self.account,
                "title": title,
                "amount": str(amount),
                "direction": direction,
                "date": day,
                **extra,
            },
        )

    def commitment(self, title, amount, direction, day, **extra):
        return self.post(
            "commitments",
            {
                "account_id": self.account,
                "title": title,
                "amount": str(amount),
                "direction": direction,
                "start_date": day,
                **extra,
            },
        )

    def state(self):
        return self.client.get(
            f"/api/cash/workspaces/{self.w['id']}", headers=self.headers
        ).json()

    def forecast(self, **extra):
        r = self.client.get(
            "/api/cash/forecast",
            headers=self.headers,
            params={
                "workspace_id": self.w["id"],
                "as_of": "2026-10-10",
                "end": "2026-10-31",
                **extra,
            },
        )
        assert r.status_code == 200, r.text
        return r.json()

    def occurrence(self, title):
        return next(o for o in self.state()["occurrences"] if o["title"] == title)


def story(client, kind):
    c = Cash(client, kind)
    c.post(
        "anchors",
        {
            "account_id": c.account,
            "amount": "30000" if kind == "personal" else "60000",
            "date": "2026-10-01",
            "source": "Fictional opening, start of day",
        },
    )
    if kind == "personal":
        c.movement("Salary", 35000, "income", "2026-10-01")
        c.movement("Rent", 18000, "expense", "2026-10-08")
        for title, amount, direction, day in [
            ("Groceries", 2500, "expense", "16"),
            ("Freelance", 8000, "income", "18"),
            ("Utilities", 1200, "expense", "20"),
            ("Transport", 1800, "expense", "23"),
            ("Subscriptions", 600, "expense", "26"),
        ]:
            c.commitment(title, amount, direction, "2026-10-" + day)
    else:
        c.movement("Deposit", 50000, "income", "2026-10-05")
        c.movement("Rent", 18000, "expense", "2026-10-08")
        c.movement("Operations", 3000, "expense", "2026-10-09")
        for title, amount, direction, day in [
            ("Client", 90000, "income", "15"),
            ("Contractor", 65000, "expense", "20"),
            ("Hosting", 4000, "expense", "23"),
            ("Equipment", 12000, "expense", "26"),
        ]:
            c.commitment(
                title,
                amount,
                direction,
                "2026-10-" + day,
                due_date="2026-10-08" if title == "Client" else "2026-10-" + day,
            )
    return c


@pytest.mark.parametrize(
    "kind,cash,closing,headroom",
    [
        ("personal", "47000.00", "48900.00", "43900.00"),
        ("business", "89000.00", "98000.00", "88000.00"),
    ],
)
def test_baseline(client, kind, cash, closing, headroom):
    c = story(client, kind)
    f = c.forecast()["base"]
    assert (
        f["complete"]
        and f["cash_today"] == cash
        and f["closing_cash"] == closing
        and f["headroom"] == headroom
    )
    assert len(f["days"]) == 22
    # Separate scoped records never inflate unassigned/legacy totals.
    r = client.get("/api/transactions/summary", headers=c.headers)
    assert r.status_code == 200 and r.json()["count"] == 0


def test_purchase_and_saved_draft(client):
    c = story(client, "personal")
    before = c.state()["movements"]
    s = c.post(
        "scenarios",
        {
            "name": "Laptop",
            "extras": [
                {
                    "account_id": c.account,
                    "title": "Laptop",
                    "amount": "45000",
                    "date": "2026-10-12",
                }
            ],
        },
    )
    f = c.forecast(scenario_id=s["id"])
    assert f["base"]["closing_cash"] == "48900.00"
    assert f["scenario"]["minimum"] == {"date": "2026-10-16", "cash": "-500.00"}
    assert f["scenario"]["first_below_buffer_date"] == "2026-10-12"
    assert f["scenario"]["closing_cash"] == "3900.00"
    assert not f["scenario_stale"] and c.state()["movements"] == before


def test_late_business_receipt_and_deferred_cost(client):
    c = story(client, "business")
    o = c.occurrence("Client")
    equipment = c.occurrence("Equipment")
    s = c.post(
        "scenarios",
        {
            "name": "Late receipt",
            "dates": [{"occurrence_id": o["id"], "expected_date": "2026-11-05"}],
        },
    )
    f = c.forecast(scenario_id=s["id"])["scenario"]
    assert (
        f["closing_cash"] == "8000.00"
        and f["headroom"] == "-2000.00"
        and f["first_negative_date"] is None
    )
    assert (
        f["first_below_buffer_date"] == "2026-10-26"
        and f["later"][0]["expected_date"] == "2026-11-05"
    )
    s2 = c.post(
        "scenarios",
        {
            "name": "Move equipment too",
            "dates": [
                {"occurrence_id": o["id"], "expected_date": "2026-11-05"},
                {"occurrence_id": equipment["id"], "expected_date": "2026-11-02"},
            ],
        },
    )
    assert c.forecast(scenario_id=s2["id"])["scenario"]["closing_cash"] == "20000.00"
    assert len(c.forecast(scenario_id=s2["id"])["scenario"]["later"]) == 2
    assert not c.forecast(scenario_id=s["id"])["scenario_stale"]
    # Saving another comparison leaves cash inputs unchanged. A genuine
    # input edit invalidates both, while refreshing one does not change base.
    c.post("buffer", {"buffer": "11000"}, status=200)
    assert c.forecast(scenario_id=s["id"])["scenario_stale"]
    c.post(f"scenarios/{s['id']}/refresh", status=200)
    assert not c.forecast(scenario_id=s["id"])["scenario_stale"]
    assert c.forecast(scenario_id=s2["id"])["scenario_stale"]


@pytest.mark.parametrize(
    "kind,title,amount,direction,cash,closing",
    [
        ("personal", "Utilities", 1200, "expense", "45800.00", "48900.00"),
        ("business", "Contractor", 65000, "expense", "24000.00", "98000.00"),
        ("business", "Client", 30000, "income", "119000.00", "98000.00"),
    ],
)
def test_payment_counts_once_and_correction(
    client, kind, title, amount, direction, cash, closing
):
    c = story(client, kind)
    o = c.occurrence(title)
    t = c.movement(title, amount, direction, "2026-10-10")
    data = {"transaction_id": t["id"], "occurrence_id": o["id"], "amount": str(amount)}
    preview = client.post(
        f"/api/cash/workspaces/{c.w['id']}/settlements/preview",
        headers=c.headers,
        json=data,
    )
    assert preview.status_code == 200 and preview.json()["cash_effect"] == "0.00"
    s = c.post("settlements", data)
    f = c.forecast()["base"]
    assert f["cash_today"] == cash and f["closing_cash"] == closing
    assert (
        client.delete("/api/transactions/" + t["id"], headers=c.headers).status_code
        == 404
    )
    c.post(f"movements/{t['id']}/reverse", status=409)
    c.post(f"settlements/{s['id']}/reverse", status=200)
    c.post(f"movements/{t['id']}/reverse", status=200)
    assert c.forecast()["base"]["closing_cash"] == closing


def test_idempotent_replay_and_stale_revision(client):
    c = Cash(client)
    body = {
        "account_id": c.account,
        "title": "Payment",
        "direction": "income",
        "amount": "65.01",
        "date": "2026-10-10",
        "revision": c.rev,
        "request_key": "one-payment-key",
    }
    path = f"/api/cash/workspaces/{c.w['id']}/movements"
    r = client.post(path, headers=c.headers, json=body)
    again = client.post(path, headers=c.headers, json=body)
    assert r.status_code == again.status_code == 201 and r.json() == again.json()
    assert len(c.state()["movements"]) == 1
    assert (
        client.post(path, headers=c.headers, json={**body, "amount": "66"}).status_code
        == 409
    )
    assert (
        client.post(
            path, headers=c.headers, json={**body, "request_key": "different-key"}
        ).status_code
        == 409
    )


def test_permissions_currency_and_missing_anchor(client):
    a = Cash(client)
    b = Cash(client, "business")
    assert (
        not a.forecast()["base"]["complete"]
        and a.forecast()["base"]["cash_today"] is None
    )
    assert (
        client.get(f"/api/cash/workspaces/{a.w['id']}", headers=b.headers).status_code
        == 404
    )
    assert (
        client.get(
            "/api/cash/forecast",
            headers=a.headers,
            params={"workspace_id": a.w["id"], "account_ids": b.account},
        ).status_code
        == 404
    )
    a.post(
        "movements",
        {
            "account_id": b.account,
            "title": "Wrong owner",
            "amount": "20",
            "direction": "income",
            "date": "2026-10-10",
        },
        status=404,
    )
    a.post(
        "movements",
        {
            "account_id": a.account,
            "title": "Precision",
            "amount": "1.001",
            "direction": "income",
            "date": "2026-10-10",
        },
        status=422,
    )
    a.post(
        "movements",
        {
            "account_id": a.account,
            "title": "Future",
            "amount": "20",
            "direction": "income",
            "date": "2026-10-11",
        },
        status=422,
    )
    assert (
        client.post(
            "/api/cash/workspaces",
            headers=a.headers,
            json={
                "name": "FX",
                "kind": "personal",
                "currency": "JPY",
                "request_key": "unsupported-cur",
            },
        ).status_code
        == 422
    )


def test_legacy_adoption_explicit_and_repeatable(client):
    c = Cash(client)
    t = client.post(
        "/api/transactions/",
        headers=c.headers,
        json={
            "amount": 65,
            "type": "expense",
            "date": "2026-10-01",
            "category": "Food",
        },
    ).json()
    assert c.state()["legacy_count"] == 1 and not c.forecast()["base"]["complete"]
    c.post(
        "legacy/adopt",
        {
            "account_id": c.account,
            "transaction_ids": [t["id"]],
            "confirmed_currency": "USD",
        },
        status=422,
    )
    first = c.post(
        "legacy/adopt",
        {
            "account_id": c.account,
            "transaction_ids": [t["id"]],
            "confirmed_currency": "THB",
        },
        status=200,
    )
    second = c.post(
        "legacy/adopt",
        {
            "account_id": c.account,
            "transaction_ids": [t["id"]],
            "confirmed_currency": "THB",
        },
        status=200,
    )
    assert (
        first["adopted_ids"] == second["adopted_ids"] and c.state()["legacy_count"] == 0
    )
    assert len(c.state()["movements"]) == 1
    assert (
        client.put(
            "/api/transactions/" + t["id"], headers=c.headers, json={"amount": 20}
        ).status_code
        == 404
    )


def test_explicit_exclusion_invalidated_by_new_legacy_data(client):
    c = Cash(client)
    client.post(
        "/api/transactions/",
        headers=c.headers,
        json={
            "amount": 20,
            "type": "expense",
            "date": "2026-10-01",
            "category": "Food",
        },
    )
    c.post("legacy/exclude", status=200)
    assert c.state()["legacy_excluded"]
    client.post(
        "/api/transactions/",
        headers=c.headers,
        json={
            "amount": 30,
            "type": "expense",
            "date": "2026-10-01",
            "category": "Food",
        },
    )
    assert not c.state()["legacy_excluded"]


def test_month_end_weekend_and_unresolved(client):
    c = Cash(client)
    c.post(
        "anchors",
        {
            "account_id": c.account,
            "amount": "1000",
            "date": "2026-01-01",
            "source": "Reviewed",
        },
    )
    c.commitment(
        "Monthly",
        100,
        "expense",
        "2026-01-31",
        recurrence="monthly",
        weekend_rule="roll_forward",
        end_date="2026-04-01",
    )
    rows = c.state()["occurrences"]
    assert len({x["id"] for x in rows}) == 3
    assert {x["expected_date"] for x in rows} == {
        "2026-02-02",
        "2026-03-02",
        "2026-03-31",
    }
    f = c.forecast()["base"]
    assert len(f["unresolved"]) == 3 and not f["complete"]
    ident = rows[0]["id"]
    c.post("occurrences/" + ident, {"expected_date": "2026-10-20"}, status=200)
    assert (
        next(x for x in c.state()["occurrences"] if x["id"] == ident)["expected_date"]
        == "2026-10-20"
    )


def test_transfer_selected_scope(client):
    c = Cash(client)
    b = c.post("accounts", {"name": "Savings account"})["id"]
    for a, amount in [(c.account, "1000"), (b, "500")]:
        c.post(
            "anchors",
            {
                "account_id": a,
                "amount": amount,
                "date": "2026-10-01",
                "source": "Reviewed",
            },
        )
    c.post(
        "transfers",
        {
            "from_account_id": c.account,
            "to_account_id": b,
            "amount": "200",
            "date": "2026-10-10",
            "description": "Actual internal transfer",
        },
    )
    assert c.forecast()["base"]["cash_today"] == "1500.00"
    f = c.forecast(account_ids=c.account)["base"]
    assert f["cash_today"] == "800.00" and not f["complete"]


def test_cancel_and_partial_allocation_limits(client):
    c = story(client, "business")
    o = c.occurrence("Client")
    t = c.movement("Part receipt", 30000, "income", "2026-10-10")
    c.post(
        "settlements",
        {"transaction_id": t["id"], "occurrence_id": o["id"], "amount": "30000"},
    )
    c.post(
        "settlements",
        {"transaction_id": t["id"], "occurrence_id": o["id"], "amount": "1"},
        status=409,
    )
    c.post("occurrences/" + o["id"], {"cancelled": True}, status=200)
    assert not any(x["id"] == o["id"] for x in c.forecast()["base"]["planned"])


def test_concurrent_postgres_match(client):
    if not os.environ.get("AEGIS_CASH_TEST_DATABASE_URL"):
        pytest.skip("Requires actual PostgreSQL connections")
    c = story(client, "business")
    o = c.occurrence("Client")
    t = c.movement("Receipt", 90000, "income", "2026-10-10")
    path = f"/api/cash/workspaces/{c.w['id']}/settlements"

    def confirm(key):
        return client.post(
            path,
            headers=c.headers,
            json={
                "transaction_id": t["id"],
                "occurrence_id": o["id"],
                "amount": "90000",
                "revision": c.rev,
                "request_key": key,
            },
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(confirm, ["concurrent-key-1", "concurrent-key-2"]))
    assert sorted(r.status_code for r in results) == [201, 409]
    assert len(c.state()["settlements"]) == 1


def test_feature_disabled(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "cashflow_workspaces_enabled", False)
    assert client.get("/api/cash/workspaces").status_code == 503


def test_owner_transfer_paired_scope_and_stale_destination(client):
    c = story(client, "personal")
    other = client.post(
        "/api/cash/workspaces",
        headers=c.headers,
        json={
            "name": "Owner business",
            "kind": "business",
            "currency": "THB",
            "request_key": str(uuid.uuid4()),
        },
    ).json()
    path = f"/api/cash/workspaces/{other['id']}"
    a = client.post(
        path + "/accounts",
        headers=c.headers,
        json={
            "name": "Business account",
            "revision": 0,
            "request_key": str(uuid.uuid4()),
        },
    ).json()
    opening = client.post(
        path + "/anchors",
        headers=c.headers,
        json={
            "account_id": a["id"],
            "amount": "10000",
            "date": "2026-10-01",
            "source": "Reviewed",
            "revision": a["revision"],
            "request_key": str(uuid.uuid4()),
        },
    ).json()
    payload = {
        "from_account_id": c.account,
        "to_account_id": a["id"],
        "amount": "2500",
        "date": "2026-10-10",
        "description": "Owner contribution",
        "to_workspace_revision": opening["revision"] - 1,
    }
    before = c.rev
    c.post("transfers", payload, status=409)
    assert c.state()["workspace"]["revision"] == before
    assert client.get(path, headers=c.headers).json()["transfers"] == []
    payload.update(
        to_workspace_revision=opening["revision"],
        revision=c.rev,
        request_key=str(uuid.uuid4()),
    )
    endpoint = f"/api/cash/workspaces/{c.w['id']}/transfers"
    first = client.post(endpoint, headers=c.headers, json=payload)
    assert first.status_code == 201, first.text
    again = client.post(endpoint, headers=c.headers, json=payload)
    assert again.json() == first.json()
    c.rev = first.json()["revision"]
    dest = client.get(path, headers=c.headers).json()
    assert dest["transfers"][0]["id"] == c.state()["transfers"][0]["id"]
    assert dest["workspace"]["revision"] == opening["revision"] + 1
    assert dest["audit"][0]["operation"] == "create_transfer"
    assert c.forecast()["base"]["cash_today"] == "44500.00"
    f = client.get(
        "/api/cash/forecast",
        headers=c.headers,
        params={
            "workspace_id": other["id"],
            "as_of": "2026-10-10",
            "end": "2026-10-31",
        },
    ).json()
    assert f["base"]["cash_today"] == "12500.00"
    assert f["base"]["history"][-1]["cash"] == "12500.00"
    # A different owner cannot nominate the destination, even with its ID.
    stranger = Cash(client)
    stranger.post(
        "transfers", {**payload, "from_account_id": stranger.account}, status=404
    )
    usd = client.post(
        "/api/cash/workspaces",
        headers=c.headers,
        json={
            "name": "USD",
            "kind": "personal",
            "currency": "USD",
            "request_key": str(uuid.uuid4()),
        },
    ).json()
    usd_account = client.post(
        f"/api/cash/workspaces/{usd['id']}/accounts",
        headers=c.headers,
        json={"name": "Dollars", "revision": 0, "request_key": str(uuid.uuid4())},
    ).json()
    c.post(
        "transfers",
        {**payload, "to_account_id": usd_account["id"], "to_workspace_revision": 1},
        status=422,
    )
    assert c.forecast()["base"]["cash_today"] == "44500.00"


def test_history_and_reversed_payment_is_not_matchable(client):
    c = story(client, "personal")
    f = c.forecast()["base"]
    assert f["history"][0]["cash"] is None
    assert f["history"][-1]["cash"] == f["cash_today"]
    tx = c.movement(
        "Utilities record entered by mistake", "1200", "expense", "2026-10-10"
    )
    c.post("movements/" + tx["id"] + "/reverse", status=200)
    o = c.occurrence("Utilities")
    c.post(
        "settlements",
        {"transaction_id": tx["id"], "occurrence_id": o["id"], "amount": "1200"},
        status=409,
    )
    assert c.forecast()["base"]["cash_today"] == "47000.00"
    c.post("scenarios", {"name": "No changes"}, status=422)


def test_linked_source_and_leap_recurrence(client):
    c = Cash(client)
    plan = client.post(
        "/api/plans/",
        headers=c.headers,
        json={
            "title": "Intent",
            "category": "expense",
            "amount": 123.45,
            "currency": "THB",
            "start_date": "2026-10-15",
        },
    )
    assert plan.status_code == 201, plan.text
    txn = client.post(
        "/api/transactions/",
        headers=c.headers,
        json={
            "amount": 123.45,
            "type": "expense",
            "category": "Other",
            "date": "2026-10-01",
            "plan_id": plan.json()["id"],
            "is_recurring": True,
            "recurring_interval": "monthly",
        },
    )
    assert txn.status_code == 201, txn.text
    c.commitment(
        "Linked plan",
        "123.45",
        "expense",
        "2026-10-15",
        source_kind="plan",
        source_id=plan.json()["id"],
    )
    c.post(
        "commitments",
        {
            "account_id": c.account,
            "title": "Duplicate linked source",
            "direction": "expense",
            "amount": "123.45",
            "start_date": "2026-10-15",
            "source_kind": "transaction",
            "source_id": txn.json()["id"],
        },
        status=409,
    )
    c.commitment(
        "Leap-month bill",
        "10",
        "expense",
        "2028-01-31",
        end_date="2028-03-31",
        recurrence="monthly",
    )
    occurrences = [
        o for o in c.state()["occurrences"] if o["title"] == "Leap-month bill"
    ]
    assert sorted(o["nominal_date"] for o in occurrences) == [
        "2028-01-31",
        "2028-02-29",
        "2028-03-31",
    ]


def test_line_undo_cannot_delete_adopted_cash_record(client, monkeypatch):
    from .test_line_finance import event as line_event
    from app.models.line_finance import LineFinanceDraft, LineFinanceIdentity
    from app.models.transaction import Transaction, TransactionType

    settings = get_settings()
    monkeypatch.setattr(settings, "line_finance_channel_secret", "test-channel-secret")
    monkeypatch.setattr(settings, "line_finance_channel_id", "test-channel")
    c = Cash(client)
    # Historical confirmed account-only LINE capture, before destination linking.
    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        t = Transaction(
            user_id=c.w["user_id"],
            type=TransactionType.expense,
            amount="65.25",
            category="Other",
            description="Historical LINE coffee",
            date=date(2026, 10, 5),
        )
        db.add(t)
        db.flush()
        d = LineFinanceDraft(
            id=str(uuid.uuid4()),
            user_id=c.w["user_id"],
            state="confirmed",
            transaction_id=t.id,
            data={
                "type": "expense",
                "amount": "65.25",
                "date": "2026-10-05",
                "currency": "THB",
            },
        )
        db.add(d)
        db.add(LineFinanceIdentity(line_id="cash-owner-line", user_id=c.w["user_id"]))
        db.commit()
    finally:
        gen.close()
    draft = client.get("/api/line-finance/drafts", headers=c.headers).json()[0]
    record = client.get("/api/transactions/", headers=c.headers).json()[0]
    c.post(
        "legacy/adopt",
        {
            "account_id": c.account,
            "transaction_ids": [record["id"]],
            "confirmed_currency": "THB",
        },
        status=200,
    )
    line_event(client, "undo " + draft["id"], who="cash-owner-line")
    assert any(t["id"] == record["id"] for t in c.state()["movements"])
    assert (
        client.get("/api/line-finance/drafts", headers=c.headers).json()[0]["state"]
        == "confirmed"
    )
