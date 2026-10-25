import base64
import hashlib
import hmac
import json
import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.config import get_settings
from app.services.line_finance import parse_transaction

from .conftest import _register


@pytest.fixture
def channel(monkeypatch):
    monkeypatch.setattr(
        get_settings(), "line_finance_channel_secret", "test-channel-secret"
    )
    monkeypatch.setattr(get_settings(), "line_finance_channel_id", "test-channel")
    monkeypatch.setattr(get_settings(), "cashflow_workspaces_enabled", True)


def event(client, text, who="test-line-user", event_id=None, source_type="user"):
    body = json.dumps(
        {
            "events": [
                {
                    "webhookEventId": event_id or str(uuid.uuid4()),
                    "type": "message",
                    "source": {"type": source_type, "userId": who},
                    "message": {"type": "text", "text": text},
                }
            ]
        }
    ).encode()
    sig = base64.b64encode(
        hmac.new(b"test-channel-secret", body, hashlib.sha256).digest()
    ).decode()
    return client.post(
        "/api/line-finance/webhook",
        content=body,
        headers={"x-line-signature": sig, "content-type": "application/json"},
    )


def target(client, headers, currency="THB"):
    r = client.post(
        "/api/cash/workspaces",
        headers=headers,
        json={
            "name": "LINE cash · fictional",
            "kind": "personal",
            "currency": currency,
            "request_key": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 201, r.text
    w = r.json()
    r = client.post(
        f"/api/cash/workspaces/{w['id']}/accounts",
        headers=headers,
        json={
            "name": "Reviewed cash",
            "revision": w["revision"],
            "request_key": str(uuid.uuid4()),
        },
    )
    assert r.status_code == 201, r.text
    return {
        "workspace_id": w["id"],
        "account_id": r.json()["id"],
        "confirmed_currency": "THB",
    }


def link(client, headers, who="test-line-user", selected=None):
    selected = selected or target(client, headers)
    response = client.post(
        "/api/line-finance/link-code", headers=headers, json=selected
    )
    assert response.status_code == 200, response.text
    assert event(client, response.json()["command"], who).status_code == 200
    return selected


def records(client, headers):
    destination = client.get("/api/line-finance/status", headers=headers).json()[
        "destination"
    ]
    response = client.get(
        f"/api/cash/workspaces/{destination['workspace_id']}", headers=headers
    )
    assert response.status_code == 200, response.text
    return response.json()["movements"]


def test_confirm_idempotency_and_undo(client, channel):
    headers, _ = _register(client)
    link(client, headers)
    eid = str(uuid.uuid4())
    assert event(client, "expense 65.25 coffee", event_id=eid).status_code == 200
    assert event(client, "expense 65.25 coffee", event_id=eid).status_code == 200
    drafts = client.get("/api/line-finance/drafts", headers=headers).json()
    assert len(drafts) == 1 and drafts[0]["state"] == "pending"
    assert client.get("/api/transactions/", headers=headers).json() == []
    did = drafts[0]["id"]
    assert event(client, "confirm " + did).status_code == 200
    assert event(client, "confirm " + did).status_code == 200
    txns = records(client, headers)
    assert len(txns) == 1 and Decimal(str(txns[0]["amount"])) == Decimal("65.25")
    assert event(client, "undo " + did).status_code == 200
    corrected = records(client, headers)
    assert len(corrected) == 2
    assert any(t["cash_reversal_of_id"] == txns[0]["id"] for t in corrected)
    assert (
        sum(
            Decimal(t["amount"]) * (1 if t["direction"] == "income" else -1)
            for t in corrected
        )
        == 0
    )
    assert client.get("/api/transactions/", headers=headers).json() == []
    assert (
        client.get("/api/line-finance/drafts", headers=headers).json()[0]["state"]
        == "undone"
    )


def test_unlinked_and_other_user_cannot_confirm(client, channel):
    a, _ = _register(client)
    link(client, a)
    event(client, "income 35000 salary")
    did = client.get("/api/line-finance/drafts", headers=a).json()[0]["id"]
    event(client, "confirm " + did, who="unlinked")
    b, _ = _register(client, "b@example.com", "userb")
    link(client, b, "other")
    event(client, "confirm " + did, who="other")
    assert (
        client.get("/api/line-finance/drafts", headers=a).json()[0]["state"]
        == "pending"
    )
    assert client.get("/api/line-finance/drafts", headers=b).json() == []


def test_signature_and_group_rejection(client, channel):
    assert (
        client.post("/api/line-finance/webhook", json={"events": []}).status_code == 401
    )
    a, _ = _register(client)
    link(client, a)
    event(client, "expense 50 food", source_type="group")
    assert client.get("/api/line-finance/drafts", headers=a).json() == []


def test_link_code_single_use_and_disconnect(client, channel):
    a, _ = _register(client)
    code = client.post(
        "/api/line-finance/link-code", headers=a, json=target(client, a)
    ).json()["command"]
    event(client, code)
    event(client, code, who="other")
    event(client, "expense 40 food", who="other")
    assert client.get("/api/line-finance/drafts", headers=a).json() == []
    assert client.delete("/api/line-finance/link", headers=a).status_code == 204
    assert client.get("/api/line-finance/status", headers=a).json()["linked"] is False
    event(client, "expense 40 food")
    assert client.get("/api/line-finance/drafts", headers=a).json() == []


@pytest.mark.parametrize(
    "text",
    [
        "65 coffee",
        "expense 20 and 30 food",
        "expense -5 food",
        "expense 1.234 food",
        "expense 1,23 food",
        "transfer 100 savings",
        "expense 20 USD",
        "expense 20 tomorrow",
    ],
)
def test_ambiguous_messages_do_not_parse(text):
    with pytest.raises(ValueError):
        parse_transaction(text, date(2026, 9, 23))


def test_thai_exact_amount_and_date():
    p = parse_transaction("จ่าย 1,234.50 อาหาร เมื่อวาน", date(2026, 9, 23))
    assert (
        p["amount"] == "1234.50"
        and p["date"] == "2026-09-22"
        and p["type"] == "expense"
    )
    assert parse_transaction("รับ 35000 เงินเดือน", date(2026, 9, 23))["type"] == "income"


def test_retry_worker_scrubs_accepted_reply(client, channel):
    from app.database import get_db
    from app.main import app
    from app.models.line_finance import LineFinanceReply
    from app.services.line_finance_worker import deliver_batch

    a, _ = _register(client)
    link(client, a)

    class Fake:
        def post(self, url, **kwargs):
            assert kwargs["headers"]["X-Line-Retry-Key"]
            return type(
                "Response",
                (),
                {
                    "status_code": 409,
                    "headers": {"x-line-accepted-request-id": "accepted"},
                },
            )()

    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        deliver_batch(db, "test-token", Fake())
        rows = db.query(LineFinanceReply).all()
        assert rows and all(r.state == "delivered" and r.text == "" for r in rows)
    finally:
        gen.close()


def test_currency_must_be_explicit(client, channel):
    headers, _ = _register(client)
    assert (
        client.post("/api/line-finance/link-code", headers=headers).status_code == 422
    )
    wrong = target(client, headers, "USD")
    assert (
        client.post(
            "/api/line-finance/link-code", headers=headers, json=wrong
        ).status_code
        == 422
    )
    selected = target(client, headers)
    del selected["confirmed_currency"]
    assert (
        client.post(
            "/api/line-finance/link-code", headers=headers, json=selected
        ).status_code
        == 422
    )


def test_delivery_endpoint_denies_missing_scheduler_secret(client, channel):
    assert client.post("/api/line-finance/deliver").status_code == 401
