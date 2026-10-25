"""Trusted LINE ingress and fenced integration jobs; never commits a session.

An extractor proposes fields. Only a live owner session or an observed actor's
version-bound action capability can call the ledger confirmation boundary.
"""

import base64
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import uuid
from datetime import timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote, urlencode
from zoneinfo import ZoneInfo

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from PIL import Image, UnidentifiedImageError

from ..config import get_settings
from ..models.finance_integration import (
    FinanceActionCapability as Action,
    FinanceEvidence as Evidence,
    FinanceDeliveryBudget as DeliveryBudget,
    FinanceEntryEvidence as EntryEvidence,
    FinanceInbox as Inbox,
    FinanceIntegrationJob as Job,
    FinanceLineIdentity as Identity,
    FinanceLinkChallenge as Challenge,
    FinanceNotificationOutbox as Outbox,
    utcnow,
)
from ..models.finance_ledger import JournalEntry, LedgerAccount, LedgerDraft
from ..models.user import User
from . import money_ledger as ledger

MAX_IMAGE_BYTES = 10 * 1024 * 1024
LEASE_SECONDS = 90
MAX_ATTEMPTS = 5


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def canonical_hash(value):
    return digest(
        json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    )


def display_money(value):
    if not isinstance(value, str) or not re.fullmatch(r"-?\d{1,20}", value):
        return "unresolved"
    return format(Decimal(value) / 100, ",.2f")


def balance_message(snapshot):
    lines = ["Tracked balances in THB:"]
    for account in snapshot.get("accounts", []):
        label = "owed" if account.get("kind") == "liability" else "held"
        lines.append(
            f"{account['name']}: {display_money(account['balance_minor'])} {label}"
        )
    lines.extend(
        [
            "Assets: " + display_money(snapshot.get("asset_balance_minor")),
            "Liabilities: " + display_money(snapshot.get("liability_balance_minor")),
            "Net position: " + display_money(snapshot.get("net_position_minor")),
            "Reconciled through: "
            + (snapshot.get("last_reconciled_at") or "not yet reconciled"),
            "Tracked records do not prove bank settlement.",
        ]
    )
    return "\n".join(lines)


def budget_message(db, owner):
    """Read up to six active owner limits using the canonical exact report."""
    from ..models.budget import Budget
    from .finance_reads import budget_report

    today = utcnow().replace(tzinfo=ZoneInfo("UTC")).astimezone(
        ZoneInfo("Asia/Bangkok")
    ).date()
    budgets = (
        db.query(Budget)
        .filter(Budget.user_id == owner, Budget.period_start <= today, Budget.period_end >= today)
        .order_by(Budget.period_end, Budget.name, Budget.id)
        .limit(7)
        .all()
    )
    base = get_settings().frontend_url.rstrip("/")
    lines = [f"Spending budgets · {today.isoformat()} · THB"]
    if not budgets:
        lines.append("No active spending limits. Create a monthly budget in Aegis.")
    for budget in budgets[:6]:
        result = budget_report(db, owner, budget)
        lines.append(f"\n{budget.name[:100]} · {budget.category[:60]}")
        lines.append(f"{result['period_start']} to {result['period_end']}")
        lines.append("Recorded spending: " + display_money(result["spent_minor"]))
        if result["budget_currency_confirmed"]:
            remaining = int(result["remaining_minor"])
            lines.append("Limit: " + display_money(result["budget_minor"]))
            lines.append(
                ("Remaining: " + display_money(str(remaining))) if remaining >= 0
                else ("Over limit: " + display_money(str(-remaining)))
            )
        else:
            lines.append("Review this limit's currency in Aegis before calculating remaining budget.")
        if result["unverified_legacy_count"]:
            lines.append("Historical records with unconfirmed currency are excluded; spending may be incomplete.")
    if len(budgets) > 6:
        lines.append("\nShowing the first 6 active limits. View all in Aegis.")
    lines.extend([
        "\nLimits can overlap; they are not added together. Remaining budget is not your account balance.",
        "Manage budgets: " + base + "/budgets",
    ])
    return "\n".join(lines)


def action_message(result):
    if result.get("edit_url"):
        return "Edit this draft in authenticated Aegis: " + result["edit_url"]
    if result.get("status") == "posted":
        return (
            "Recorded "
            + display_money(result.get("amount_minor"))
            + " THB.\n"
            + balance_message(result["balances"])
        )
    if result.get("status") == "attached":
        return (
            "Evidence attached to the existing entry. No new financial posting.\n"
            + balance_message(result["balances"])
        )
    return "Draft canceled. Nothing recorded."


def _retire_draft_previews(db, owner, draft_id):
    token_hashes = {h for (h,) in db.query(Action.token_hash).filter_by(owner_id=owner, draft_id=draft_id).all()}
    db.query(Action).filter_by(owner_id=owner, draft_id=draft_id, consumed_at=None).update({"expires_at": utcnow()})
    if not token_hashes:
        return
    rows = (db.query(Outbox).filter(Outbox.owner_id == owner, Outbox.purpose == "draft_preview",
            Outbox.state.in_(["pending", "leased"]))
            .order_by(Outbox.id).with_for_update().all())
    for row in rows:
        messages = row.payload.get("messages", [])
        items = messages[0].get("quickReply", {}).get("items", []) if messages else []
        if any(isinstance(item.get("action", {}).get("data"), str)
               and item["action"]["data"].startswith("aegis:")
               and digest(item["action"]["data"][6:]) in token_hashes for item in items):
            # A worker may already hold an external request snapshot. Cancelling
            # its lease cannot recall that request, but prevents future claims.
            if row.state == "pending":
                row.payload = {}
            row.state, row.safe_code = "cancelled", "DRAFT_REVIEW_RETIRED"


def _mark_ledger_notification(db, owner, *, purpose, draft_id=None, journal_id=None, queued=False):
    from ..models.finance_ledger import LedgerNotification

    # Root creates the generic durable notification before this hook. Flushing
    # is safe inside its outer transaction and also works with autoflush=False.
    db.flush()
    query = db.query(LedgerNotification).filter_by(owner_id=owner, purpose=purpose)
    if draft_id is not None:
        query = query.filter_by(draft_id=draft_id)
    if journal_id is not None:
        query = query.filter_by(journal_id=journal_id)
    for row in query:
        row.status = "bridged" if queued else "no_link"


