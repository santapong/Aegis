"""Deterministic text MVP. Never creates a financial record without confirmation."""

import hashlib
import re
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.line_finance import LineFinanceCode, LineFinanceDraft, LineFinanceIdentity
from ..models.transaction import Transaction
from ..models.user import User
from ..config import get_settings
from ..schemas.cashflow import MovementCreate, Mutation
from . import cashflow
from .transaction_scope import claim_transaction

HELP = (
    "Send an expense or income, then confirm it. Examples: expense 65 coffee · "
    "income 35000 salary · จ่าย 65 กาแฟ · รับ 35000 เงินเดือน. "
    "Commands: confirm <id>, cancel <id>, undo <id>, month. THB only. "
    "For corrections, cancel a pending entry or undo an unmatched confirmed entry and send the corrected amount. "
    "Review optional payment matches in Aegis cash planning. Nothing sends or transfers money."
)


def parse_transaction(text: str, today: date | None = None) -> dict:
    today = today or datetime.now(ZoneInfo("Asia/Bangkok")).date()
    if re.search(
        r"transfer|โอน|USD|EUR|JPY|[$€¥]|every|recurr|ทุก|tomorrow|พรุ่งนี้",
        text,
        re.IGNORECASE,
    ):
        raise ValueError(
            "For now, use actual THB income or expenses; transfers and forecasts need separate handling."
        )
    dates = re.findall(r"\b\d{4}-\d{2}-\d{2}\b", text)
    if len(dates) > 1:
        raise ValueError("Please send one transaction with one date.")
    when = date.fromisoformat(dates[0]) if dates else today
    if when > today:
        raise ValueError(
            "Future payments are plans, not recorded payments. Please record this after payment."
        )
    stripped = text.replace(dates[0], "") if dates else text
    if re.search(r"yesterday|เมื่อวาน", stripped, re.IGNORECASE):
        if dates:
            raise ValueError("Please use only one date.")
        when = today - timedelta(days=1)
        stripped = re.sub(r"yesterday|เมื่อวาน", "", stripped, flags=re.IGNORECASE)
    stripped = re.sub(r"today|วันนี้", "", stripped, flags=re.IGNORECASE)
    amounts = re.findall(r"(?<![\w.])-?\d[\d,]*(?:\.\d+)?", stripped)
    if len(amounts) != 1:
        raise ValueError(
            "Please include exactly one amount, for example: expense 65 coffee."
        )
    if not re.fullmatch(r"(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?", amounts[0]):
        raise ValueError("Use a positive amount with at most two decimal places.")
    try:
        amount = Decimal(amounts[0].replace(",", ""))
    except InvalidOperation as exc:
        raise ValueError("Invalid amount.") from exc
    if amount <= 0 or amount >= Decimal(10000000000):
        raise ValueError("Amount is outside the supported range.")
    income = bool(
        re.search(
            r"\bincome\b|\bsalary\b|\breceived\b|รายรับ|เงินเดือน|^รับ",
            stripped,
            re.IGNORECASE,
        )
    )
    expense = bool(
        re.search(r"\bexpense\b|\bpaid\b|รายจ่าย|^จ่าย", stripped, re.IGNORECASE)
    )
    if income and expense:
        raise ValueError("Please specify income or expense, not both.")
    if not income and not expense:
        raise ValueError(
            "Start with expense/จ่าย or income/รับ so I do not guess the transaction type."
        )
    note = re.sub(
        r"^(expense|income|paid|received|รายรับ|รายจ่าย|จ่าย|รับ)\s*",
        "",
        stripped,
        flags=re.IGNORECASE,
    )
    note = note.replace(amounts[0], "").strip(" -")[:500]
    category = "Income" if income else "Other"
    for pattern, label in [
        (r"coffee|food|กาแฟ|อาหาร", "Food & Drink"),
        (r"taxi|fuel|รถ|น้ำมัน", "Transport"),
        (r"salary|เงินเดือน", "Salary"),
    ]:
        if re.search(pattern, note, re.IGNORECASE):
            category = label
            break
    return {
        "amount": format(amount, ".2f"),
        "type": "income" if income else "expense",
        "category": category,
        "date": when.isoformat(),
        "description": note,
        "currency": "THB",
    }


def destination(db, user_id, record):
    if not get_settings().cashflow_workspaces_enabled:
        raise HTTPException(503, "Cash workspace capture is awaiting rollout.")
    if not record.workspace_id or not record.account_id:
        raise HTTPException(
            409,
            "Reconnect LINE in Settings and explicitly choose a THB workspace and cash account.",
        )
    w = cashflow.workspace(db, user_id, record.workspace_id)
    account = cashflow.account(db, w, record.account_id)
    if w.currency != "THB":
        raise HTTPException(
            409, "Choose a THB cash destination; chat does not convert money."
        )
    return w, account


