"""Workspace LINE capture, using genuine PostgreSQL when requested by the fixture."""

import hashlib
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

import httpx
import pytest

from app.database import get_db
from app.main import app
from app.models.cashflow import CashAudit
from app.models.line_finance import (
    LineFinanceEvent,
    LineFinanceIdentity,
    LineFinanceReply,
)
from app.services.line_finance_worker import deliver_batch
from .test_cashflow import Cash, client as shared_client
from .test_line_finance import channel as shared_channel, event, link

client = shared_client
channel = shared_channel


def setup(client, who="cash-line"):
    c = Cash(client, "business")
    c.post(
        "anchors",
        {
            "account_id": c.account,
            "amount": "1000",
            "date": "2026-10-01",
            "source": "Fictional checked opening",
        },
    )
    selected = {
        "workspace_id": c.w["id"],
        "account_id": c.account,
        "confirmed_currency": "THB",
    }
    link(client, c.headers, who, selected)
    return c


def drafts(c):
    return c.client.get("/api/line-finance/drafts", headers=c.headers).json()


def sync(c):
    state = c.state()
    c.rev = state["workspace"]["revision"]
    return state


def database(action):
    generator = app.dependency_overrides[get_db]()
    db = next(generator)
    try:
        return action(db)
    finally:
        generator.close()


def test_explicit_destination_and_confirmed_cash_never_unassigned(client, channel):
    c = setup(client)
    revision = c.rev
    event(client, "expense 65.25 coffee", who="cash-line")
    d = drafts(c)[0]
    assert (
        d["data"]["workspace_id"] == c.w["id"] and d["data"]["account_id"] == c.account
    )
    assert d["data"]["workspace_revision"] == revision
    assert (
        sync(c)["movements"] == [] and c.forecast()["base"]["cash_today"] == "1000.00"
    )
    event(client, "confirm " + d["id"], who="cash-line")
    rows = sync(c)["movements"]
    assert (
        len(rows) == 1
        and rows[0]["currency"] == "THB"
        and rows[0]["account_id"] == c.account
    )
    assert c.forecast()["base"]["cash_today"] == "934.75"
    assert client.get("/api/transactions/", headers=c.headers).json() == []
    assert (
        database(
            lambda db: db.query(CashAudit)
            .filter_by(workspace_id=c.w["id"], operation="line_confirm")
            .count()
        )
        == 1
    )
    event(client, "confirm " + d["id"], who="cash-line")
    assert len(sync(c)["movements"]) == 1


def test_stale_workspace_stamp_needs_new_review_without_cash(client, channel):
    c = setup(client)
    event(client, "income 100 customer", who="cash-line")
    d = drafts(c)[0]
    c.post("buffer", {"buffer": "50"}, status=200)
    revision = c.rev
    event(client, "confirm " + d["id"], who="cash-line")
    assert drafts(c)[0]["state"] == "needs-review"
    assert sync(c)["workspace"]["revision"] == revision and c.state()["movements"] == []
    assert c.forecast()["base"]["cash_today"] == "1000.00"
    event(client, "cancel " + d["id"], who="cash-line")
    assert drafts(c)[0]["state"] == "cancelled"
    event(client, "income 100 customer", who="cash-line")
    new = next(d for d in drafts(c) if d["state"] == "pending")
    event(client, "confirm " + new["id"], who="cash-line")
    assert c.forecast()["base"]["cash_today"] == "1100.00"