def draft_lifecycle(db, owner, draft_id, result, purpose):
    """Retire stale reviews and atomically bridge one owner outcome to LINE.

    Called by the shared ledger service before its final result/idempotency save.
    No network call or commit occurs here. Edits only invalidate prior reviews.
    """
    ledger.lock_owner(db, owner)
    draft = db.query(LedgerDraft).filter_by(id=draft_id, owner_id=owner).first()
    if not draft:
        error("DRAFT_NOT_FOUND", "The draft does not belong to this owner", 404)
    _retire_draft_previews(db, owner, draft_id)
    if purpose in {"edit", "edited"}:
        return False
    purpose = "canceled" if purpose in {"cancel", "cancelled", "canceled"} else purpose
    if purpose not in {"posted", "attached", "canceled"}:
        error("INVALID_NOTIFICATION_PURPOSE", "Unknown financial draft notification purpose")
    identity = active_identity(db, owner=owner)
    if identity:
        key = (f"ledger-journal:{result['journal_id']}:posted" if purpose == "posted"
               else f"ledger-draft:{draft_id}:{purpose}")
        queue_message(db, identity, key, "ledger_" + purpose, action_message(result))
    _mark_ledger_notification(db, owner, purpose=purpose, draft_id=draft_id, queued=identity is not None)
    return identity is not None


def journal_notification(db, owner, journal_id, result, purpose="corrected"):
    """Bridge a journal correction using its stable journal/purpose identity."""
    ledger.lock_owner(db, owner)
    if not db.query(JournalEntry.id).filter_by(owner_id=owner, id=journal_id).first():
        error("ENTRY_NOT_FOUND", "The notification journal does not belong to this owner", 404)
    identity = active_identity(db, owner=owner)
    if identity:
        text = ("Correction recorded on " + str(result.get("correction_effective_on", "the reviewed date"))
                + ". Original history is preserved.\n" + balance_message(result["balances"]))
        queue_message(db, identity, f"ledger-journal:{journal_id}:{purpose}", "ledger_" + purpose, text)
    _mark_ledger_notification(db, owner, purpose=purpose, journal_id=journal_id, queued=identity is not None)
    return identity is not None


def error(code, message, status=422):
    raise ledger.MoneyError(code, message, status=status)


def enabled(db):
    settings = get_settings()
    if not settings.finance_ledger_enabled:
        error("FEATURE_DISABLED", "Exact-money finance is awaiting activation", 503)
    if db.get_bind().dialect.name not in {"sqlite", "postgresql"}:
        error(
            "UNSUPPORTED_DATABASE",
            "The ledger integration requires PostgreSQL or SQLite",
            503,
        )
    return settings


def active_identity(db, *, actor=None, owner=None, channel=None):
    query = db.query(Identity).filter_by(
        channel_id=channel or get_settings().line_finance_channel_id, revoked_at=None
    )
    if actor is not None:
        query = query.filter_by(actor_id=actor)
    if owner is not None:
        query = query.filter_by(owner_id=owner)
    return query.first()


def link_challenge(db, owner):
    settings = enabled(db)
    if (
        not settings.line_finance_channel_secret
        or not settings.line_finance_destination
    ):
        error(
            "NOT_CONFIGURED",
            "Configure the separate LINE channel and destination first",
            503,
        )
    ledger.lock_owner(db, owner)
    if active_identity(db, owner=owner):
        error(
            "ALREADY_LINKED",
            "Disconnect the current LINE identity before linking again",
            409,
        )
    db.query(Challenge).filter_by(owner_id=owner, consumed_at=None).delete()
    token = secrets.token_urlsafe(32)
    lifetime = settings.finance_integration_link_ttl_hours * 3600
    expires_at = utcnow() + timedelta(seconds=lifetime)
    db.add(
        Challenge(
            token_hash=digest(token),
            owner_id=owner,
            channel_id=settings.line_finance_channel_id,
            expires_at=expires_at,
        )
    )
    command = "link " + token
    line_url = qr_image = None
    if settings.line_finance_bot_basic_id:
        import qrcode

        line_url = (
            "https://line.me/R/oaMessage/"
            + quote(settings.line_finance_bot_basic_id, safe="")
            + "/?" + quote(command, safe="")
        )
        # Encode in-process. No external QR service receives this capability.
        image = qrcode.make(line_url)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        qr_image = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()
    return {
        "command": command,
        "expires_in_seconds": lifetime,
        "expires_at": expires_at.isoformat() + "Z",
        "bot_basic_id": settings.line_finance_bot_basic_id or None,
        "line_url": line_url,
        "qr_image_data_url": qr_image,
    }


def unlink(db, owner):
    enabled(db)
    ledger.lock_owner(db, owner)
    identity = active_identity(db, owner=owner)
    if identity:
        identity.revoked_at = utcnow()
        db.query(Outbox).filter(
            Outbox.identity_id == identity.id,
            Outbox.state.in_(["pending", "leased", "needs_review"]),
        ).update({"state": "cancelled", "payload": {}})
        db.query(Action).filter_by(identity_id=identity.id, consumed_at=None).update(
            {"expires_at": utcnow()}
        )
        event_ids = db.query(Inbox.id).filter_by(identity_id=identity.id)
        db.query(Job).filter(
            Job.event_id.in_(event_ids), Job.state.in_(["queued", "leased"])
        ).update(
            {"state": "cancelled", "safe_code": "IDENTITY_REVOKED"},
            synchronize_session=False,
        )
    db.query(Challenge).filter_by(owner_id=owner, consumed_at=None).delete()


def queue_message(db, identity, key, purpose, text, actions=None):
    notification_id = str(uuid.uuid5(uuid.NAMESPACE_URL, "finance:" + key))
    if not db.get(Outbox, notification_id):
        message = {"type": "text", "text": text[:4500]}
        if actions:
            message["quickReply"] = {
                "items": [
                    {
                        "type": "action",
                        "action": {
                            "type": "postback",
                            "label": label,
                            "data": "aegis:" + token,
                            "displayText": label,
                        },
                    }
                    for label, token in actions
                ]
            }
        if purpose == "slip_guidance":
            message["quickReply"] = {
                "items": [
                    {"type": "action", "action": {"type": "camera", "label": "Camera"}},
                    {
                        "type": "action",
                        "action": {"type": "cameraRoll", "label": "Photos"},
                    },
                ]
            }
        db.add(
            Outbox(
                id=notification_id,
                owner_id=identity.owner_id,
                identity_id=identity.id,
                purpose=purpose,
                payload={"to": identity.actor_id, "messages": [message]},
            )
        )


