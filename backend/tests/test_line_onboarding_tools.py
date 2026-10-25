"""Long-lived setup, local QR, persistent identity and owner-scoped shortcuts."""

import base64
import io
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from urllib.parse import quote

from app.config import get_settings
from app.models.budget import Budget
from app.models.finance_integration import (
    FinanceIntegrationJob,
    FinanceLineIdentity,
    FinanceLinkChallenge,
    FinanceNotificationOutbox,
)
from app.models.finance_ledger import LedgerAudit
from app.models.user import User
from app.services import finance_integration as service
from app.services import finance_reads as reads
from PIL import Image

from .conftest import _register
from .test_finance_integration import client, configuration, database, event, setup
from .test_finance_reads import ledger_db, post

# Imported fixtures are intentionally collected by pytest.
# ruff: noqa: F401, F811


def issue(client, headers):
    response = client.post("/api/integrations/line/link-challenges", headers=headers)
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store, private"
    return response.json()


def test_setup_qr_survives_twenty_hours_then_link_is_persistent(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "line_finance_bot_basic_id", "@aegis-test")
    monkeypatch.setattr(get_settings(), "finance_integration_link_ttl_hours", 24)
    start = datetime(2026, 10, 25, 1, tzinfo=UTC).replace(tzinfo=None)
    monkeypatch.setattr(service, "utcnow", lambda: start)
    headers, owner = _register(client)
    challenge = issue(client, headers)
    assert challenge["expires_in_seconds"] == 86400
    assert challenge["expires_at"] == "2026-10-26T01:00:00Z"
    assert challenge["line_url"] == (
        "https://line.me/R/oaMessage/%40aegis-test/?" + quote(challenge["command"], safe="")
    )
    image = Image.open(io.BytesIO(base64.b64decode(challenge["qr_image_data_url"].split(",", 1)[1])))
    assert image.format == "PNG" and image.width == image.height
    assert database(lambda db: db.query(FinanceLinkChallenge).one().token_hash) == service.digest(challenge["command"][5:])

    monkeypatch.setattr(service, "utcnow", lambda: start + timedelta(hours=20, minutes=1))
    event(client, challenge["command"])
    assert client.get("/api/integrations/line/status", headers=headers).json()["linked"]
    monkeypatch.setattr(service, "utcnow", lambda: start + timedelta(days=7))
    event(client, challenge["command"], actor="attacker")
    assert database(lambda db: db.query(FinanceLineIdentity).filter_by(owner_id=owner).count()) == 1
    event(client, "help")
    assert client.get("/api/integrations/line/status", headers=headers).json()["linked"]
    client.delete("/api/integrations/line/link", headers=headers)
    event(client, "budgets")
    assert not client.get("/api/integrations/line/status", headers=headers).json()["linked"]


def test_setup_expiry_and_renewal_invalidate_old_codes(client, monkeypatch):
    start = datetime(2026, 10, 25, 1, tzinfo=UTC).replace(tzinfo=None)
    monkeypatch.setattr(service, "utcnow", lambda: start)
    monkeypatch.setattr(get_settings(), "finance_integration_link_ttl_hours", 24)
    headers, _ = _register(client)
    old = issue(client, headers)
    monkeypatch.setattr(service, "utcnow", lambda: start + timedelta(hours=24))
    event(client, old["command"])
    assert not client.get("/api/integrations/line/status", headers=headers).json()["linked"]
    fresh = issue(client, headers)
    assert fresh["command"] != old["command"]
    event(client, old["command"])
    assert not client.get("/api/integrations/line/status", headers=headers).json()["linked"]
    event(client, fresh["command"])
    assert client.get("/api/integrations/line/status", headers=headers).json()["linked"]


def test_unexpired_code_is_replaced_and_missing_bot_keeps_copy_fallback(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "line_finance_bot_basic_id", "")
    headers, _ = _register(client)
    old, fresh = issue(client, headers), issue(client, headers)
    assert fresh["line_url"] is None and fresh["qr_image_data_url"] is None
    event(client, old["command"])
    assert not client.get("/api/integrations/line/status", headers=headers).json()["linked"]
    event(client, fresh["command"])
    assert client.get("/api/integrations/line/status", headers=headers).json()["linked"]