def test_owner_account_currency_and_other_workspace_fail_closed(client, channel):
    c = setup(client)
    other = Cash(client)
    # Disconnect first so the destination-validation boundary is exercised.
    client.delete("/api/line-finance/link", headers=c.headers)
    for selected in [
        {
            "workspace_id": other.w["id"],
            "account_id": other.account,
            "confirmed_currency": "THB",
        },
        {
            "workspace_id": c.w["id"],
            "account_id": other.account,
            "confirmed_currency": "THB",
        },
    ]:
        assert (
            client.post(
                "/api/line-finance/link-code", headers=c.headers, json=selected
            ).status_code
            == 404
        )
    c2 = client.post(
        "/api/cash/workspaces",
        headers=c.headers,
        json={
            "name": "USD",
            "kind": "personal",
            "currency": "USD",
            "request_key": str(uuid.uuid4()),
        },
    ).json()
    a2 = client.post(
        f"/api/cash/workspaces/{c2['id']}/accounts",
        headers=c.headers,
        json={"name": "USD cash", "revision": 0, "request_key": str(uuid.uuid4())},
    ).json()
    assert (
        client.post(
            "/api/line-finance/link-code",
            headers=c.headers,
            json={
                "workspace_id": c2["id"],
                "account_id": a2["id"],
                "confirmed_currency": "THB",
            },
        ).status_code
        == 422
    )
    assert c.state()["movements"] == other.state()["movements"] == []


def test_legacy_link_never_guesses_a_new_cash_destination(client, channel):
    c = Cash(client)

    def legacy(db):
        db.add(LineFinanceIdentity(line_id="legacy-line", user_id=c.w["user_id"]))
        db.commit()

    database(legacy)
    status = client.get("/api/line-finance/status", headers=c.headers).json()
    assert (
        status["linked"]
        and status["needs_destination_review"]
        and status["destination"] is None
    )
    event(client, "expense 20 coffee", who="legacy-line")
    assert drafts(c) == [] and c.state()["movements"] == []
    assert client.get("/api/transactions/", headers=c.headers).json() == []


def test_disconnect_cancels_pending_capture_and_reply_and_relink_does_not_revive(
    client, channel
):
    c = setup(client)
    event(client, "expense 10 coffee", who="cash-line")
    old = drafts(c)[0]
    assert client.delete("/api/line-finance/link", headers=c.headers).status_code == 204
    assert drafts(c)[0]["state"] == "cancelled"
    assert database(
        lambda db: all(
            row.state == "cancelled" and row.text == ""
            for row in db.query(LineFinanceReply).filter_by(line_id="cash-line").all()
        )
    )
    link(
        client,
        c.headers,
        "cash-line",
        {
            "workspace_id": c.w["id"],
            "account_id": c.account,
            "confirmed_currency": "THB",
        },
    )
    event(client, "confirm " + old["id"], who="cash-line")
    assert c.state()["movements"] == []
    event(client, "expense 10 coffee", who="cash-line")
    new = next(d for d in drafts(c) if d["state"] == "pending")
    assert new["data"]["connection_id"] != old["data"]["connection_id"]


def test_optional_shared_match_and_undo_requires_unmatch(client, channel):
    c = setup(client)
    commitment = c.commitment("Coffee plan", 65, "expense", "2026-10-20")
    occurrence = next(
        o for o in c.state()["occurrences"] if o["commitment_id"] == commitment["id"]
    )
    event(client, "expense 65 coffee", who="cash-line")
    d = drafts(c)[0]
    event(client, "confirm " + d["id"], who="cash-line")
    tid = next(row for row in sync(c)["movements"])["id"]
    settlement = c.post(
        "settlements",
        {"transaction_id": tid, "occurrence_id": occurrence["id"], "amount": "65"},
    )
    assert (
        c.forecast()["base"]["cash_today"]
        == c.forecast()["base"]["closing_cash"]
        == "935.00"
    )
    event(client, "undo " + d["id"], who="cash-line")
    assert drafts(c)[0]["state"] == "confirmed" and len(sync(c)["movements"]) == 1
    c.post(f"settlements/{settlement['id']}/reverse", status=200)
    event(client, "undo " + d["id"], who="cash-line")
    assert drafts(c)[0]["state"] == "undone" and len(sync(c)["movements"]) == 2
    assert c.forecast()["base"]["cash_today"] == "1000.00"
    assert c.forecast()["base"]["closing_cash"] == "935.00"
    event(client, "undo " + d["id"], who="cash-line")
    assert len(sync(c)["movements"]) == 2