def preview(db, identity, draft_id):
    ledger.lock_owner(db, identity.owner_id)
    draft = (
        db.query(LedgerDraft)
        .filter_by(id=draft_id, owner_id=identity.owner_id)
        .with_for_update()
        .first()
    )
    if not draft or draft.status != "pending":
        error("INVALID_DRAFT", "Only an unposted owner draft can be reviewed", 409)
    old_hashes = {
        h for (h,) in db.query(Action.token_hash).filter_by(draft_id=draft.id).all()
    }
    for old in (
        db.query(Outbox)
        .filter_by(identity_id=identity.id, purpose="draft_preview", state="pending")
        .all()
    ):
        items = (
            old.payload.get("messages", [{}])[0].get("quickReply", {}).get("items", [])
        )
        if any(
            digest(item.get("action", {}).get("data", "")[6:]) in old_hashes
            for item in items
        ):
            old.state, old.payload = "cancelled", {}
    db.query(Action).filter_by(draft_id=draft.id, consumed_at=None).update(
        {"expires_at": utcnow()}
    )
    buttons = []
    for action in ("confirm", "edit", "cancel"):
        token = secrets.token_urlsafe(32)
        db.add(
            Action(
                token_hash=digest(token),
                owner_id=identity.owner_id,
                identity_id=identity.id,
                draft_id=draft.id,
                draft_version=draft.version,
                action=action,
                expires_at=utcnow() + timedelta(hours=24),
            )
        )
        buttons.append((action.title(), token))
    p = draft.payload

    def account_label(account_id):
        if not account_id:
            return "unresolved"
        account = (
            db.query(LedgerAccount)
            .filter_by(id=account_id, owner_id=identity.owner_id)
            .first()
        )
        return (
            f"{account.name} ({account.subtype})" if account else "unresolved account"
        )

    issues = ledger.draft_dict(db, draft).get("validation_errors", [])
    evidence_links = [
        get_settings().frontend_url.rstrip("/") + "/api/integrations/evidence/" + e
        for e in p.get("evidence_ids", [])
    ]
    details = (
        f"Nothing recorded. Review version {draft.version}:\n"
        f"{p.get('type') or 'unresolved direction'} · {display_money(p.get('amount_minor'))} {p.get('currency', 'THB')}\n"
        f"Date: {p.get('occurred_on', 'missing')} ({p.get('date_precision', 'day')})\n"
        f"From: {account_label(p.get('source_account_id'))}\nTo: {account_label(p.get('target_account_id'))}\n"
        f"{p.get('description', '')}\nCategory: {p.get('category') or 'unresolved'}\n"
        f"Trip: {p.get('trip_id') or '—'}\n"
        f"Review errors: {'; '.join(i.get('message', '') for i in issues) or 'none'}\n"
        f"Private evidence: {' '.join(evidence_links) or 'none'}\n"
        "Today's date is proposed when typed text has no date. Confirm only after reviewing all fields."
    )
    queue_message(
        db,
        identity,
        f"preview:{draft.id}:{draft.version}:{uuid.uuid4()}",
        "draft_preview",
        details,
        buttons,
    )
    return {"queued": True, "version": draft.version}


def parse_text(text):
    """Explicit syntax first. Unknown/missing account IDs remain unresolved."""
    if not isinstance(text, str) or len(text) > 5000:
        error("INVALID_TEXT", "Send one text entry of at most 5000 characters")
    match = re.match(
        r"^\s*(expense|income|transfer|card_purchase|card_repayment|refund|จ่าย|รับ)\s+([\d,]+(?:\.\d+)?)(?=\s|$)\s*(.*)$",
        text,
        re.I,
    )
    if not match:
        error(
            "INVALID_TEXT",
            "Use expense 150 account:<account-id> or income 500 account:<account-id>",
        )
    kind, amount, rest = match.groups()
    kind = {"จ่าย": "expense", "รับ": "income"}.get(kind.lower(), kind.lower())
    if not re.fullmatch(r"(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?", amount):
        error("INVALID_AMOUNT", "Use a positive THB amount with at most two decimals")
    value = Decimal(amount.replace(",", "")) * 100
    if value <= 0 or value > 2**63 - 1:
        error("INVALID_AMOUNT", "Amount is outside the exact-money range")
    if re.search(r"\b(?:USD|EUR|JPY)\b|[$€¥]", rest, re.I):
        error("UNSUPPORTED_CURRENCY", "Only THB is supported")
    keys = {}

    def field(m):
        key, val = m.groups()
        if key.lower() in keys:
            error("AMBIGUOUS_FIELD", "Use each account/date field once")
        keys[key.lower()] = val
        return ""

    description = re.sub(
        r"\b(account|from|to|date|category|trip|original|cutoff):([^\s]+)",
        field,
        rest,
        flags=re.I,
    ).strip()
    account_keys = set(keys) & {"account", "from", "to"}
    if (
        (
            kind in {"expense", "card_purchase"}
            and (account_keys - {"account", "from"} or len(account_keys) > 1)
        )
        or (
            kind in {"income", "refund"}
            and (account_keys - {"account", "to"} or len(account_keys) > 1)
        )
        or (kind in {"transfer", "card_repayment"} and "account" in account_keys)
        or (kind != "refund" and "original" in keys)
    ):
        error(
            "AMBIGUOUS_ACCOUNT",
            "Use one paying/receiving account, or explicit from/to accounts for transfers",
        )
    today = (
        utcnow()
        .replace(tzinfo=ZoneInfo("UTC"))
        .astimezone(ZoneInfo("Asia/Bangkok"))
        .date()
        .isoformat()
    )
    result = {
        "type": kind,
        "amount_minor": str(int(value)),
        "currency": "THB",
        "occurred_on": keys.get("date", today),
        "occurred_at": None,
        "date_precision": "day",
        "category": keys.get("category", "Other"),
        "description": description[:500],
        "tags": [],
        "fee_minor": "0",
        "provenance": {
            "source": "typed_text",
            "amount_minor": {"source": "typed_explicit"},
            "occurred_on": {
                "source": "typed_explicit" if "date" in keys else "suggested_today",
                "timezone": "Asia/Bangkok",
            },
            "category": {
                "source": "typed_explicit"
                if "category" in keys
                else "suggested_default"
            },
        },
    }
    if kind in {"expense", "card_purchase"}:
        result["source_account_id"] = keys.get("account") or keys.get("from")
    elif kind in {"income", "refund"}:
        result["target_account_id"] = keys.get("account") or keys.get("to")
    else:
        result.update(
            source_account_id=keys.get("from"), target_account_id=keys.get("to")
        )
    if keys.get("original"):
        result["original_expense_entry_id"] = keys["original"]
    if keys.get("trip"):
        result["trip_id"] = keys["trip"]
    if keys.get("cutoff"):
        result["cutoff_resolution"] = keys["cutoff"]
    return result