def test_budget_reply_exact_refunds_periods_owners_and_unknown_currency(ledger_db, monkeypatch):
    db, owner, account = ledger_db
    monkeypatch.setattr(service, "utcnow", lambda: datetime(2026, 1, 3, tzinfo=UTC).replace(tzinfo=None))
    expense = post(db, owner, account, "expense", "15025")
    post(db, owner, account, "refund", "5005", original_expense_entry_id=expense)
    other = User(email="other-limit@example.invalid", username="other-limit", hashed_password="fixture")
    db.add(other)
    db.flush()
    rows = [
        Budget(user_id=owner, name="Food monthly", amount=Decimal("200.30"), category="food", period_start=date(2026, 1, 1), period_end=date(2026, 1, 31)),
        Budget(user_id=owner, name="Overlapping cap", amount=Decimal("100.00"), category="food", period_start=date(2026, 1, 1), period_end=date(2026, 1, 31)),
        Budget(user_id=owner, name="Unknown currency", amount=Decimal("300.00"), category="food", period_start=date(2026, 1, 1), period_end=date(2026, 1, 31)),
        Budget(user_id=other.id, name="Private other owner", amount=Decimal("900.00"), category="food", period_start=date(2026, 1, 1), period_end=date(2026, 1, 31)),
        Budget(user_id=owner, name="Expired limit", amount=Decimal("900.00"), category="food", period_start=date(2026, 1, 1), period_end=date(2026, 1, 2)),
    ]
    db.add_all(rows)
    db.flush()
    for row in rows[:2]:
        reads.confirm_currency(db, owner, "budget", row)
    text = service.budget_message(db, owner)
    assert "Recorded spending: 100.20" in text
    assert "Limit: 200.30" in text and "Remaining: 100.10" in text
    assert "Over limit: 0.20" in text
    assert "Review this limit's currency" in text
    assert "Private other owner" not in text and "Expired limit" not in text
    assert "not added together" in text


def test_shortcuts_and_new_menu_never_prepare_money(client):
    headers, owner, _ = setup(client)
    for text in ["budget", "budgets", "งบ", "help", "tools", "pending", "รอตรวจ"]:
        assert event(client, text).status_code == 200
    for code in ["budgets", "help", "trips"]:
        assert event(client, postback="aegis-menu:" + code).status_code == 200
    assert database(lambda db: db.query(FinanceIntegrationJob).filter_by(owner_id=owner).count()) == 0
    assert len(client.get("/api/financial-transactions", headers=headers).json()) == 1
    replies = database(lambda db: [r.payload["messages"][0]["text"] for r in db.query(FinanceNotificationOutbox).filter_by(owner_id=owner, purpose="budgets")])
    assert replies and all("No active spending limits" in text for text in replies)


def test_currency_review_rejects_stale_budget_facts(client):
    headers, owner, _ = setup(client)
    def seed(db):
        row = Budget(user_id=owner, name="Monthly", amount=Decimal("1000.00"), category="food", period_start=date(2026, 10, 1), period_end=date(2026, 10, 31))
        db.add(row)
        db.flush()
        result = reads.budget_report(db, owner, row)
        db.commit()
        return result
    report = database(seed)
    def change(db):
        db.get(Budget, report["id"]).amount = Decimal("2000.00")
        db.commit()
    database(change)
    path = f"/api/finance/budgets/{report['id']}/confirm-currency"
    stale = client.post(path, headers=headers, json={"currency": "THB", "reviewed": True, "expected_facts_hash": report["facts_hash"]})
    assert stale.status_code == 409
    assert database(lambda db: db.query(LedgerAudit).filter_by(owner_id=owner, operation="budget_currency_confirmed").count()) == 0
    current = client.get("/api/finance/budgets", headers=headers).json()[0]
    assert client.post(path, headers=headers, json={"currency": "THB", "reviewed": True, "expected_facts_hash": current["facts_hash"]}).status_code == 200