def test_interruption_before_outbox_rolls_back_receipt_cash_audit_draft(
    client, channel, monkeypatch
):
    from app.routers import line_finance as router

    c = setup(client)
    event(client, "income 50 customer", who="cash-line")
    d = drafts(c)[0]
    revision = c.rev
    eid = str(uuid.uuid4())
    receipt_id = hashlib.sha256(("test-channel:" + eid).encode()).hexdigest()
    model = router.LineFinanceReply

    def interrupt(**kwargs):
        raise RuntimeError("Intentional interruption before outer commit")

    monkeypatch.setattr(router, "LineFinanceReply", interrupt)
    with pytest.raises(RuntimeError, match="Intentional interruption"):
        event(client, "confirm " + d["id"], who="cash-line", event_id=eid)
    monkeypatch.setattr(router, "LineFinanceReply", model)
    assert sync(c)["workspace"]["revision"] == revision and c.state()["movements"] == []
    assert drafts(c)[0]["state"] == "pending"
    assert database(lambda db: db.get(LineFinanceEvent, receipt_id)) is None
    assert (
        database(
            lambda db: db.query(CashAudit).filter_by(operation="line_confirm").count()
        )
        == 0
    )
    event(client, "confirm " + d["id"], who="cash-line", event_id=eid)
    event(client, "confirm " + d["id"], who="cash-line", event_id=eid)
    assert (
        len(sync(c)["movements"]) == 1
        and c.forecast()["base"]["cash_today"] == "1050.00"
    )
    assert (
        database(
            lambda db: db.get(
                LineFinanceReply, str(uuid.uuid5(uuid.NAMESPACE_URL, receipt_id))
            )
        )
        is not None
    )


def test_postgres_duplicate_events_and_parallel_confirmation_once(client, channel):
    if not os.environ.get("AEGIS_CASH_TEST_DATABASE_URL"):
        pytest.skip(
            "Requires PostgreSQL locks; a SQLite mock is not concurrency evidence"
        )
    c = setup(client)
    eid = str(uuid.uuid4())
    with ThreadPoolExecutor(2) as pool:
        responses = list(
            pool.map(
                lambda _: event(
                    client, "income 50 customer", who="cash-line", event_id=eid
                ),
                range(2),
            )
        )
    assert (
        all(response.status_code == 200 for response in responses)
        and len(drafts(c)) == 1
    )
    did = drafts(c)[0]["id"]
    with ThreadPoolExecutor(2) as pool:
        responses = list(
            pool.map(
                lambda _: event(client, "confirm " + did, who="cash-line"), range(2)
            )
        )
    assert all(response.status_code == 200 for response in responses)
    assert (
        len(sync(c)["movements"]) == 1
        and c.forecast()["base"]["cash_today"] == "1050.00"
    )
    assert (
        database(
            lambda db: db.query(CashAudit).filter_by(operation="line_confirm").count()
        )
        == 1
    )


def test_uncertain_delivery_retains_same_key_body_and_expiry_requires_review(
    client, channel
):
    c = setup(client)
    requests = []

    class Uncertain:
        def post(self, url, **kwargs):
            requests.append(kwargs)
            raise httpx.ReadTimeout("Intentional unknown provider result")

    def first(db):
        deliver_batch(db, "test-token", Uncertain(), limit=1)
        row = db.query(LineFinanceReply).filter_by(line_id="cash-line").one()
        assert row.state == "pending" and row.attempts == 1
        row.next_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
        deliver_batch(db, "test-token", Uncertain(), limit=1)
        assert row.state == "pending" and row.attempts == 2
        row.created_at = datetime.utcnow() - timedelta(hours=23)
        row.next_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
        deliver_batch(db, "test-token", Uncertain(), limit=1)
        assert row.state == "needs-review"

    database(first)
    assert len(requests) == 2 and requests[0] == requests[1]
    status = client.get("/api/line-finance/status", headers=c.headers).json()
    assert status["delivery"]["needs-review"] == 1