def validate_signature(body, signature):
    settings = get_settings()
    if (
        not settings.line_finance_channel_secret
        or not settings.line_finance_destination
    ):
        error(
            "NOT_CONFIGURED", "The finance LINE channel is awaiting configuration", 503
        )
    expected = base64.b64encode(
        hmac.new(
            settings.line_finance_channel_secret.encode(), body, hashlib.sha256
        ).digest()
    ).decode()
    if not isinstance(signature, str) or not hmac.compare_digest(
        signature.encode(), expected.encode()
    ):
        error("INVALID_SIGNATURE", "Invalid webhook signature", 403)
    try:
        value = json.loads(body)
    except (ValueError, TypeError):
        error("INVALID_WEBHOOK", "Invalid webhook body", 400)
    if (
        not isinstance(value, dict)
        or value.get("destination") != settings.line_finance_destination
        or not isinstance(value.get("events"), list)
        or len(value["events"]) > 100
    ):
        error("INVALID_DESTINATION", "Invalid webhook destination or event batch", 400)
    return value["events"]


def accept_event(db, event):
    """Persist one signed event; caller owns the commit and duplicate savepoint."""
    settings = enabled(db)
    if not isinstance(event, dict):
        error("INVALID_WEBHOOK", "An event must be an object", 400)
    event_id = event.get("webhookEventId")
    if not isinstance(event_id, str) or not event_id or len(event_id) > 128:
        error("INVALID_WEBHOOK", "An event needs a valid webhook event ID", 400)
    existing = (
        db.query(Inbox)
        .filter_by(channel_id=settings.line_finance_channel_id, event_id=event_id)
        .first()
    )
    if existing:
        return {"id": existing.id, "replayed": True}
    source = event.get("source")
    source = source if isinstance(source, dict) else {}
    actor = source.get("userId")
    private = (
        source.get("type") == "user"
        and isinstance(actor, str)
        and 0 < len(actor) <= 128
    )
    timestamp = event.get("timestamp")
    row = Inbox(
        id=str(uuid.uuid4()),
        channel_id=settings.line_finance_channel_id,
        event_id=event_id,
        actor_id=actor if private else None,
        kind=str(event.get("type", "unknown"))[:24],
        state="ignored",
        source_timestamp=timestamp
        if type(timestamp) is int and 0 <= timestamp <= 2**63 - 1
        else None,
        payload={},
    )
    db.add(row)
    db.flush()
    if not private:
        row.safe_code = "PRIVATE_CHAT_REQUIRED"
        return {"id": row.id, "ignored": True}
    message = event.get("message") if isinstance(event.get("message"), dict) else {}
    text = message.get("text") if message.get("type") == "text" else None
    if isinstance(text, str) and text.startswith("link "):
        token_hash = digest(text[5:].strip())
        challenge = db.get(Challenge, token_hash)
        if not challenge or challenge.channel_id != settings.line_finance_channel_id:
            row.safe_code = "INVALID_LINK"
            return {"id": row.id, "ignored": True}
        ledger.lock_owner(db, challenge.owner_id)
        challenge = (
            db.query(Challenge)
            .filter_by(token_hash=token_hash)
            .with_for_update()
            .populate_existing()
            .first()
        )
        if challenge.consumed_at or challenge.expires_at <= utcnow():
            row.safe_code = "INVALID_LINK"
            return {"id": row.id, "ignored": True}
        if active_identity(db, actor=actor) or active_identity(
            db, owner=challenge.owner_id
        ):
            row.safe_code = "ALREADY_LINKED"
            return {"id": row.id, "ignored": True}
        identity = Identity(
            id=str(uuid.uuid4()),
            owner_id=challenge.owner_id,
            actor_id=actor,
            channel_id=settings.line_finance_channel_id,
        )
        db.add(identity)
        db.flush()
        challenge.consumed_at = utcnow()
        row.owner_id, row.identity_id, row.state = (
            identity.owner_id,
            identity.id,
            "processed",
        )
        queue_message(
            db,
            identity,
            "link:" + row.id,
            "link",
            "Aegis connected. Your LINE link stays active until you disconnect it in Aegis. Nothing is recorded without your review. Send help for shortcuts, or expense 150 account:<account-id>.",
        )
        return {"id": row.id, "linked": True}
    identity = active_identity(db, actor=actor)
    if not identity:
        row.safe_code = "UNLINKED_IDENTITY"
        return {"id": row.id, "ignored": True}
    ledger.lock_owner(db, identity.owner_id)
    identity = (
        db.query(Identity)
        .filter_by(id=identity.id, revoked_at=None)
        .populate_existing()
        .first()
    )
    if not identity:
        row.safe_code = "UNLINKED_IDENTITY"
        return {"id": row.id, "ignored": True}
    row.owner_id, row.identity_id = identity.owner_id, identity.id
    if event.get("type") == "postback":
        postback = event.get("postback")
        data = postback.get("data") if isinstance(postback, dict) else None
        if isinstance(data, str) and data.startswith("aegis-menu:"):
            known = handle_menu(db, identity, row.id, data[11:])
            row.state = "processed" if known else "ignored"
            row.safe_code = None if known else "UNSUPPORTED_MENU"
            return {"id": row.id}
        if not isinstance(data, str) or not data.startswith("aegis:"):
            row.safe_code = "INVALID_ACTION"
            return {"id": row.id, "ignored": True}
        try:
            with db.begin_nested():
                result = apply_action(db, identity, data[6:])
            if not result.get("notification_queued"):
                queue_message(
                    db,
                    identity,
                    "action:" + row.id,
                    "action_result",
                    action_message(result),
                )
            row.state = "processed"
        except ledger.MoneyError as exc:
            row.safe_code = exc.code
            row.state = "needs_review"
            queue_message(db, identity, "action:" + row.id, "action_error", str(exc))
        return {"id": row.id}
    if event.get("type") != "message":
        row.safe_code = "UNSUPPORTED_EVENT"
        return {"id": row.id, "ignored": True}
    shortcuts = {
        "budget": "budgets", "budgets": "budgets", "งบ": "budgets", "งบประมาณ": "budgets",
        "pending": "pending", "review": "pending", "รอตรวจ": "pending",
        "help": "help", "tools": "help", "menu": "help", "ช่วยเหลือ": "help", "เมนู": "help",
    }
    shortcut = shortcuts.get(text.strip().lower()) if isinstance(text, str) else None
    if shortcut:
        handle_menu(db, identity, row.id, shortcut)
        row.state = "processed"
        return {"id": row.id}
    if isinstance(text, str) and text.strip().lower() in {
        "balance",
        "balances",
        "ยอดเงิน",
    }:
        result = ledger.balances(db, identity.owner_id)
        queue_message(
            db,
            identity,
            "balance:" + row.id,
            "balance",
            balance_message(result),
        )
        row.state = "processed"
        return {"id": row.id}
    kind = message.get("type")
    message_id = message.get("id")
    if kind not in {"text", "image"} or (kind == "text" and not isinstance(text, str)):
        row.safe_code = "UNSUPPORTED_MESSAGE"
        return {"id": row.id, "ignored": True}
    if kind == "text" and len(text) > 5000:
        row.safe_code = "INVALID_TEXT"
        return {"id": row.id, "ignored": True}
    if kind == "image" and (
        not isinstance(message_id, str)
        or not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", message_id)
    ):
        row.safe_code = "INVALID_MEDIA_ID"
        return {"id": row.id, "ignored": True}
    row.message_id = message_id if isinstance(message_id, str) else None
    row.payload = {"text": text} if kind == "text" else {}
    row.state = "accepted"
    db.add(
        Job(
            id=str(uuid.uuid4()),
            owner_id=identity.owner_id,
            event_id=row.id,
            kind="text" if kind == "text" else "capture",
        )
    )
    return {"id": row.id, "queued": True}


