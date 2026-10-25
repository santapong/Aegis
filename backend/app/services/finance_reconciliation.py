"""Retry-safe statement matching, independent from the financial writer."""

import hashlib
import json
import re
from datetime import date

from fastapi import HTTPException

from ..models.finance_reconciliation import StatementImport, StatementLine


def minor(value):
    if not isinstance(value, str) or not re.fullmatch(r"-?(?:0|[1-9][0-9]*)", value):
        raise HTTPException(422, "Minor amounts must be decimal integer strings")
    result = int(value)
    if not -(2**63) <= result < 2**63:
        raise HTTPException(422, "Amount exceeds signed 64-bit storage")
    return result


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def owned_account(db, owner_id, account_id):
    from ..models.finance_ledger import LedgerAccount

    account = db.query(LedgerAccount).filter_by(id=account_id, owner_id=owner_id).first()
    if account is None:
        raise HTTPException(404, "Account not found")
    if account.kind not in {"asset", "liability"} or account.currency != "THB":
        raise HTTPException(422, "Statements require a tracked THB asset or liability account")
    return account


def import_statement(db, owner_id, payload):
    from .money_ledger import lock_owner, _replay, _save

    lock_owner(db, owner_id)
    owned_account(db, owner_id, payload["account_id"])
    request_hash = digest(payload)
    content = {k: v for k, v in payload.items() if k != "request_key"}
    receipt = _replay(db, owner_id, "statement_import", payload["request_key"], content)
    if receipt:
        return review(db, owner_id, receipt["statement_id"])
    existing = db.query(StatementImport).filter_by(owner_id=owner_id, request_key=payload["request_key"]).first()
    if existing:
        if existing.request_hash != request_hash:
            raise HTTPException(409, "Statement request key reused with different inputs")
        _save(db, owner_id, "statement_import", payload["request_key"], content, {"statement_id": existing.id})
        return review(db, owner_id, existing.id)
    content_hash = digest(content)
    existing = db.query(StatementImport).filter_by(owner_id=owner_id, account_id=payload["account_id"], content_hash=content_hash).first()
    if existing:
        _save(db, owner_id, "statement_import", payload["request_key"], content, {"statement_id": existing.id})
        return review(db, owner_id, existing.id)
    start = date.fromisoformat(payload["period_start"])
    end = date.fromisoformat(payload["period_end"])
    if start > end:
        raise HTTPException(422, "Statement period is reversed")
    opening, closing = minor(payload["opening_balance_minor"]), minor(payload["closing_balance_minor"])
    if not payload["rows"] or len(payload["rows"]) > 1000:
        raise HTTPException(422, "Review 1–1000 statement rows at a time")
    normalized = []
    keys = set()
    for raw in payload["rows"]:
        key = raw["stable_key"]
        if key in keys:
            raise HTTPException(422, "Statement row identities must be distinct")
        keys.add(key)
        when = date.fromisoformat(raw["occurred_on"])
        amount = minor(raw["amount_minor"])
        if raw.get("status", "posted") not in {"posted", "pending"}:
            raise HTTPException(422, "Statement status must be posted or pending")
        if not start <= when <= end or amount == 0:
            raise HTTPException(422, "Statement rows need a nonzero amount within the period")
        normalized.append({"stable_key": key, "occurred_on": when, "amount_minor": amount,
                           "status": raw.get("status", "posted"), "reference": raw.get("reference", ""),
                           "description": raw.get("description", "")})
    batch = StatementImport(owner_id=owner_id, account_id=payload["account_id"], request_key=payload["request_key"],
                            request_hash=request_hash, content_hash=content_hash, period_start=start, period_end=end,
                            opening_balance_minor=opening, closing_balance_minor=closing)
    db.add(batch)
    db.flush()
    line_ids = []
    for values in normalized:
        old = db.query(StatementLine).filter_by(owner_id=owner_id, account_id=batch.account_id, stable_key=values["stable_key"]).first()
        if old:
            if any(getattr(old, key) != value for key, value in values.items()):
                raise HTTPException(409, "A statement row identity already exists with different facts; review the statement")
            line_ids.append(old.id)
            continue
        line = StatementLine(owner_id=owner_id, import_id=batch.id, account_id=batch.account_id, **values)
        db.add(line)
        db.flush()
        line_ids.append(line.id)
    batch.line_ids = line_ids
    db.flush()
    _save(db, owner_id, "statement_import", payload["request_key"], content, {"statement_id": batch.id})
    return review(db, owner_id, batch.id)


