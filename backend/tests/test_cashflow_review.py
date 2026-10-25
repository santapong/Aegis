"""Independent-review regressions: target retries, assignment races and variance."""

import asyncio
import copy
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from threading import Event, Lock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text

from app.database import get_db
from app.main import app
from app.models.cashflow import CashAudit
from app.models.line_finance import LineFinanceDraft, LineFinanceIdentity
from app.services.cashflow import digest
from .test_cashflow import Cash, client as shared_client
from .test_cashflow_m3 import business, document, get, snapshot
from .test_cashflow_m4 import database
from .test_line_finance import channel as shared_channel, event as line_event

client = shared_client
channel = shared_channel


def legacy(c):
    response = c.client.post(
        "/api/transactions/",
        headers=c.headers,
        json={
            "amount": 65,
            "type": "expense",
            "date": "2026-10-01",
            "category": "Food",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def adoption(c, *, wid=None, aid=None, revision=None, ids):
    return c.client.post(
        f"/api/cash/workspaces/{wid or c.w['id']}/legacy/adopt",
        headers=c.headers,
        json={
            "revision": c.rev if revision is None else revision,
            "request_key": str(uuid.uuid4()),
            "account_id": aid or c.account,
            "transaction_ids": ids,
            "confirmed_currency": "THB",
        },
    )


@pytest.mark.parametrize("operation", ["cancel", "credit", "review", "settle"])
def test_document_retry_is_bound_to_target(client, operation):
    c = business(client)
    a, b = document(c, reference="A"), document(c, reference="B")
    payloads = {
        "cancel": {"reason": "Reviewed cancellation"},
        "credit": {"reason": "Reviewed discount", "amount": "10"},
        "review": {"expected_date": "2026-10-16"},
        "settle": {"amount": "10", "date": "2026-10-05"},
    }
    body = {**payloads[operation], "revision": c.rev, "request_key": str(uuid.uuid4())}
    suffix = "" if operation == "review" else f"/{operation}"
    url = f"/api/cash/workspaces/{c.w['id']}/business/documents/"
    first = client.post(url + a["id"] + suffix, headers=c.headers, json=body)
    assert first.status_code == (201 if operation == "settle" else 200), first.text
    before = c.state()
    retry = client.post(url + a["id"] + suffix, headers=c.headers, json=body)
    assert retry.status_code == first.status_code and retry.json() == first.json()
    wrong = client.post(url + b["id"] + suffix, headers=c.headers, json=body)
    assert wrong.status_code == 409, wrong.text
    assert c.state() == before  # No second payment, adjustment, revision or audit.


@pytest.mark.parametrize("operation", ["archive", "reverse", "occurrence"])
def test_other_resource_retries_cannot_return_another_targets_success(
    client, operation
):
    c = Cash(client)
    if operation == "archive":
        a = c.post("accounts", {"name": "A"})["id"]
        b = c.post("accounts", {"name": "B"})["id"]
        paths = [f"accounts/{i}/archive" for i in [a, b]]
        data = {}
    elif operation == "reverse":
        ids = [c.movement(i, "10", "expense", "2026-10-01")["id"] for i in ["A", "B"]]
        paths = [f"movements/{i}/reverse" for i in ids]
        data = {}
    else:
        c.commitment("A", "10", "expense", "2026-10-20")
        c.commitment("B", "10", "expense", "2026-10-20")
        paths = [f"occurrences/{c.occurrence(i)['id']}" for i in ["A", "B"]]
        data = {"amount": "15"}
    body = {**data, "revision": c.rev, "request_key": str(uuid.uuid4())}
    root = f"/api/cash/workspaces/{c.w['id']}/"
    first = client.post(root + paths[0], headers=c.headers, json=body)
    assert first.status_code == 200, first.text
    before = c.state()
    assert (
        client.post(root + paths[0], headers=c.headers, json=body).json()
        == first.json()
    )
    assert client.post(root + paths[1], headers=c.headers, json=body).status_code == 409
    assert c.state() == before


def test_ambiguous_pre_repair_audit_retry_is_refused_and_history_preserved(client):
    c = business(client)
    a, b = document(c, reference="A"), document(c, reference="B")
    operation = "cancel_business_document"
    body = {
        "reason": "Reviewed cancellation",
        "revision": c.rev,
        "request_key": str(uuid.uuid4()),
    }
    path = f"/api/cash/workspaces/{c.w['id']}/business/documents/"
    assert (
        client.post(
            path + a["id"] + "/cancel", headers=c.headers, json=body
        ).status_code
        == 200
    )

    def historical(db):
        row = (
            db.query(CashAudit)
            .filter_by(workspace_id=c.w["id"], request_key=body["request_key"])
            .one()
        )
        row.request_hash = digest({"operation": operation, "body": body})
        db.commit()

    database(historical)
    before = c.state()
    for ident in [a["id"], b["id"]]:
        assert (
            client.post(
                path + ident + "/cancel", headers=c.headers, json=body
            ).status_code
            == 409
        )
    assert c.state() == before
    c.rev = before["workspace"]["revision"]
    c.post(
        f"business/documents/{b['id']}/cancel",
        {"reason": "Newly reviewed cancellation"},
        status=200,
    )


def test_variance_uses_frozen_anchor_when_later_opening_already_exists(client):
    c = business(client)
    c.post(
        "anchors",
        {
            "account_id": c.account,
            "amount": "5500",
            "date": "2026-10-02",
            "source": "Reviewed later opening",
        },
    )
    saved = snapshot(c)
    original = copy.deepcopy(get(c, f"business/snapshots/{saved['id']}"))
    result = get(
        c, f"business/snapshots/{saved['id']}/variance", reviewed_through="2026-10-10"
    )
    assert result["expected_cash"] == "5000.00" and result["recorded_cash"] == "5500.00"
    assert result["components"]["opening_balance_revision"] == "500.00"
    assert result["components"]["unclassified"] == "0.00"
    assert get(c, f"business/snapshots/{saved['id']}") == original


class Contention:
    """Hold the first actual row claim; observe the second waiting in PostgreSQL."""

    def __init__(self, transaction_ids):
        self.engine = database(lambda db: db.get_bind())
        self.ids = set(transaction_ids)
        self.held, self.release, self.second = Event(), Event(), Event()
        self.guard = Lock()
        self.leader = self.waiter = None

    def relevant(self, statement, params):
        values = params.values() if isinstance(params, dict) else params
        return statement.startswith(
            "UPDATE transactions SET id=transactions.id"
        ) and bool(self.ids.intersection(values))

    def before(self, conn, cursor, statement, params, context, many):
        if self.relevant(statement, params):
            pid = cursor.connection.get_backend_pid()
            with self.guard:
                if self.leader is None:
                    self.leader = pid
                elif pid != self.leader:
                    self.waiter = pid
                    self.second.set()

    def after(self, conn, cursor, statement, params, context, many):
        if (
            self.relevant(statement, params)
            and cursor.connection.get_backend_pid() == self.leader
            and not self.held.is_set()
        ):
            self.held.set()
            assert self.release.wait(15), (
                "Release the row claim after observing contention"
            )

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self.before)
        event.listen(self.engine, "after_cursor_execute", self.after)
        return self

    def wait_for_lock(self):
        assert self.second.wait(10), "Competing writer never attempted a claim"
        deadline = time.monotonic() + 5
        with self.engine.connect() as observer:
            while time.monotonic() < deadline:
                blockers = observer.execute(
                    text("SELECT pg_blocking_pids(:pid)"), {"pid": self.waiter}
                ).scalar()
                if self.leader in blockers:
                    return
                time.sleep(0.02)
        raise AssertionError("No actual PostgreSQL row contention observed")

    def __exit__(self, *args):
        self.release.set()
        event.remove(self.engine, "before_cursor_execute", self.before)
        event.remove(self.engine, "after_cursor_execute", self.after)


def require_postgres():
    if not os.environ.get("AEGIS_CASH_TEST_DATABASE_URL"):
        pytest.skip("Actual PostgreSQL required for concurrent row claims")


def test_postgres_concurrent_assignments_have_one_winner_and_no_losing_audit(client):
    require_postgres()
    c = Cash(client)
    w = client.post(
        "/api/cash/workspaces",
        headers=c.headers,
        json={
            "name": "Second business",
            "kind": "business",
            "currency": "THB",
            "request_key": str(uuid.uuid4()),
        },
    ).json()
    a = client.post(
        f"/api/cash/workspaces/{w['id']}/accounts",
        headers=c.headers,
        json={"name": "Second cash", "revision": 0, "request_key": str(uuid.uuid4())},
    ).json()
    ids = sorted([legacy(c), legacy(c)])
    # Opposite input orders must still acquire transaction rows in sorted order.
    with Contention(ids) as held, ThreadPoolExecutor(2) as pool:
        first = pool.submit(adoption, c, ids=list(reversed(ids)))
        assert held.held.wait(10)
        second = pool.submit(adoption, c, wid=w["id"], aid=a["id"], revision=1, ids=ids)
        held.wait_for_lock()
        held.release.set()
        one, two = first.result(timeout=15), second.result(timeout=15)
    assert one.status_code == 200 and two.status_code == 409, (one.text, two.text)
    assert sorted(one.json()["adopted_ids"]) == ids
    winner = c.state()
    loser = client.get(f"/api/cash/workspaces/{w['id']}", headers=c.headers).json()
    assert {t["id"] for t in winner["movements"]} == set(ids)
    assert loser["movements"] == [] and loser["workspace"]["revision"] == 1
    assert not any(a["operation"] == "adopt_legacy" for a in loser["audit"])


def historical_chat(c, tid):
    def seed(db):
        d = LineFinanceDraft(
            id=str(uuid.uuid4()),
            user_id=c.w["user_id"],
            state="confirmed",
            transaction_id=tid,
            data={
                "type": "expense",
                "amount": "65.00",
                "date": "2026-10-01",
                "currency": "THB",
            },
        )
        db.add(d)
        db.add(
            LineFinanceIdentity(
                line_id="review-historical-line", user_id=c.w["user_id"]
            )
        )
        db.commit()
        return d.id

    return database(seed)


@pytest.mark.parametrize(
    "writer", ["http_edit", "http_delete", "mcp_edit", "line_undo"]
)
@pytest.mark.parametrize("first", ["assignment", "legacy"])
def test_postgres_legacy_mutations_and_assignment_share_one_boundary(
    client, channel, monkeypatch, writer, first
):
    require_postgres()
    c = Cash(client)
    tid = legacy(c)
    c.commitment("Food plan", "65", "expense", "2026-10-20")
    oid = c.occurrence("Food plan")["id"]
    did = historical_chat(c, tid) if writer == "line_undo" else None
    # The webhook is async and uses synchronous DB calls. A held callback in
    # one TestClient portal would prevent a second request entering that same
    # event loop at all. Separate request portals model actual separate workers.
    line_client = TestClient(app) if writer == "line_undo" else None
    if writer == "mcp_edit":
        pytest.importorskip("mcp")
        from app.mcp.tools import transactions as mcp_transactions

        @contextmanager
        def scope():
            gen = app.dependency_overrides[get_db]()
            try:
                yield next(gen)
            finally:
                gen.close()

        monkeypatch.setattr(mcp_transactions, "session_scope", scope)
        monkeypatch.setattr(mcp_transactions, "resolve_user_id", lambda: c.w["user_id"])

    def old_writer():
        if writer == "http_edit":
            return client.put(
                f"/api/transactions/{tid}", headers=c.headers, json={"amount": 10}
            ).status_code
        if writer == "http_delete":
            return client.delete(
                f"/api/transactions/{tid}", headers=c.headers
            ).status_code
        if writer == "line_undo":
            return line_event(
                line_client, "undo " + did, who="review-historical-line"
            ).status_code
        try:
            asyncio.run(
                mcp_transactions.update_transaction(
                    {"transaction_id": tid, "amount": 10}
                )
            )
            return 200
        except ValueError:
            return 404

    def assign():
        return adoption(c, ids=[tid])

    with Contention([tid]) as held, ThreadPoolExecutor(2) as pool:
        leader = pool.submit(assign if first == "assignment" else old_writer)
        assert held.held.wait(10)
        waiter = pool.submit(old_writer if first == "assignment" else assign)
        held.wait_for_lock()
        held.release.set()
        lead_result, wait_result = leader.result(timeout=15), waiter.result(timeout=15)
    assigned, old_result = (
        (lead_result, wait_result)
        if first == "assignment"
        else (wait_result, lead_result)
    )
    state = c.state()
    if first == "assignment":
        assert assigned.status_code == 200, assigned.text
        assert old_result == (200 if writer == "line_undo" else 404)
        assert state["movements"][0]["amount"] == "65.00"
        c.rev = state["workspace"]["revision"]
        c.post(
            "settlements", {"transaction_id": tid, "occurrence_id": oid, "amount": "65"}
        )
        # A further stale legacy write cannot alter the matched amount or revision.
        before = c.state()
        assert old_writer() == (200 if writer == "line_undo" else 404)
        assert c.state() == before
    elif writer in {"http_edit", "mcp_edit"}:
        assert old_result == 200 and assigned.status_code == 200, assigned.text
        assert state["movements"][0]["amount"] == "10.00"
        c.rev = state["workspace"]["revision"]
        c.post(
            "settlements",
            {"transaction_id": tid, "occurrence_id": oid, "amount": "65"},
            status=409,
        )
        assert c.state() == state
    else:
        assert old_result == (200 if writer == "line_undo" else 204)
        assert assigned.status_code == 404, assigned.text
        assert state["movements"] == [] and state["workspace"]["revision"] == c.rev
        assert not any(a["operation"] == "adopt_legacy" for a in state["audit"])
    if writer == "line_undo":
        draft = client.get("/api/line-finance/drafts", headers=c.headers).json()[0]
        assert draft["state"] == ("confirmed" if first == "assignment" else "undone")