def handle_menu(db, identity, event_id, code):
    base = get_settings().frontend_url.rstrip("/")
    if code == "slip":
        queue_message(
            db,
            identity,
            "menu:" + event_id,
            "slip_guidance",
            "Send one payment per PNG/JPEG/WebP image up to 10 MiB. Aegis stores it privately. Extraction is only a proposal; review missing fields and Confirm/Edit/Cancel before any posting.",
        )
    elif code == "entry":
        queue_message(
            db,
            identity,
            "menu:" + event_id,
            "entry_guidance",
            "Use expense 150 account:<account-id> or income 500 account:<account-id>. Transfers: transfer 100 from:<account-id> to:<account-id>. Choose your owned accounts in "
            + base
            + "/accounts. No money is recorded until you confirm its exact draft version.",
        )
    elif code == "balances":
        queue_message(
            db,
            identity,
            "menu:" + event_id,
            "balance",
            balance_message(ledger.balances(db, identity.owner_id)),
        )
    elif code == "pending":
        count = (
            db.query(LedgerDraft)
            .filter_by(owner_id=identity.owner_id, status="pending")
            .count()
        )
        failed = (
            db.query(Job).filter_by(owner_id=identity.owner_id, state="failed").count()
        )
        queue_message(
            db,
            identity,
            "menu:" + event_id,
            "review_queue",
            f"{count} drafts awaiting review; {failed} failed preparation jobs. Review missing fields, duplicates and errors in authenticated Aegis: "
            + base
            + "/review",
        )
    elif code == "budgets":
        queue_message(
            db, identity, "menu:" + event_id, "budgets",
            budget_message(db, identity.owner_id),
        )
    elif code == "help":
        queue_message(
            db, identity, "menu:" + event_id, "help",
            "Aegis shortcuts:\n"
            "budgets / งบ — spending limits, recorded spending and remaining budget\n"
            "balances / ยอดเงิน — tracked account balances\n"
            "pending / รอตรวจ — drafts awaiting review\n"
            "expense 150 account:<account-id> — prepare an expense\n"
            "income 500 account:<account-id> — prepare income\n"
            "transfer 100 from:<account-id> to:<account-id> — prepare a transfer\n"
            "Entries still need your explicit confirmation.\n"
            "Accounts: " + base + "/accounts\n"
            "Your LINE link stays active until disconnected. If replies stop, check service availability before linking again.",
        )
    elif code == "trips":
        queue_message(
            db,
            identity,
            "menu:" + event_id,
            "trips_budgets",
            "Review your trip and budget reporting in authenticated Aegis: "
            + base
            + "/trips · "
            + base
            + "/budgets",
        )
    else:
        return False
    return True


def reject_event(db, event, code):
    """Durably audit one malformed signed event without losing valid siblings."""
    settings = get_settings()
    raw_id = event.get("webhookEventId") if isinstance(event, dict) else None
    event_id = (
        raw_id
        if isinstance(raw_id, str) and 0 < len(raw_id) <= 128
        else "invalid:" + canonical_hash(event)
    )
    if (
        db.query(Inbox)
        .filter_by(channel_id=settings.line_finance_channel_id, event_id=event_id)
        .first()
    ):
        return
    source = event.get("source") if isinstance(event, dict) else None
    actor = (
        source.get("userId")
        if isinstance(source, dict) and source.get("type") == "user"
        else None
    )
    identity = active_identity(db, actor=actor) if isinstance(actor, str) else None
    if identity:
        user = db.query(User).filter_by(id=identity.owner_id, is_active=True).first()
        if not user:
            identity = None
        else:
            ledger.lock_owner(db, identity.owner_id)
            identity = (
                db.query(Identity)
                .filter_by(id=identity.id, revoked_at=None)
                .populate_existing()
                .first()
            )
    row = Inbox(
        id=str(uuid.uuid4()),
        channel_id=settings.line_finance_channel_id,
        event_id=event_id,
        actor_id=actor if identity else None,
        identity_id=identity.id if identity else None,
        owner_id=identity.owner_id if identity else None,
        kind="invalid",
        state="needs_review" if identity else "ignored",
        safe_code=code[:64],
        payload={},
    )
    db.add(row)
    db.flush()
    if identity:
        queue_message(
            db,
            identity,
            "rejected:" + row.id,
            "action_error",
            "This event needs a fresh review in Aegis. Nothing recorded. Code: "
            + code[:64],
        )


