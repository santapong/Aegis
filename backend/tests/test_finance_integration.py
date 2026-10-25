"""Trusted actor, exact draft, fenced worker and private media boundaries."""

import base64
import hashlib
import hmac
import io
import json
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from types import SimpleNamespace

import httpx
import pytest
from PIL import Image

from app.config import get_settings
from app.database import get_db
from app.main import app
from app.models.finance_integration import (
    FinanceActionCapability,
    FinanceEvidence,
    FinanceInbox,
    FinanceIntegrationJob,
    FinanceNotificationOutbox,
    utcnow,
)
from app.models.finance_ledger import LedgerDraft
from app.services import finance_integration as service
from app.services.finance_integration_worker import deliver_batch, extract_openai
from app.services.money_ledger import MoneyError

from .conftest import _register
from .test_cashflow import client as shared_client

client = shared_client


@pytest.fixture(autouse=True)
def configuration(monkeypatch, tmp_path):
    values = {
        "finance_ledger_enabled": True,
        "line_finance_channel_id": "test-ledger-channel",
        "line_finance_destination": "test-ledger-bot",
        "line_finance_channel_secret": "test-ledger-signature-secret",
        "finance_integration_service_token": "test-scoped-worker-secret-0000000000000000",
        "finance_integration_delivery_enabled": False,
        "finance_integration_daily_push_budget": 20,
        "finance_integration_delivery_token": "test-delivery-scope-secret-000000000000000",
        "finance_integration_evidence_dir": str(tmp_path / "private-evidence"),
    }
    for key, value in values.items():
        monkeypatch.setattr(get_settings(), key, value)


def database(action):
    generator = app.dependency_overrides[get_db]()
    db = next(generator)
    try:
        return action(db)
    finally:
        generator.close()


def event(
    client,
    text=None,
    actor="pilot",
    *,
    event_id=None,
    source="user",
    postback=None,
    image=False,
):
    ev = {
        "type": "postback" if postback else "message",
        "webhookEventId": event_id or str(uuid.uuid4()),
        "timestamp": 1792630800000,
        "source": {"type": source, "userId": actor},
    }
    if postback:
        ev["postback"] = {"data": postback}
    else:
        ev["message"] = {
            "type": "image" if image else "text",
            "id": "fixture-message-1",
        }
        if not image:
            ev["message"]["text"] = text
    return webhook(client, {"destination": "test-ledger-bot", "events": [ev]})


def webhook(client, payload):
    body = json.dumps(payload).encode()
    signature = base64.b64encode(
        hmac.new(b"test-ledger-signature-secret", body, hashlib.sha256).digest()
    ).decode()
    return client.post(
        "/api/integrations/line/webhook",
        content=body,
        headers={"content-type": "application/json", "x-line-signature": signature},
    )


def setup(client, actor="pilot"):
    headers, owner = _register(
        client, uuid.uuid4().hex + "@example.com", "owner" + uuid.uuid4().hex[:10]
    )
    account = client.post(
        "/api/accounts",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"name": "Fictional bank", "subtype": "bank"},
    )
    assert account.status_code == 201, account.text
    account_id = account.json()["id"]
    opened = client.post(
        "/api/accounts/opening-balances",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json={
            "cutoff_at": "2026-10-01T00:00:00+07:00",
            "reviewed": True,
            "accounts": [{"account_id": account_id, "signed_balance_minor": "100000"}],
        },
    )
    assert opened.status_code == 201, opened.text
    challenge = client.post(
        "/api/integrations/line/link-challenges", headers=headers, json={}
    )
    assert challenge.status_code == 200, challenge.text
    assert event(client, challenge.json()["command"], actor).status_code == 200
    return headers, owner, account_id