def lock_owner(db, user_id):
    # Serialize link/disconnect/capture without blocking foreign-key KEY SHARE
    # locks acquired by cash/audit inserts. FOR UPDATE here would invert the
    # workspace/transaction ordering and deadlock concurrent adoption.
    return db.query(User).filter_by(id=user_id).with_for_update(key_share=True).first()


def handle_message(db: Session, line_id: str, text: str, event_id: str) -> str:
    text = text.strip()
    identity = db.get(LineFinanceIdentity, line_id)
    if text.startswith("link "):
        digest = hashlib.sha256(text[5:].strip().encode()).hexdigest()
        code = db.get(LineFinanceCode, digest)
        if not code:
            return "Link code is invalid or expired. Generate a new one in Aegis Settings → LINE finance."
        # Owner → code → identity ordering also serializes disconnect and capture.
        user = lock_owner(db, code.user_id)
        code = (
            db.query(LineFinanceCode)
            .filter_by(digest=digest)
            .with_for_update()
            .populate_existing()
            .first()
        )
        if not code or code.expires_at < datetime.now(UTC).replace(tzinfo=None):
            return "Link code is invalid or expired. Generate a new one in Aegis Settings → LINE finance."
        if not user or not user.is_active:
            return "Account is unavailable."
        identity = db.get(LineFinanceIdentity, line_id, populate_existing=True)
        existing = db.query(LineFinanceIdentity).filter_by(user_id=user.id).first()
        if identity or existing:
            return "An account is already linked. Disconnect it in Aegis before linking again."
        try:
            w, account = destination(db, user.id, code)
        except HTTPException as error:
            return str(error.detail)
        db.add(
            LineFinanceIdentity(
                line_id=line_id,
                user_id=user.id,
                workspace_id=w.id,
                account_id=account.id,
                connection_id=str(uuid.uuid4()),
            )
        )
        db.delete(code)
        return f"Connected to {w.name} → {account.name} (THB). " + HELP
    if not identity:
        return "Connect your Aegis account first: Settings → LINE finance → choose a THB workspace and account → Generate link code."
    user = lock_owner(db, identity.user_id)
    identity = (
        db.query(LineFinanceIdentity)
        .filter_by(line_id=line_id)
        .with_for_update()
        .populate_existing()
        .first()
    )
    if not identity:
        return (
            "LINE was disconnected. Reconnect in Aegis before recording more entries."
        )
    if not user or not user.is_active:
        return "Account is unavailable."
    action = re.fullmatch(
        r"(confirm|cancel|undo)\s+([a-f0-9-]{36})", text, re.IGNORECASE
    )
    if action:
        kind, draft_id = action.groups()
        kind = kind.lower()
        d = (
            db.query(LineFinanceDraft)
            .filter_by(id=draft_id, user_id=user.id)
            .with_for_update()
            .first()
        )
        if not d:
            return "Entry not found."
        if kind == "cancel":
            if d.state not in {"pending", "needs-review"}:
                return f"Entry is {d.state}; use undo for a confirmed entry."
            d.state = "cancelled"
        elif kind == "undo":
            if d.state != "confirmed":
                return f"Entry is {d.state}; nothing to undo."
            query = db.query(Transaction).filter_by(
                id=d.transaction_id, user_id=user.id
            )
            if not d.data.get("workspace_id"):
                # Old chat records can be deleted only while unassigned. Claim
                # before reading, using the same boundary as workspace adoption.
                txn = claim_transaction(db, user.id, d.transaction_id, legacy_only=True)
                if txn is None:
                    txn = query.populate_existing().first()
            else:
                # Scoped reversals acquire the workspace first in mutate().
                txn = query.first()
            if txn and txn.workspace_id:
                if not d.data.get("workspace_id"):
                    return "This historical record is now in a cash workspace. Unmatch and reverse it in Aegis; chat undo has not changed it."
                if (
                    d.data.get("connection_id") != identity.connection_id
                    or txn.workspace_id != identity.workspace_id
                    or txn.account_id != identity.account_id
                ):
                    return "This entry belongs to a different reviewed destination. Review its correction in Aegis; nothing changed."
                try:
                    w, account = destination(db, user.id, identity)
                    body = Mutation(
                        revision=w.revision, request_key="line-undo:" + d.id
                    )
                    with db.begin_nested():
                        cashflow.mutate(
                            db,
                            user.id,
                            w.id,
                            "line_undo",
                            body,
                            lambda current: cashflow.reverse_movement(
                                db, current, txn.id
                            ),
                            resource_id=txn.id,
                            commit=False,
                        )
                except HTTPException as error:
                    return f"Undo needs review: {error.detail}. Nothing changed."
            elif txn:
                if d.data.get("workspace_id"):
                    return "This entry no longer matches its reviewed cash destination. Review it in Aegis; nothing changed."
                # Compatibility for historical captures, never used for new drafts.
                db.delete(txn)
            else:
                return "Recorded entry is unavailable. Review it in Aegis; nothing changed."
            d.state = "undone"
        else:
            if d.state != "pending":
                return f"Entry is already {d.state}."
            if (
                not d.data.get("workspace_id")
                or d.data.get("connection_id") != identity.connection_id
                or d.data.get("workspace_id") != identity.workspace_id
                or d.data.get("account_id") != identity.account_id
            ):
                d.state = "needs-review"
                return "The reviewed destination is missing or changed. Nothing recorded. Cancel this draft and send it again after reconnecting."
            try:
                w, account = destination(db, user.id, identity)
                body = MovementCreate(
                    revision=d.data["workspace_revision"],
                    request_key="line-confirm:" + d.id,
                    account_id=account.id,
                    direction=d.data["type"],
                    amount=d.data["amount"],
                    date=d.data["date"],
                    title=(d.data["description"] or d.data["category"])[:255],
                    category=d.data["category"],
                )
                with db.begin_nested():
                    result = cashflow.mutate(
                        db,
                        user.id,
                        w.id,
                        "line_confirm",
                        body,
                        lambda current: cashflow.add_movement(db, current, body),
                        commit=False,
                    )
            except (HTTPException, ValidationError, KeyError) as error:
                d.state = "needs-review"
                detail = (
                    error.detail
                    if isinstance(error, HTTPException)
                    else "The saved entry needs a new review"
                )
                return (
                    f"Nothing recorded: {detail}. Cancel this draft and send it again."
                )
            d.transaction_id = result["id"]
            d.state = "confirmed"
        d.updated_at = datetime.now(UTC).replace(tzinfo=None)
        suffix = (
            " Optional matching: Aegis → Cash planning → Review & match."
            if d.state == "confirmed"
            else ""
        )
        return (
            f"Entry {d.state}: {d.data['type']} {d.data['amount']} THB ({d.data['date']}). ID: {d.id}"
            + suffix
        )
    try:
        w, account = destination(db, user.id, identity)
        if not identity.connection_id:
            raise HTTPException(
                409,
                "Reconnect LINE and review its cash destination before recording more entries.",
            )
    except HTTPException as error:
        return str(error.detail)
    if text.lower() in {"month", "summary", "เดือนนี้"}:
        today = cashflow.local_today(w)
        rows = (
            db.query(Transaction.type, func.sum(Transaction.amount))
            .filter(
                Transaction.user_id == user.id,
                Transaction.workspace_id == w.id,
                Transaction.account_id == account.id,
                Transaction.currency == "THB",
                Transaction.date >= today.replace(day=1),
                Transaction.date <= today,
            )
            .group_by(Transaction.type)
            .all()
        )
        totals = {kind.value: Decimal(value) for kind, value in rows}
        incoming, outgoing = (
            totals.get("income", Decimal(0)),
            totals.get("expense", Decimal(0)),
        )
        return (
            f"{w.name} → {account.name}. Recorded this month: income {incoming:.2f}, expenses {outgoing:.2f}, "
            f"net {incoming - outgoing:.2f} THB, including corrections. This is activity, not a verified bank balance."
        )
    if text.lower() in {"help", "ช่วยเหลือ"}:
        return HELP
    try:
        data = parse_transaction(text, cashflow.local_today(w))
    except ValueError as error:
        return str(error)
    data.update(
        workspace_id=w.id,
        account_id=account.id,
        workspace_revision=w.revision,
        connection_id=identity.connection_id,
        workspace_name=w.name,
        account_name=account.name,
        timezone=w.timezone,
    )
    draft = LineFinanceDraft(
        id=str(uuid.uuid5(uuid.NAMESPACE_URL, event_id)), user_id=user.id, data=data
    )
    db.add(draft)
    return (
        f"Nothing recorded yet. Please confirm:\n{w.name} → {account.name}\n"
        f"{data['type']} {data['amount']} THB · {data['date']} · {data['category']}\n"
        f"{data['description']}\nconfirm {draft.id}\nOr: cancel {draft.id}"
    )