def apply_action(db, identity, token):
    token_hash = digest(token)
    action = db.query(Action).filter_by(token_hash=token_hash).with_for_update().first()
    if (
        not action
        or action.owner_id != identity.owner_id
        or action.identity_id != identity.id
    ):
        error(
            "INVALID_ACTION",
            "This action does not belong to your current LINE connection",
            403,
        )
    if action.consumed_at:
        return action.result
    if action.expires_at <= utcnow():
        error(
            "EXPIRED_ACTION",
            "This review button expired; open Aegis for a fresh review",
            409,
        )
    if action.action == "confirm":
        result = ledger.confirm_draft(
            db,
            identity.owner_id,
            action.draft_id,
            action.draft_version,
            "line-action:" + token_hash,
        )
    elif action.action == "cancel":
        result = ledger.cancel_draft(
            db, identity.owner_id, action.draft_id, action.draft_version
        )
    else:
        draft = (
            db.query(LedgerDraft)
            .filter_by(id=action.draft_id, owner_id=identity.owner_id)
            .first()
        )
        if (
            not draft
            or draft.version != action.draft_version
            or draft.status != "pending"
        ):
            error("STALE_DRAFT", "This review version has changed", 409)
        result = {
            "edit_url": get_settings().frontend_url.rstrip("/")
            + "/review?"
            + urlencode({"draft": action.draft_id}),
            "message": "Edit in authenticated Aegis, then request a fresh preview",
        }
    action.consumed_at, action.result = utcnow(), result
    return result


def claim(db, kinds, *, lease_seconds=LEASE_SECONDS):
    enabled(db)
    now = utcnow()
    job = (
        db.query(Job)
        .filter(
            Job.kind.in_(kinds),
            Job.available_at <= now,
            or_(
                Job.state == "queued",
                (Job.state == "leased") & (Job.lease_until <= now),
            ),
        )
        .order_by(Job.created_at)
        .with_for_update(skip_locked=True)
        .first()
    )
    if not job:
        return None
    if job.attempts >= MAX_ATTEMPTS:
        job.state, job.safe_code = "failed", "RETRY_EXHAUSTED"
        return None
    token = secrets.token_urlsafe(32)
    job.state, job.generation = "leased", job.generation + 1
    job.attempts += 1
    job.lease_hash, job.lease_until = (
        digest(token),
        now + timedelta(seconds=lease_seconds),
    )
    event = db.get(Inbox, job.event_id)
    result = {
        "id": job.id,
        "kind": job.kind,
        "generation": job.generation,
        "lease_token": token,
        "lease_until": job.lease_until.isoformat() + "Z",
        "source": event.payload,
    }
    if job.kind == "capture":
        result["message_id"] = event.message_id
    if job.kind == "extract":
        evidence = (
            db.query(Evidence).filter_by(event_id=event.id, owner_id=job.owner_id).one()
        )
        result["evidence_id"] = evidence.id
    return result


def fenced_job(db, job_id, token, generation, *, allow_done=False):
    enabled(db)
    job = db.get(Job, job_id)
    if not job:
        error("JOB_NOT_FOUND", "Job not found", 404)
    ledger.lock_owner(db, job.owner_id)
    job = db.query(Job).filter_by(id=job_id).with_for_update().populate_existing().one()
    if (
        job.generation != generation
        or not job.lease_hash
        or not hmac.compare_digest(job.lease_hash, digest(token))
    ):
        error("STALE_LEASE", "This job capability is no longer current", 409)
    event = db.get(Inbox, job.event_id)
    identity = db.get(Identity, event.identity_id)
    if not identity or identity.revoked_at or identity.owner_id != job.owner_id:
        error("IDENTITY_REVOKED", "The source identity has been disconnected", 409)
    if allow_done and job.state == "done":
        return job, event, identity
    if job.state != "leased" or not job.lease_until or job.lease_until <= utcnow():
        error("STALE_LEASE", "The job lease expired or is no longer running", 409)
    return job, event, identity


def complete(db, job_id, token, generation, result):
    job, event, identity = fenced_job(db, job_id, token, generation, allow_done=True)
    request_hash = canonical_hash(result)
    if job.state == "done":
        if request_hash != job.result_hash:
            error("IDEMPOTENCY_CONFLICT", "The completed job result cannot change", 409)
        return job.result
    if job.kind not in {"text", "extract"}:
        error(
            "INVALID_JOB_SCOPE", "Only the hosted capture worker can capture media", 403
        )
    if job.kind == "text":
        if result != {}:
            error(
                "INVALID_JOB_SCOPE",
                "Text jobs parse their trusted source and accept no override fields",
                403,
            )
        payload = parse_text(event.payload["text"])
    else:
        evidence = (
            db.query(Evidence)
            .filter_by(event_id=event.id, owner_id=job.owner_id)
            .with_for_update()
            .one()
        )
        # No arbitrary owner, action capability or trusted economic reference can
        # enter through model output. Missing fields remain visible for review.
        allowed = {
            "type",
            "amount_minor",
            "currency",
            "occurred_on",
            "occurred_at",
            "date_precision",
            "source_account_id",
            "target_account_id",
            "original_expense_entry_id",
            "category",
            "description",
            "trip_id",
            "tags",
            "fee_minor",
        }
        if not isinstance(result, dict) or not set(result).issubset(allowed):
            error("INVALID_EXTRACTION", "The extractor returned unsupported fields")
        payload = dict(result)
        evidence.extraction = {
            "source": "scoped_extraction_job",
            "version": "1",
            "fields": dict(result),
        }
        evidence.state = "extracted"
        payload["evidence_ids"] = [evidence.id]
        payload["provenance"] = {
            "source": "image_extraction",
            "job_id": job.id,
            "generation": job.generation,
            "fields": {k: "extractor_suggestion" for k in result},
        }
    # This lease check and owner lock precede EVERY draft/evidence write. No
    # public job endpoint can patch an existing human-edited draft.
    draft = ledger.create_draft(db, job.owner_id, payload)
    preview(db, identity, draft["id"])
    job.result = {"draft_id": draft["id"], "version": draft["version"]}
    job.result_hash, job.state, event.state = request_hash, "done", "processed"
    return job.result