def claim(client, kind="text"):
    r = client.post(
        "/api/integrations/jobs/claim",
        json={"kinds": [kind]},
        headers={
            "Authorization": "Bearer "
            + get_settings().finance_integration_service_token
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["job"]


def complete(client, job, result=None):
    return client.post(
        f"/api/integrations/jobs/{job['id']}/complete",
        headers={"Authorization": "Bearer " + job["lease_token"]},
        json={"generation": job["generation"], "result": result or {}},
    )


def button(draft_id, label="Confirm"):
    def find(db):
        rows = (
            db.query(FinanceNotificationOutbox)
            .filter_by(purpose="draft_preview")
            .order_by(FinanceNotificationOutbox.created_at.desc())
            .all()
        )
        for row in rows:
            for item in row.payload["messages"][0]["quickReply"]["items"]:
                token = item["action"]["data"]
                cap = db.get(FinanceActionCapability, service.digest(token[6:]))
                if cap.draft_id == draft_id and item["action"]["label"] == label:
                    return token

    return database(find)


def draft(client, account_id):
    assert (
        event(
            client, f"expense 1.25 coffee account:{account_id} date:2026-10-19"
        ).status_code
        == 200
    )
    job = claim(client)
    r = complete(client, job)
    assert r.status_code == 200, r.text
    return r.json(), job


def test_signature_destination_empty_and_disabled(client, monkeypatch):
    assert (
        client.post("/api/integrations/line/webhook", json={"events": []}).status_code
        == 403
    )
    assert (
        webhook(client, {"destination": "another-bot", "events": []}).status_code == 400
    )
    assert (
        webhook(client, {"destination": "test-ledger-bot", "events": []}).status_code
        == 200
    )
    monkeypatch.setattr(get_settings(), "finance_ledger_enabled", False)
    assert (
        webhook(client, {"destination": "test-ledger-bot", "events": []}).status_code
        == 503
    )
    assert database(lambda db: db.query(FinanceInbox).count()) == 0


def test_unknown_and_group_are_audited_without_jobs(client):
    event(client, "expense 99", actor="unlinked")
    event(client, "expense 99", source="group")
    assert database(lambda db: db.query(FinanceInbox).count()) == 2
    assert database(lambda db: db.query(FinanceIntegrationJob).count()) == 0
    assert database(lambda db: {r.safe_code for r in db.query(FinanceInbox)}) == {
        "UNLINKED_IDENTITY",
        "PRIVATE_CHAT_REQUIRED",
    }


def test_signed_bad_event_does_not_drop_valid_batch_sibling(client):
    headers, _, account = setup(client)
    payload = {
        "destination": "test-ledger-bot",
        "events": [
            {"type": "message", "source": {"type": "user", "userId": "pilot"}},
            {
                "type": "message",
                "webhookEventId": "valid-sibling",
                "source": {"type": "user", "userId": "pilot"},
                "message": {"type": "text", "text": f"expense 1 account:{account}"},
            },
        ],
    }
    assert webhook(client, payload).status_code == 200
    assert webhook(client, payload).status_code == 200
    assert (
        database(
            lambda db: db.query(FinanceInbox)
            .filter_by(event_id="valid-sibling")
            .one()
            .state
        )
        == "accepted"
    )
    assert database(lambda db: db.query(FinanceIntegrationJob).count()) == 1
    assert len(client.get("/api/financial-transactions", headers=headers).json()) == 1


def test_menu_and_operations_are_read_only_and_privacy_scoped(client):
    headers, _, _ = setup(client)
    for code in ["slip", "entry", "balances", "pending", "trips", "unknown"]:
        assert event(client, postback="aegis-menu:" + code).status_code == 200
    assert database(lambda db: db.query(FinanceIntegrationJob).count()) == 0
    assert len(client.get("/api/financial-transactions", headers=headers).json()) == 1
    assert (
        client.get("/api/integrations/operations", headers=headers).status_code == 401
    )
    operations = client.get(
        "/api/integrations/operations",
        headers={
            "Authorization": "Bearer "
            + get_settings().finance_integration_service_token
        },
    )
    assert operations.status_code == 200
    assert "pilot" not in operations.text and "Fictional bank" not in operations.text
    assert set(operations.json()) == {
        "jobs",
        "delivery",
        "oldest_job_age_seconds",
        "oldest_delivery_age_seconds",
        "failure_codes",
        "reconciliation",
        "delivery_enabled",
    }

    def guidance(db):
        row = (
            db.query(FinanceNotificationOutbox).filter_by(purpose="slip_guidance").one()
        )
        assert [
            i["action"]["type"]
            for i in row.payload["messages"][0]["quickReply"]["items"]
        ] == ["camera", "cameraRoll"]

    database(guidance)


def test_link_token_hash_expiry_reuse_and_disconnect(client):
    headers, _ = _register(client)
    command = client.post(
        "/api/integrations/line/link-challenges", headers=headers
    ).json()["command"]

    def expire(db):
        from app.models.finance_integration import FinanceLinkChallenge

        row = db.query(FinanceLinkChallenge).one()
        assert row.token_hash != command[5:]
        row.expires_at = utcnow() - timedelta(seconds=1)
        db.commit()

    database(expire)
    event(client, command)
    assert not client.get("/api/integrations/line/status", headers=headers).json()[
        "linked"
    ]
    fresh = client.post(
        "/api/integrations/line/link-challenges", headers=headers
    ).json()["command"]
    event(client, fresh)
    event(client, fresh, actor="attacker")
    assert client.get("/api/integrations/line/status", headers=headers).json()["linked"]
    client.delete("/api/integrations/line/link", headers=headers)
    assert not client.get("/api/integrations/line/status", headers=headers).json()[
        "linked"
    ]


def test_typed_draft_versioned_actor_confirm_and_replay_once(client):
    headers, _, account = setup(client)
    result, job = draft(client, account)
    assert (
        len(client.get("/api/financial-transactions", headers=headers).json()) == 1
    )  # opening only
    assert complete(client, job).json() == result
    action = button(result["draft_id"])
    event(client, postback=action, actor="attacker")
    assert len(client.get("/api/financial-transactions", headers=headers).json()) == 1
    event(client, postback=action, event_id="confirm-once")
    event(client, postback=action, event_id="confirm-once")
    event(client, postback=action)
    txns = client.get("/api/financial-transactions", headers=headers).json()
    assert len(txns) == 2 and txns[-1]["amount_minor"] == "125"
    assert (
        client.get("/api/accounts/balances", headers=headers).json()[
            "net_position_minor"
        ]
        == "99875"
    )


def test_edit_invalidates_old_confirmation_and_fresh_preview_works(client):
    headers, _, account = setup(client)
    result, _ = draft(client, account)
    action = button(result["draft_id"])
    r = client.patch(
        f"/api/transaction-drafts/{result['draft_id']}",
        headers=headers,
        json={"expected_version": 1, "patch": {"amount_minor": "200"}},
    )
    assert r.status_code == 200
    event(client, postback=action)
    current = client.get("/api/transaction-drafts", headers=headers).json()[0]
    assert current["version"] == 2 and current["status"] == "pending"
    r = client.post(
        f"/api/integrations/line/drafts/{result['draft_id']}/preview", headers=headers
    )
    assert r.status_code == 200
    event(client, postback=button(result["draft_id"]))
    assert (
        client.get("/api/transaction-drafts", headers=headers).json()[0]["status"]
        == "posted"
    )


def test_inactive_linked_owner_cannot_confirm_and_event_is_durably_audited(client):
    from app.models.user import User
    from app.models.finance_ledger import JournalEntry

    _, owner, account = setup(client)
    result, _ = draft(client, account)
    token = button(result["draft_id"])

    def disable(db):
        db.get(User, owner).is_active = False
        db.commit()

    database(disable)
    assert event(client, postback=token, event_id="inactive-action").status_code == 200
    assert database(lambda db: db.query(JournalEntry).count()) == 1
    assert (
        database(
            lambda db: db.query(FinanceInbox)
            .filter_by(event_id="inactive-action")
            .one()
            .safe_code
        )
        == "ACCOUNT_UNAVAILABLE"
    )


def test_job_capability_and_expired_generation_fence_all_draft_writes(client):
    headers, _, account = setup(client)
    event(client, f"expense 2 account:{account} date:2026-10-19")
    assert (
        client.post(
            "/api/integrations/jobs/claim", json={"kinds": ["text"]}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/integrations/jobs/claim", json={"kinds": ["capture"]}
        ).status_code
        == 422
    )
    first = claim(client)
    wrong = dict(first, lease_token="wrong-capability")
    assert complete(client, wrong).status_code == 409

    def expire(db):
        db.get(FinanceIntegrationJob, first["id"]).lease_until = utcnow() - timedelta(
            seconds=1
        )
        db.commit()

    database(expire)
    assert complete(client, first).status_code == 409
    second = claim(client)
    assert second["generation"] == first["generation"] + 1
    assert complete(client, first).status_code == 409
    assert complete(client, second, {"owner_id": "attacker"}).status_code == 403
    assert database(lambda db: db.query(LedgerDraft).count()) == 0
    assert complete(client, second).status_code == 200
    assert complete(client, second, {"amount_minor": "99999"}).status_code == 409
    assert len(client.get("/api/transaction-drafts", headers=headers).json()) == 1


def test_disconnect_cancels_jobs_actions_and_outbox_and_relink_cannot_revive(client):
    headers, _, account = setup(client)
    result, _ = draft(client, account)
    token = button(result["draft_id"])
    event(client, f"expense 3 account:{account}")
    old_job = claim(client)
    client.delete("/api/integrations/line/link", headers=headers)
    assert complete(client, old_job).status_code == 409
    assert (
        database(
            lambda db: db.query(FinanceNotificationOutbox)
            .filter_by(state="pending")
            .count()
        )
        == 0
    )
    command = client.post(
        "/api/integrations/line/link-challenges", headers=headers
    ).json()["command"]
    event(client, command)
    event(client, postback=token)
    assert (
        client.get("/api/transaction-drafts", headers=headers).json()[0]["status"]
        == "pending"
    )


def png():
    stream = io.BytesIO()
    Image.new("RGB", (16, 16), (255, 255, 255)).save(stream, format="PNG")
    return stream.getvalue()


def capture(client):
    event(client, image=True)

    def committed(db):
        result = service.claim(db, ["capture"])
        db.commit()
        return result

    job = database(committed)

    def store(db):
        result = service.capture_bytes(
            db, job["id"], job["lease_token"], job["generation"], png(), "image/png"
        )
        db.commit()
        return result

    return database(store), job


def test_private_media_capture_extraction_and_source_scoping(client):
    headers, owner, _ = setup(client)
    captured, _ = capture(client)
    evidence = captured["evidence_id"]
    other, _ = _register(client, "other@example.com", "other")
    assert (
        client.get(f"/api/integrations/evidence/{evidence}", headers=other).status_code
        == 404
    )
    own = client.get(f"/api/integrations/evidence/{evidence}", headers=headers)
    assert (
        own.status_code == 200 and own.headers["cache-control"] == "private, no-store"
    )
    job = claim(client, "extract")
    assert (
        client.get(
            f"/api/integrations/jobs/{job['id']}/evidence/{evidence}?generation={job['generation']}",
            headers={"Authorization": "Bearer " + job["lease_token"]},
        ).status_code
        == 200
    )
    assert complete(client, job, {"owner_id": owner}).status_code == 422
    assert (
        complete(
            client, job, {"type": "expense", "amount_minor": "125", "currency": "THB"}
        ).status_code
        == 200
    )
    stored = client.get("/api/transaction-drafts", headers=headers).json()[0]
    assert stored["payload"]["evidence_ids"] == [evidence]
    assert stored["validation_errors"] and stored["payload"]["occurred_on"] is None
    assert database(lambda db: db.query(FinanceEvidence).one().state) == "extracted"


def test_media_invalid_or_stale_never_persists_evidence(client):
    setup(client)
    event(client, image=True)

    def exercise(db):
        job = service.claim(db, ["capture"])
        db.commit()
        with pytest.raises(MoneyError, match="validated"):
            service.capture_bytes(
                db,
                job["id"],
                job["lease_token"],
                job["generation"],
                b"\x89PNG\r\n\x1a\ninvalid",
                "image/png",
            )
        db.rollback()
        row = db.get(FinanceIntegrationJob, job["id"])
        row.lease_until = utcnow() - timedelta(seconds=1)
        db.commit()
        with pytest.raises(MoneyError) as exc:
            service.capture_bytes(
                db, job["id"], job["lease_token"], job["generation"], png(), "image/png"
            )
        assert exc.value.code == "STALE_LEASE"
        assert db.query(FinanceEvidence).count() == 0

    database(exercise)


def test_delivery_disabled_and_uncertain_retry_key_body_preserved(client, monkeypatch):
    setup(client)
    requests = []

    class Uncertain:
        def post(self, url, **kwargs):
            # Claims are committed before provider I/O, so a network timeout
            # cannot hold PostgreSQL row locks or an outer financial transaction.
            assert not current_session[0].in_transaction()
            requests.append(kwargs)
            raise httpx.ReadTimeout("fake timeout")

    current_session = [None]

    def disabled(db):
        with pytest.raises(MoneyError) as exc:
            deliver_batch(db, Uncertain())
        assert exc.value.code == "DELIVERY_DISABLED"

    database(disabled)
    monkeypatch.setattr(get_settings(), "finance_integration_delivery_enabled", True)
    monkeypatch.setattr(get_settings(), "line_finance_access_token", "test-token")

    def retry(db):
        current_session[0] = db
        deliver_batch(db, Uncertain())
        db.commit()
        row = db.query(FinanceNotificationOutbox).one()
        assert row.attempts == 1 and row.state == "pending"
        row.next_at = utcnow() - timedelta(seconds=1)
        db.commit()
        deliver_batch(db, Uncertain())
        db.commit()

    database(retry)
    assert len(requests) == 2 and requests[0] == requests[1]


def test_delivery_scoped_claim_quota_expiry_fencing_and_accepted_409(
    client, monkeypatch
):
    setup(client)
    endpoint = "/api/integrations/delivery/claim"
    ordinary_service = {
        "Authorization": "Bearer " + get_settings().finance_integration_service_token
    }
    delivery_service = {
        "Authorization": "Bearer " + get_settings().finance_integration_delivery_token
    }
    assert client.post(endpoint, headers=ordinary_service).status_code == 401
    assert client.post(endpoint, headers=delivery_service).status_code == 503
    monkeypatch.setattr(get_settings(), "finance_integration_delivery_enabled", True)
    monkeypatch.setattr(get_settings(), "line_finance_access_token", "test-token")
    monkeypatch.setattr(get_settings(), "finance_integration_daily_push_budget", 1)
    first = client.post(endpoint, headers=delivery_service).json()["delivery"]
    assert first["payload"]["to"] == "pilot" and first["retry_key"] == first["id"]
    assert client.post(endpoint, headers=delivery_service).json()["delivery"] is None

    def expire(db):
        db.get(FinanceNotificationOutbox, first["id"]).lease_until = (
            utcnow() - timedelta(seconds=1)
        )
        db.commit()

    database(expire)
    done = f"/api/integrations/delivery/{first['id']}/complete"
    assert (
        client.post(
            done,
            headers={"Authorization": "Bearer " + first["lease_token"]},
            json={"generation": first["generation"], "provider_status": 200},
        ).status_code
        == 409
    )
    monkeypatch.setattr(get_settings(), "finance_integration_daily_push_budget", 2)
    second = client.post(endpoint, headers=delivery_service).json()["delivery"]
    assert (
        second["payload"] == first["payload"]
        and second["retry_key"] == first["retry_key"]
    )
    assert second["generation"] == 2
    accepted = client.post(
        done,
        headers={"Authorization": "Bearer " + second["lease_token"]},
        json={
            "generation": second["generation"],
            "provider_status": 409,
            "provider_ack": "fake-accepted",
        },
    )
    assert (
        accepted.status_code == 200 and accepted.json()["state"] == "provider_accepted"
    )
    assert (
        database(lambda db: db.get(FinanceNotificationOutbox, first["id"]).payload)
        == {}
    )


def test_n8n_process_uses_fixed_source_and_fences_again_after_provider(
    client, monkeypatch
):
    headers, _, account = setup(client)
    event(client, f"expense 3 account:{account} date:2026-10-19")
    job = claim(client)
    r = client.post(
        f"/api/integrations/jobs/{job['id']}/process",
        headers={"Authorization": "Bearer " + job["lease_token"]},
        json={"generation": job["generation"]},
    )
    assert r.status_code == 200 and r.json()["version"] == 1
    captured, _ = capture(client)
    image_job = claim(client, "extract")

    def fake_provider(client, content, mime, settings):
        def expire(db):
            db.get(FinanceIntegrationJob, image_job["id"]).lease_until = (
                utcnow() - timedelta(seconds=1)
            )
            db.commit()

        database(expire)
        return {"type": "expense", "amount_minor": "999", "currency": "THB"}

    from app.services import finance_integration_worker

    monkeypatch.setattr(finance_integration_worker, "extract_openai", fake_provider)
    r = client.post(
        f"/api/integrations/jobs/{image_job['id']}/process",
        headers={"Authorization": "Bearer " + image_job["lease_token"]},
        json={"generation": image_job["generation"]},
    )
    assert r.status_code == 409
    assert (
        database(lambda db: db.get(FinanceEvidence, captured["evidence_id"]).extraction)
        is None
    )
    assert len(client.get("/api/transaction-drafts", headers=headers).json()) == 1


def test_ambiguous_text_never_silently_selects_an_account():
    for text in [
        "expense 1.2.3 coffee",
        "expense 1 account:a from:b",
        "income 2 from:a",
        "transfer 2 account:a",
        "expense 2 original:entry",
    ]:
        with pytest.raises(MoneyError):
            service.parse_text(text)


def test_postgres_simultaneous_duplicate_and_distinct_confirmation_once(client):
    if not os.environ.get("AEGIS_CASH_TEST_DATABASE_URL"):
        pytest.skip("Requires genuine PostgreSQL row-lock execution")
    headers, _, account = setup(client)
    with ThreadPoolExecutor(2) as pool:
        responses = list(
            pool.map(
                lambda _: event(
                    client,
                    f"expense 2 account:{account} date:2026-10-19",
                    event_id="one-event",
                ),
                range(2),
            )
        )
    assert all(r.status_code == 200 for r in responses)
    assert database(lambda db: db.query(FinanceIntegrationJob).count()) == 1
    job = claim(client)
    result = complete(client, job).json()
    token = button(result["draft_id"])
    with ThreadPoolExecutor(2) as pool:
        responses = list(pool.map(lambda _: event(client, postback=token), range(2)))
    assert all(r.status_code == 200 for r in responses)
    assert len(client.get("/api/financial-transactions", headers=headers).json()) == 2
    assert (
        client.get("/api/accounts/balances", headers=headers).json()[
            "net_position_minor"
        ]
        == "99800"
    )


def test_image_evidence_corrections_preserve_lineage_and_attach_without_reposting(
    client,
):
    from app.models.finance_integration import FinanceEntryEvidence

    headers, _, account = setup(client)
    captured, _ = capture(client)
    job = claim(client, "extract")
    result = complete(
        client,
        job,
        {
            "type": "expense",
            "amount_minor": "125",
            "currency": "THB",
            "occurred_on": "2026-10-19",
            "source_account_id": account,
            "description": "fictional receipt",
        },
    )
    assert result.status_code == 200
    draft_id = result.json()["draft_id"]
    posted = client.post(
        f"/api/transaction-drafts/{draft_id}/confirm",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"expected_version": 1},
    )
    assert posted.status_code == 201, posted.text
    current = client.get("/api/transaction-drafts", headers=headers).json()[0][
        "payload"
    ]
    journal_id = posted.json()["journal_id"]
    for value in ["200", "250"]:
        corrected = client.post(
            f"/api/financial-transactions/{journal_id}/corrections",
            headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
            json={
                "correction_effective_on": "2026-10-20",
                "reason": "fictional corrected receipt",
                "replacement": {**current, "amount_minor": value},
            },
        )
        assert corrected.status_code == 201, corrected.text
        journal_id = corrected.json()["replacement_journal_id"]
    assert (
        database(
            lambda db: db.query(FinanceEntryEvidence)
            .filter_by(evidence_id=captured["evidence_id"])
            .count()
        )
        == 3
    )
    before = len(client.get("/api/financial-transactions", headers=headers).json())
    capture(client)
    attached_job = claim(client, "extract")
    new_draft = complete(
        client, attached_job, {"amount_minor": "250", "currency": "THB"}
    ).json()["draft_id"]
    changed = client.patch(
        f"/api/transaction-drafts/{new_draft}",
        headers=headers,
        json={
            "expected_version": 1,
            "patch": {
                "duplicate_resolution": "attach",
                "attach_to_journal_id": journal_id,
            },
        },
    )
    assert changed.status_code == 200
    attached = client.post(
        f"/api/transaction-drafts/{new_draft}/confirm",
        headers={**headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"expected_version": 2},
    )
    assert attached.status_code == 201 and attached.json()["status"] == "attached", (
        attached.text
    )
    assert (
        len(client.get("/api/financial-transactions", headers=headers).json()) == before
    )


def test_configured_vision_adapter_is_untrusted_and_never_called_without_model():
    settings = SimpleNamespace(
        finance_integration_ocr_provider="openai",
        finance_integration_ocr_key="test-key",
        finance_integration_ocr_model="",
    )

    class Fake:
        def post(self, url, **kwargs):
            assert url == "https://api.openai.com/v1/responses"
            assert kwargs["json"]["store"] is False
            assert kwargs["json"]["input"][1]["content"][0]["image_url"].startswith(
                "data:image/png;base64,"
            )
            return SimpleNamespace(
                raise_for_status=lambda: None,
                json=lambda: {
                    "output": [
                        {
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": '{"amount_minor":"125"}',
                                }
                            ]
                        }
                    ]
                },
            )

    with pytest.raises(MoneyError) as exc:
        extract_openai(Fake(), png(), "image/png", settings)
    assert exc.value.code == "OCR_NOT_CONFIGURED"
    settings.finance_integration_ocr_model = "explicit-test-vision-model"
    assert extract_openai(Fake(), png(), "image/png", settings) == {
        "amount_minor": "125"
    }