def candidates(db, owner_id, line):
    from ..models.finance_ledger import JournalEntry, Posting

    # Matching is a suggestion. Even one equal amount/date needs explicit review.
    already = [x[0] for x in db.query(StatementLine.matched_journal_id).filter(
        StatementLine.owner_id == owner_id, StatementLine.account_id == line.account_id,
        StatementLine.matched_journal_id.is_not(None), StatementLine.id != line.id)]
    query = db.query(JournalEntry.id).join(Posting, Posting.journal_id == JournalEntry.id).filter(
        JournalEntry.owner_id == owner_id, Posting.owner_id == owner_id, Posting.account_id == line.account_id,
        JournalEntry.occurred_on == line.occurred_on, Posting.amount_minor == line.amount_minor, JournalEntry.kind != "opening")
    if already:
        query = query.filter(JournalEntry.id.notin_(already))
    return [x[0] for x in query.distinct().order_by(JournalEntry.id)]


def review(db, owner_id, batch_id):
    from zoneinfo import ZoneInfo
    from ..models.finance_ledger import JournalEntry, Posting, LedgerOpening
    from .money_ledger import aware

    batch = db.query(StatementImport).filter_by(id=batch_id, owner_id=owner_id).first()
    if batch is None:
        raise HTTPException(404, "Statement import not found")
    owned_account(db, owner_id, batch.account_id)
    lines = db.query(StatementLine).filter(StatementLine.owner_id == owner_id, StatementLine.id.in_(batch.line_ids)).order_by(StatementLine.occurred_on, StatementLine.stable_key).all()
    tracked = sum(p[0] for p in db.query(Posting.amount_minor).join(JournalEntry, Posting.journal_id == JournalEntry.id).filter(
        Posting.owner_id == owner_id, Posting.account_id == batch.account_id, JournalEntry.owner_id == owner_id,
        JournalEntry.occurred_on <= batch.period_end))
    statement_delta = sum(line.amount_minor for line in lines if line.status == "posted")
    opening = db.query(LedgerOpening).filter_by(owner_id=owner_id, account_id=batch.account_id).first()
    opening_available = bool(opening and aware(opening.cutoff_at).astimezone(ZoneInfo("Asia/Bangkok")).date() <= batch.period_end)
    return {"id": batch.id, "account_id": batch.account_id, "currency": "THB", "period_start": str(batch.period_start), "period_end": str(batch.period_end),
            "opening_balance_minor": str(batch.opening_balance_minor), "closing_balance_minor": str(batch.closing_balance_minor),
            "statement_arithmetic_difference_minor": str(batch.closing_balance_minor - batch.opening_balance_minor - statement_delta),
            "tracked_closing_balance_minor": str(tracked) if opening_available else None,
            "difference_minor": str(batch.closing_balance_minor - tracked) if opening_available else None,
            "opening_available": opening_available,
            "reconciled": opening_available and batch.closing_balance_minor == tracked and batch.closing_balance_minor - batch.opening_balance_minor == statement_delta and all(line.matched_journal_id for line in lines if line.status == "posted"),
            "rows": [{"id": line.id, "stable_key": line.stable_key, "occurred_on": str(line.occurred_on), "amount_minor": str(line.amount_minor),
                      "status": line.status, "description": line.description, "reference": line.reference,
                      "matched_journal_id": line.matched_journal_id, "draft_id": line.draft_id, "candidate_journal_ids": candidates(db, owner_id, line) if line.status == "posted" and not line.matched_journal_id else []} for line in lines]}