def fail(db, job_id, token, generation, *, retryable=True, code="EXTRACTION_FAILED"):
    job, event, identity = fenced_job(db, job_id, token, generation)
    safe_codes = {
        "EXTRACTION_FAILED",
        "CAPTURE_FAILED",
        "INVALID_MEDIA",
        "PROVIDER_UNAVAILABLE",
        "INVALID_TEXT",
    }
    code = code if code in safe_codes else "EXTRACTION_FAILED"
    job.safe_code = code
    if retryable and job.attempts < MAX_ATTEMPTS:
        job.state = "queued"
        job.available_at = utcnow() + timedelta(seconds=min(3600, 5 * 2**job.attempts))
    else:
        job.state, event.state, event.safe_code = "failed", "needs_review", code
        queue_message(
            db,
            identity,
            "failed:" + job.id,
            "processing_failed",
            "This entry could not be prepared. Nothing recorded. Review Aegis or re-upload the image. Code: "
            + code,
        )
    return {"state": job.state, "code": code}


def capture_bytes(db, job_id, token, generation, content, declared_mime):
    job, event, identity = fenced_job(db, job_id, token, generation, allow_done=True)
    if job.kind != "capture":
        error("INVALID_JOB_SCOPE", "This job cannot capture evidence", 403)
    if job.state == "done":
        return job.result
    mime = (
        "image/png"
        if content.startswith(b"\x89PNG\r\n\x1a\n")
        else "image/jpeg"
        if content.startswith(b"\xff\xd8\xff")
        else "image/webp"
        if content[:4] == b"RIFF" and content[8:12] == b"WEBP"
        else None
    )
    if not content or len(content) > MAX_IMAGE_BYTES or mime != declared_mime:
        error("INVALID_MEDIA", "Use one PNG, JPEG or WebP image up to 10 MiB")
    try:
        with Image.open(io.BytesIO(content)) as image:
            if (
                image.width * image.height > 32_000_000
                or Image.MIME.get(image.format) != mime
            ):
                error(
                    "INVALID_MEDIA",
                    "Receipt image dimensions or format are unsupported",
                )
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        error("INVALID_MEDIA", "The uploaded image could not be validated")
    root = Path(get_settings().finance_integration_evidence_dir)
    if not root.is_absolute() or root.is_symlink():
        error(
            "STORAGE_NOT_CONFIGURED",
            "A private absolute evidence directory is required",
            503,
        )
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(root, 0o700)
    evidence_id = str(uuid.uuid5(uuid.NAMESPACE_URL, "evidence:" + event.id))
    path = root / (evidence_id + ".bin")
    sha = hashlib.sha256(content).hexdigest()
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError:
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != sha:
            error(
                "STORAGE_CONFLICT", "Existing evidence does not match this capture", 409
            )
    else:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    evidence = Evidence(
        id=evidence_id,
        event_id=event.id,
        owner_id=job.owner_id,
        storage_key=path.name,
        sha256=sha,
        size=len(content),
        mime=mime,
    )
    db.add(evidence)
    db.add(
        Job(
            id=str(uuid.uuid4()),
            event_id=event.id,
            owner_id=job.owner_id,
            kind="extract",
        )
    )
    job.state, job.result = "done", {"evidence_id": evidence_id}
    return job.result


def leased_evidence(db, job_id, token, generation, evidence_id):
    job, event, _ = fenced_job(db, job_id, token, generation)
    if job.kind != "extract":
        error(
            "INVALID_JOB_SCOPE", "Only an extraction lease can read this evidence", 403
        )
    evidence = (
        db.query(Evidence)
        .filter_by(id=evidence_id, event_id=event.id, owner_id=job.owner_id)
        .first()
    )
    if not evidence:
        error("EVIDENCE_NOT_FOUND", "Evidence not found", 404)
    return evidence


def evidence_path(evidence):
    root = Path(get_settings().finance_integration_evidence_dir)
    if not root.is_absolute() or not re.fullmatch(
        r"[a-f0-9-]{36}\.bin", evidence.storage_key
    ):
        error("EVIDENCE_UNAVAILABLE", "Evidence is unavailable", 404)
    path = root / evidence.storage_key
    if not path.is_file() or path.is_symlink():
        error("EVIDENCE_UNAVAILABLE", "Evidence is unavailable", 404)
    if (
        path.stat().st_size != evidence.size
        or hashlib.sha256(path.read_bytes()).hexdigest() != evidence.sha256
    ):
        error("EVIDENCE_INTEGRITY", "Evidence integrity verification failed", 409)
    return path


def correction_lineage(db, owner, journal_id):
    if not journal_id:
        return set()
    if not db.query(JournalEntry.id).filter_by(owner_id=owner, id=journal_id).first():
        error(
            "ENTRY_NOT_FOUND",
            "The correction lineage belongs to another owner or is unavailable",
            404,
        )
    ids, groups = {journal_id}, set()
    while True:
        related = (
            db.query(JournalEntry)
            .filter(
                JournalEntry.owner_id == owner,
                or_(
                    JournalEntry.id.in_(ids),
                    JournalEntry.reversal_of.in_(ids),
                    JournalEntry.correction_group.in_(groups),
                ),
            )
            .all()
        )
        new_ids = (
            ids
            | {r.id for r in related}
            | {r.reversal_of for r in related if r.reversal_of}
        )
        new_groups = groups | {
            r.correction_group for r in related if r.correction_group
        }
        if new_ids == ids and new_groups == groups:
            return ids
        ids, groups = new_ids, new_groups


