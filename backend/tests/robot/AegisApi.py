"""Robot keywords use real HTTP; capabilities stay private to this library.

All credentials, actors and records are fictional and confined to a disposable
loopback PostgreSQL server. No keyword sends a request to LINE or an AI provider.
"""

import base64
import hashlib
import hmac
import io
import json
import os
import uuid
from urllib.parse import quote, urljoin, urlparse

import requests
import numpy as np
import zxingcpp
from PIL import Image
from robot.api.deco import keyword, library
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.models.finance_integration import (
    FinanceIntegrationJob, FinanceLineIdentity, FinanceLinkChallenge,
    FinanceNotificationOutbox,
)
from app.models.finance_ledger import JournalEntry, LedgerAudit, LedgerDraft

SIGNATURE = b"fictional-robot-webhook-secret"
WORKER = "fictional-robot-worker-token-000000000000000000"
PASSWORD = "FictionalOnly-20261025!"


@library(scope="SUITE", auto_keywords=False)
class AegisApi:
    def __init__(self, base_url="http://127.0.0.1:8000"):
        parsed = urlparse(base_url)
        assert parsed.scheme == "http" and parsed.hostname == "127.0.0.1" and parsed.port == 8000
        value = os.environ.get("AEGIS_ROBOT_DATABASE_URL", "")
        dburl = make_url(value)
        assert dburl.database == "aegis_robot_test" and dburl.host == "127.0.0.1"
        self.base = base_url
        self.engine = create_engine(value, pool_size=1, max_overflow=0,
                                    connect_args={"options": "-cstatement_timeout=5000 -clock_timeout=1000 -cidle_in_transaction_session_timeout=10000 -cwork_mem=4096 -cmax_parallel_workers_per_gather=0"})
        self.session = None
        self.state = {}

    def _call(self, method, path, *, expected=200, session=None, **kwargs):
        client = session or self.session
        response = client.request(method, self.base + path, timeout=8, **kwargs)
        assert response.status_code == expected, f"{method} {path.split('?')[0]} returned {response.status_code}, expected {expected}"
        return response

    def _db(self, action):
        with Session(self.engine) as db:
            return action(db)

    def _clock(self, seconds):
        self._call("POST", "/__robot__/clock", json={"seconds": seconds},
                   headers={"x-robot-control": "fictional-robot-control"})

    def _owner(self, email=None):
        if self.session:
            self.session.close()
        self.session = requests.Session()
        self.session.trust_env = False
        self._clock(0)
        unique = uuid.uuid4().hex
        email = email or f"robot-{unique}@example.invalid"
        row = self._call("POST", "/api/auth/register", expected=201,
                         json={"email": email, "username": "robot-" + unique, "password": PASSWORD}).json()
        self._login(email)
        self.state = {"owner": row["id"], "email": email, "actor": "robot-actor-" + unique}

    def _login(self, email):
        return self._call("POST", "/api/auth/login", json={"email": email, "password": PASSWORD})

    def _challenge(self):
        result = self._call("POST", "/api/integrations/line/link-challenges", json={})
        assert result.headers["cache-control"] == "no-store, private"
        value = result.json()
        self.state["challenge"] = value
        return value

    def _event(self, text=None, postback=None, actor=None, event_id=None, source="user", bad_signature=False):
        event_id = event_id or str(uuid.uuid4())
        event = {"type": "postback" if postback else "message", "webhookEventId": event_id,
                 "timestamp": 1792886400000, "source": {"type": source, "userId": actor or self.state["actor"]}}
        event["postback" if postback else "message"] = {"data": postback} if postback else {"type": "text", "id": event_id, "text": text}
        body = json.dumps({"destination": "fictional-robot-bot", "events": [event]}).encode()
        signature = base64.b64encode(hmac.new(SIGNATURE, body, hashlib.sha256).digest()).decode()
        anonymous = requests.Session()
        anonymous.trust_env = False
        try:
            return self._call("POST", "/api/integrations/line/webhook", expected=403 if bad_signature else 200,
                              session=anonymous, data=body, headers={"content-type": "application/json", "x-line-signature": "invalid" if bad_signature else signature})
        finally:
            anonymous.close()

    def _status(self):
        return self._call("GET", "/api/integrations/line/status").json()

    def _link(self):
        self._event(text=self._challenge()["command"])
        assert self._status()["linked"] is True

    def _account(self):
        row = self._call("POST", "/api/accounts", expected=201,
                         headers={"Idempotency-Key": str(uuid.uuid4())},
                         json={"name": "Robot checking", "subtype": "bank", "currency": "THB"}).json()
        self.state["account"] = row["id"]
        self._call("POST", "/api/accounts/opening-balances", expected=201,
                   headers={"Idempotency-Key": str(uuid.uuid4())},
                   json={"cutoff_at": "2026-10-01T00:00:00+07:00", "reviewed": True,
                         "accounts": [{"account_id": row["id"], "signed_balance_minor": "1000000"}]})

    def _budget(self, confirm=True):
        row = self._call("POST", "/api/budgets/", expected=201,
                         json={"name": "Robot monthly food", "amount": 5000, "category": "food",
                               "period_start": "2026-10-01", "period_end": "2026-10-31"}).json()
        self.state["budget"] = row["id"]
        if confirm:
            report = self._report()
            self._call("POST", f"/api/finance/budgets/{row['id']}/confirm-currency",
                       json={"currency": "THB", "reviewed": True, "expected_facts_hash": report["facts_hash"]})

    def _report(self):
        return next(row for row in self._call("GET", "/api/finance/budgets").json() if row["id"] == self.state["budget"])

    def _outbox(self, purpose):
        return self._db(lambda db: [row.payload for row in db.query(FinanceNotificationOutbox)
                                  .filter_by(owner_id=self.state["owner"], purpose=purpose)
                                  .order_by(FinanceNotificationOutbox.created_at.desc()).limit(20)])

    def _expense(self):
        self._account()
        self._link()
        self._event(text=f"expense 150.25 account:{self.state['account']} date:2026-10-20 category:food robot-test")
        job = self._call("POST", "/api/integrations/jobs/claim", json={"kinds": ["text"]},
                         headers={"Authorization": "Bearer " + WORKER}).json()["job"]
        assert job is not None, "Signed text did not create a claimable job"
        result = self._call("POST", f"/api/integrations/jobs/{job['id']}/process",
                            headers={"Authorization": "Bearer " + job["lease_token"]},
                            json={"generation": job["generation"]}).json()
        self.state["draft"] = result["draft_id"]
        previews = self._outbox("draft_preview")
        assert previews, "No durable draft preview"
        items = previews[0]["messages"][0]["quickReply"]["items"]
        self.state["confirm"] = next(item["action"]["data"] for item in items if item["action"]["label"] == "Confirm")

    def _balance(self):
        return self._call("GET", "/api/accounts/balances").json()["net_position_minor"]

    @keyword
    def start_fresh_owner(self):
        self._owner()

    @keyword
    def close_test_client(self):
        if self.session:
            self.session.close()

    @keyword
    def verify_real_postgresql_target(self):
        assert self._call("GET", "/__robot__/metadata").json() == {"test_fixture": True, "database": "aegis_robot_test", "dialect": "postgresql"}

    @keyword
    def protected_routes_require_authentication(self):
        anonymous = requests.Session()
        anonymous.trust_env = False
        try:
            for route in ["/api/accounts/balances", "/api/integrations/line/status", "/api/finance/budgets"]:
                self._call("GET", route, expected=401, session=anonymous)
        finally:
            anonymous.close()

    @keyword
    def web_session_cookie_lasts_a_day(self):
        response = self._login(self.state["email"])
        cookie = response.headers.get("set-cookie", "")
        assert "HttpOnly" in cookie and "Max-Age=86400" in cookie and "SameSite=lax" in cookie

    @keyword
    def setup_is_private_local_qr_and_twenty_four_hours(self):
        result = self._challenge()
        assert result["expires_in_seconds"] == 86400
        assert result["line_url"] == "https://line.me/R/oaMessage/%40aegis-robot-fixture/?" + quote(result["command"], safe="")
        image = Image.open(io.BytesIO(base64.b64decode(result["qr_image_data_url"].split(",", 1)[1])))
        assert image.format == "PNG" and image.width == image.height
        decoded = zxingcpp.read_barcodes(np.asarray(image.convert("RGB")))
        assert len(decoded) == 1 and decoded[0].text == result["line_url"], "The QR must decode to the intended private chat URL"
        hashes = self._db(lambda db: [row.token_hash for row in db.query(FinanceLinkChallenge).filter_by(owner_id=self.state["owner"])])
        assert result["command"][5:] not in hashes
        assert hashlib.sha256(result["command"][5:].encode()).hexdigest() in hashes

    @keyword
    def setup_still_links_after_twenty_hours(self):
        command = self._challenge()["command"]
        self._clock(20 * 3600 + 1)
        self._event(text=command)
        assert self._status()["linked"]

    @keyword
    def setup_expires_at_twenty_four_hours(self):
        command = self._challenge()["command"]
        self._clock(86400)
        self._event(text=command)
        assert not self._status()["linked"]

    @keyword
    def renewal_rejects_the_previous_setup_code(self):
        old = self._challenge()["command"]
        fresh = self._challenge()["command"]
        self._event(text=old)
        assert not self._status()["linked"]
        self._event(text=fresh)
        assert self._status()["linked"]

    @keyword
    def consumed_setup_cannot_bind_another_actor(self):
        command = self._challenge()["command"]
        self._event(text=command)
        self._event(text=command, actor="fictional-other-actor")
        actors = self._db(lambda db: [row.actor_id for row in db.query(FinanceLineIdentity).filter_by(owner_id=self.state["owner"])])
        assert actors == [self.state["actor"]]

    @keyword
    def line_identity_survives_seven_days(self):
        self._link()
        self._clock(7 * 86400)
        self._event(text="help")
        assert self._status()["linked"] and self._outbox("help")

    @keyword
    def invalid_signatures_and_group_chat_cannot_link(self):
        command = self._challenge()["command"]
        self._event(text=command, bad_signature=True)
        self._event(text=command, source="group")
        assert not self._status()["linked"]

    @keyword
    def preview_does_not_post_money(self):
        self._expense()
        assert self._balance() == "1000000"
        assert self._db(lambda db: db.query(JournalEntry).filter_by(owner_id=self.state["owner"]).count()) == 1
        drafts = self._call("GET", "/api/transaction-drafts").json()
        assert len(drafts) == 1 and drafts[0]["status"] == "pending"

    @keyword
    def duplicate_confirmation_has_one_financial_effect(self):
        self._expense()
        self._event(postback=self.state["confirm"], event_id="robot-confirm-" + self.state["owner"])
        self._event(postback=self.state["confirm"], event_id="robot-confirm-" + self.state["owner"])
        self._event(postback=self.state["confirm"])
        assert self._balance() == "984975"
        count = self._db(lambda db: db.query(JournalEntry).filter_by(owner_id=self.state["owner"], kind="expense").count())
        assert count == 1

    @keyword
    def budget_and_refund_arithmetic_is_exact(self):
        self._expense()
        self._event(postback=self.state["confirm"])
        self._budget()
        assert self._report()["spent_minor"] == "15025"
        assert self._report()["remaining_minor"] == "484975"
        expense = self._call("GET", "/api/transaction-drafts").json()[0]["posted_journal_id"]
        draft = self._call("POST", "/api/transaction-drafts", expected=201,
                           json={"type": "refund", "amount_minor": "5005", "currency": "THB", "occurred_on": "2026-10-21",
                                 "target_account_id": self.state["account"], "original_expense_entry_id": expense, "category": "food"}).json()
        self._call("POST", f"/api/transaction-drafts/{draft['id']}/confirm", expected=201,
                   headers={"Idempotency-Key": str(uuid.uuid4())}, json={"expected_version": draft["version"]})
        report = self._report()
        assert report["spent_minor"] == "10020" and report["remaining_minor"] == "489980"
        self._event(text="budgets")
        reply = self._outbox("budgets")[0]["messages"][0]["text"]
        assert "100.20" in reply and "4,899.80" in reply

    @keyword
    def unreviewed_currency_has_no_remaining_cap(self):
        self._account()
        self._budget(confirm=False)
        assert self._report()["remaining_minor"] is None
        self._link()
        self._event(text="งบ")
        assert "Review this limit's currency" in self._outbox("budgets")[0]["messages"][0]["text"]

    @keyword
    def stale_budget_review_is_rejected(self):
        self._account()
        self._budget(confirm=False)
        previous = self._report()
        self._call("PUT", "/api/budgets/" + self.state["budget"], json={"amount": 6000})
        self._call("POST", f"/api/finance/budgets/{self.state['budget']}/confirm-currency", expected=409,
                   json={"currency": "THB", "reviewed": True, "expected_facts_hash": previous["facts_hash"]})
        assert self._report()["remaining_minor"] is None
        assert self._db(lambda db: db.query(LedgerAudit).filter_by(owner_id=self.state["owner"], operation="budget_currency_confirmed").count()) == 0

    @keyword
    def shortcuts_do_not_create_jobs_or_journals(self):
        self._account()
        self._link()
        before = self._balance()
        journal_count = self._db(lambda db: db.query(JournalEntry).filter_by(owner_id=self.state["owner"]).count())
        draft_count = self._db(lambda db: db.query(LedgerDraft).filter_by(owner_id=self.state["owner"]).count())
        for text in ["budgets", "งบ", "balances", "pending", "help", "tools"]:
            self._event(text=text)
        for code in ["slip", "entry", "balances", "budgets", "pending", "help", "trips"]:
            self._event(postback="aegis-menu:" + code)
        assert self._balance() == before
        assert self._db(lambda db: db.query(JournalEntry).filter_by(owner_id=self.state["owner"]).count()) == journal_count
        assert self._db(lambda db: db.query(LedgerDraft).filter_by(owner_id=self.state["owner"]).count()) == draft_count
        assert self._db(lambda db: db.query(FinanceIntegrationJob).filter_by(owner_id=self.state["owner"]).count()) == 0

    @keyword
    def disconnect_retires_pending_confirmation(self):
        self._expense()
        self._call("DELETE", "/api/integrations/line/link", expected=204)
        self._event(postback=self.state["confirm"])
        assert not self._status()["linked"] and self._balance() == "1000000"

    @keyword
    def web_logout_does_not_disconnect_line(self):
        self._link()
        self._call("POST", "/api/auth/logout", expected=204)
        self._call("GET", "/api/integrations/line/status", expected=401)
        self._login(self.state["email"])
        assert self._status()["linked"]

    @keyword
    def one_owner_cannot_review_another_owners_budget(self):
        self._account()
        self._budget(confirm=False)
        budget_id = self.state["budget"]
        report = self._report()
        self._owner()
        assert self._call("GET", "/api/finance/budgets").json() == []
        self._call("POST", f"/api/finance/budgets/{budget_id}/confirm-currency", expected=404,
                   json={"currency": "THB", "reviewed": True, "expected_facts_hash": report["facts_hash"]})

    @keyword
    def keep_fictional_browser_fixture(self):
        self._owner(email="aegis-robot-browser@example.invalid")
        self._account()
        self._budget(confirm=False)
        assert self._balance() == "1000000"

    @keyword
    def frontend_budget_collection_round_trip_stays_on_origin(self):
        """Separate topology regression; requires the integrated frontend."""
        self._account()
        self._budget(confirm=False)
        url = "http://127.0.0.1:3000/api/budgets/?active=true"
        visited = set()
        for _ in range(4):
            assert url not in visited, "The frontend/API collection redirects form a loop"
            visited.add(url)
            response = self.session.get(url, allow_redirects=False, timeout=8)
            if response.is_redirect:
                target = urljoin(url, response.headers["location"])
                parsed = urlparse(target)
                assert (parsed.scheme, parsed.hostname, parsed.port) == ("http", "127.0.0.1", 3000), "The collection redirect escapes the frontend origin"
                url = target
                continue
            assert response.status_code == 200, "The authenticated frontend collection did not load"
            assert any(row["id"] == self.state["budget"] for row in response.json())
            return
        raise AssertionError("The collection exceeded its bounded redirect count")