def match(db, owner_id, batch_id, line_id, journal_id):
    from .money_ledger import lock_owner

    lock_owner(db, owner_id)
    batch = db.query(StatementImport).filter_by(id=batch_id, owner_id=owner_id).first()
    if batch is None or line_id not in batch.line_ids:
        raise HTTPException(404, "Statement row not found")
    line = db.query(StatementLine).filter_by(id=line_id, owner_id=owner_id).with_for_update().one()
    if line.status != "posted":
        raise HTTPException(409, "Pending authorizations cannot reconcile recorded money")
    if line.matched_journal_id:
        if line.matched_journal_id != journal_id:
            raise HTTPException(409, "Statement row already matched")
        return review(db, owner_id, batch_id)
    if journal_id not in candidates(db, owner_id, line):
        raise HTTPException(409, "Choose an unmatched journal with the same owner, account, occurrence date and signed amount")
    line.matched_journal_id = journal_id
    db.flush()
    return review(db, owner_id, batch_id)


def row_draft(db, owner_id, batch_id, line_id, body):
    from ..models.finance_ledger import LedgerDraft
    from .money_ledger import create_draft, draft_dict, lock_owner

    lock_owner(db, owner_id)
    batch = db.query(StatementImport).filter_by(id=batch_id, owner_id=owner_id).first()
    if batch is None or line_id not in batch.line_ids:
        raise HTTPException(404, "Statement row not found")
    line = db.query(StatementLine).filter_by(id=line_id, owner_id=owner_id).with_for_update().one()
    if line.status != "posted" or line.matched_journal_id:
        raise HTTPException(409, "Only an unmatched posted statement row can create a draft")
    if line.draft_id:
        return draft_dict(db, db.query(LedgerDraft).filter_by(id=line.draft_id, owner_id=owner_id).one())
    if candidates(db, owner_id, line) and body.get("keep_distinct") is not True:
        raise HTTPException(409, "Review known matching journals first, or explicitly keep a distinct economic transaction")
    kind = body["type"]
    incoming = line.amount_minor > 0
    if (kind in {"expense", "card_purchase"} and incoming) or (kind in {"income", "refund"} and not incoming):
        raise HTTPException(422, "Direction does not match this statement row")
    payload = {"type": kind, "amount_minor": str(abs(line.amount_minor)), "currency": "THB",
               "occurred_on": str(line.occurred_on), "description": line.description, "category": body.get("category", "uncategorized"),
               "provenance": {"statement_import_id": batch_id, "statement_line_id": line.id},
               "duplicate_resolution": "distinct" if body.get("keep_distinct") else None}
    if incoming:
        payload["target_account_id"] = line.account_id
    else:
        payload["source_account_id"] = line.account_id
    if kind in {"transfer", "card_repayment"}:
        other = body.get("counterparty_account_id")
        if not other:
            raise HTTPException(422, "Select the other reviewed account")
        owned_account(db, owner_id, other)
        payload["source_account_id" if incoming else "target_account_id"] = other
    if kind == "refund":
        payload["original_expense_entry_id"] = body.get("original_expense_entry_id")
    result = create_draft(db, owner_id, payload)
    line.draft_id = result["id"]
    db.flush()
    return result


def reconciliation_status(db, owner_id, account_id):
    """Latest independently matched zero-difference statement, rechecked now.

    This attests tracked records against the supplied statement as of its date.
    It never claims bank settlement or that later movements are reconciled.
    """
    owned_account(db, owner_id, account_id)
    for batch in db.query(StatementImport).filter_by(owner_id=owner_id, account_id=account_id).order_by(StatementImport.period_end.desc(), StatementImport.created_at.desc()):
        result = review(db, owner_id, batch.id)
        if result["reconciled"]:
            return {"as_of": result["period_end"], "statement_id": batch.id, "difference_minor": "0", "settlement_verified": False}
    return {"as_of": None, "statement_id": None, "difference_minor": None, "settlement_verified": False}