def validate_evidence_for_posting(db, owner, payload, lineage_journal_id=None):
    ids = payload.get("evidence_ids", [])
    if not isinstance(ids, list) or len(ids) > 20 or len(ids) != len(set(ids)):
        error("INVALID_EVIDENCE", "Use a unique list of at most twenty evidence IDs")
    lineage = correction_lineage(db, owner, lineage_journal_id)
    for evidence_id in ids:
        evidence = (
            db.query(Evidence)
            .filter_by(id=evidence_id, owner_id=owner)
            .with_for_update()
            .first()
        )
        if not evidence or evidence.state not in {"captured", "extracted"}:
            error(
                "INVALID_EVIDENCE",
                "Evidence is missing, unavailable or belongs to another owner",
                404,
            )
        evidence_path(evidence)
        candidates = (
            db.query(EntryEvidence.journal_id)
            .join(Evidence, Evidence.id == EntryEvidence.evidence_id)
            .filter(EntryEvidence.owner_id == owner, Evidence.sha256 == evidence.sha256)
            .all()
        )
        unrelated = {journal_id for (journal_id,) in candidates} - lineage
        if unrelated and payload.get("duplicate_resolution") not in {
            "distinct",
            "attach",
        }:
            error(
                "REPEATED_EVIDENCE",
                "This image already supports a journal. Attach it or explicitly review a distinct payment",
                409,
            )


def attach_evidence_to_entry(db, owner, payload, journal_id, lineage_journal_id=None):
    # Call within the financial transaction. This is an association only and
    # deliberately has no posting, projection or balance-writing authority.
    ledger.lock_owner(db, owner)
    if not db.query(JournalEntry.id).filter_by(id=journal_id, owner_id=owner).first():
        error(
            "ENTRY_NOT_FOUND", "The target journal does not belong to this owner", 404
        )
    validate_evidence_for_posting(
        db, owner, payload, lineage_journal_id=lineage_journal_id
    )
    for evidence_id in payload.get("evidence_ids", []):
        if not db.get(EntryEvidence, (evidence_id, journal_id)):
            db.add(
                EntryEvidence(
                    owner_id=owner, evidence_id=evidence_id, journal_id=journal_id
                )
            )
    db.flush()


def claim_delivery(db):
    """Reserve budget and a frozen outbound body. Commit before network I/O.

    Every claim spends one conservative daily API-attempt slot, including a
    crash before send or a retry. This is an operational cap, not a billing or
    handset-delivery claim. The caller cannot supply a recipient or message.
    """
    settings = enabled(db)
    if (
        not settings.finance_integration_delivery_enabled
        or not settings.line_finance_access_token
    ):
        error(
            "DELIVERY_DISABLED", "Real LINE delivery requires separate activation", 503
        )
    now = utcnow()
    bangkok = now.replace(tzinfo=ZoneInfo("UTC")).astimezone(ZoneInfo("Asia/Bangkok"))
    day = bangkok.date().isoformat()
    key = (settings.line_finance_channel_id, day)
    budget = db.get(DeliveryBudget, key)
    if not budget:
        try:
            with db.begin_nested():
                db.add(DeliveryBudget(channel_id=key[0], day=key[1], attempts=0))
                db.flush()
        except IntegrityError:
            pass
    budget = (
        db.query(DeliveryBudget)
        .filter_by(channel_id=key[0], day=key[1])
        .with_for_update()
        .populate_existing()
        .one()
    )
    if budget.attempts >= max(0, settings.finance_integration_daily_push_budget):
        return None
    # Expired leases are reclaimable. Their frozen recipient/body and retry key
    # do not change even if the previous request outcome was ambiguous.
    rows = (
        db.query(Outbox)
        .join(Identity, Identity.id == Outbox.identity_id)
        .filter(
            Identity.channel_id == settings.line_finance_channel_id,
            Outbox.next_at <= now,
            or_(
                Outbox.state == "pending",
                (Outbox.state == "leased") & (Outbox.lease_until <= now),
            ),
        )
        .order_by(Outbox.created_at)
        .with_for_update(of=Outbox, skip_locked=True)
        .limit(25)
        .all()
    )
    for row in rows:
        identity = db.get(Identity, row.identity_id)
        if not identity or identity.revoked_at or identity.owner_id != row.owner_id:
            row.state, row.payload = "cancelled", {}
            continue
        if identity.channel_id != settings.line_finance_channel_id:
            continue
        if now - row.created_at >= timedelta(hours=23):
            row.state, row.safe_code = "needs_review", "RETRY_WINDOW_EXPIRED"
            continue
        token = secrets.token_urlsafe(32)
        row.state, row.generation = "leased", row.generation + 1
        row.lease_hash, row.lease_until = (
            digest(token),
            now + timedelta(seconds=LEASE_SECONDS),
        )
        row.attempts += 1
        budget.attempts += 1
        return {
            "id": row.id,
            "generation": row.generation,
            "lease_token": token,
            "lease_until": row.lease_until.isoformat() + "Z",
            "retry_key": row.id,
            "payload": dict(row.payload),
        }
    return None


def finish_delivery(
    db, delivery_id, token, generation, *, provider_status=None, provider_ack=None
):
    enabled(db)
    row = db.query(Outbox).filter_by(id=delivery_id).with_for_update().first()
    if (
        not row
        or row.generation != generation
        or not row.lease_hash
        or not hmac.compare_digest(row.lease_hash, digest(token))
    ):
        error("STALE_LEASE", "This delivery capability is no longer current", 409)
    if row.state in {"provider_accepted", "needs_review"}:
        return {"state": row.state}
    if row.state != "leased" or not row.lease_until or row.lease_until <= utcnow():
        error("STALE_LEASE", "This delivery lease expired or was cancelled", 409)
    identity = db.get(Identity, row.identity_id)
    if not identity or identity.revoked_at:
        error("IDENTITY_REVOKED", "The recipient was disconnected", 409)
    if provider_status == 200 or (provider_status == 409 and provider_ack):
        row.state, row.payload = "provider_accepted", {}
        row.provider_ack = (provider_ack or "")[:128]
    elif (
        provider_status is not None
        and 400 <= provider_status < 500
        and provider_status != 429
    ):
        row.state, row.safe_code = "needs_review", "PROVIDER_REJECTED"
    else:
        row.state, row.safe_code = "pending", "PROVIDER_UNCERTAIN"
        row.next_at = utcnow() + timedelta(
            seconds=min(3600, 5 * 2 ** min(row.attempts, 10))
        )
    return {"state": row.state}
