"""Business documents are linked plans; only recorded settlements affect cash."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException

from ...models.cashflow import (
    CashBusinessDocument,
    CashCommitment,
    CashDocumentAdjustment,
    CashForecastSnapshot,
    CashOccurrence,
    CashSettlement,
)
from ...schemas.cashflow import CommitmentCreate, MovementCreate
from . import (
    account,
    add_commitment,
    add_movement,
    add_settlement,
    base_revision,
    digest,
    forecast,
    owned,
    serial,
    state,
)
from .engine import ZERO, calculate, money
from .everyday import jsonable


def local_today(w):
    # Resolve the shared clock at use time, including isolated test overrides.
    from . import local_today as reviewed_today

    return reviewed_today(w)


def business_workspace(w):
    if w.kind != "business":
        raise HTTPException(409, "Business review requires a business workspace")


def document_occurrence(db, w, document):
    return (
        db.query(CashOccurrence)
        .filter_by(workspace_id=w.id, commitment_id=document.commitment_id)
        .one()
    )


def document_review(db, w, document, as_of):
    o = document_occurrence(db, w, document)
    from ...models.transaction import Transaction

    payments = (
        db.query(CashSettlement)
        .join(Transaction, Transaction.id == CashSettlement.transaction_id)
        .filter(
            CashSettlement.workspace_id == w.id,
            CashSettlement.occurrence_id == o.id,
            CashSettlement.reversed.is_(False),
            Transaction.date <= as_of,
        )
        .all()
    )
    adjustments = (
        db.query(CashDocumentAdjustment)
        .filter_by(workspace_id=w.id, document_id=document.id)
        .order_by(CashDocumentAdjustment.created_at, CashDocumentAdjustment.id)
        .all()
    )
    paid = sum((s.amount for s in payments), ZERO)
    remaining = max(ZERO, o.amount - paid)
    return {
        **serial(document),
        "account_id": o.account_id,
        "currency": w.currency,
        "occurrence_id": o.id,
        "direction": o.direction,
        "due_date": o.due_date.isoformat() if o.due_date else None,
        "expected_date": o.expected_date.isoformat(),
        "effective_amount": money(o.amount),
        "credited_amount": money(sum((a.amount for a in adjustments), ZERO)),
        "matched_amount": money(paid),
        "remaining_amount": money(remaining),
        "projected_remaining": money(ZERO if o.cancelled else remaining),
        "status": "cancelled"
        if o.cancelled
        else "open"
        if remaining
        else "settled"
        if paid
        else "credited",
        "overdue_days": max(0, (as_of - o.due_date).days)
        if o.due_date and remaining and not o.cancelled
        else 0,
        "needs_expected_date_review": bool(
            remaining and not o.cancelled and o.expected_date <= as_of
        ),
        "adjustments": [serial(a) for a in adjustments],
        "settlements": [serial(s) for s in payments],
        "as_of": as_of.isoformat(),
        "assumption": "Current reviewed credits and cancellation apply; payment aging uses the selected as-of date.",
    }


def create_document(db, w, body):
    business_workspace(w)
    account(db, w, body.account_id)
    if body.confirmed_currency != w.currency:
        raise HTTPException(422, "Confirm this workspace's document currency")
    ident = str(uuid.uuid4())
    direction = "income" if body.kind == "receivable" else "expense"
    if body.commitment_id:
        commitment = owned(db, CashCommitment, w, body.commitment_id)
        occurrences = (
            db.query(CashOccurrence)
            .filter_by(workspace_id=w.id, commitment_id=commitment.id)
            .all()
        )
        if (
            db.query(CashBusinessDocument)
            .filter_by(commitment_id=commitment.id)
            .first()
        ):
            raise HTTPException(409, "This plan already belongs to a business document")
        if (
            commitment.recurrence != "once"
            or commitment.cancelled
            or len(occurrences) != 1
        ):
            raise HTTPException(409, "Choose one active once-only plan for a document")
        o = occurrences[0]
        if (
            o.cancelled
            or o.account_id != body.account_id
            or o.direction != direction
            or o.amount != body.amount
            or o.expected_date != body.expected_date
        ):
            raise HTTPException(
                422,
                "Review the same account, direction, full amount and expected date as the existing plan",
            )
        o.due_date = body.due_date
        # Retain any legacy source link and the existing occurrence/settlement IDs.
    else:
        commitment = add_commitment(
            db,
            w,
            CommitmentCreate(
                revision=body.revision,
                request_key=body.request_key,
                account_id=body.account_id,
                title=f"{body.counterparty} · {body.reference}"[:255],
                direction=direction,
                amount=body.amount,
                start_date=body.expected_date,
                due_date=body.due_date,
            ),
        )
        commitment.source_key = "document:" + ident
    document = CashBusinessDocument(
        id=ident,
        workspace_id=w.id,
        commitment_id=commitment.id,
        kind=body.kind,
        counterparty=body.counterparty,
        reference=body.reference,
        original_amount=body.amount,
    )
    db.add(document)
    db.flush()
    return document_review(db, w, document, local_today(w))


def review_document(db, w, ident, body):
    business_workspace(w)
    d = owned(db, CashBusinessDocument, w, ident)
    o = document_occurrence(db, w, d)
    if o.cancelled:
        raise HTTPException(
            409,
            "A cancelled document retains its history; create a reviewed replacement",
        )
    for field in ("counterparty", "reference"):
        if getattr(body, field) is not None:
            setattr(d, field, getattr(body, field))
    for field in ("due_date", "expected_date"):
        if getattr(body, field) is not None:
            setattr(o, field, getattr(body, field))
    o.title = f"{d.counterparty} · {d.reference}"[:255]
    db.flush()
    return document_review(db, w, d, local_today(w))


def credit_document(db, w, ident, body):
    business_workspace(w)
    d = owned(db, CashBusinessDocument, w, ident)
    o = document_occurrence(db, w, d)
    paid = sum(
        (
            s.amount
            for s in db.query(CashSettlement).filter_by(
                workspace_id=w.id, occurrence_id=o.id, reversed=False
            )
        ),
        ZERO,
    )
    if o.cancelled or body.amount > o.amount - paid:
        raise HTTPException(
            409, "Credit cannot exceed the unpaid amount of an active document"
        )
    adjustment = CashDocumentAdjustment(
        workspace_id=w.id, document_id=d.id, amount=body.amount, reason=body.reason
    )
    db.add(adjustment)
    o.amount -= body.amount
    db.flush()
    return document_review(db, w, d, local_today(w))


def cancel_document(db, w, ident, body):
    business_workspace(w)
    d = owned(db, CashBusinessDocument, w, ident)
    o = document_occurrence(db, w, d)
    if o.cancelled:
        return {
            **document_review(db, w, d, local_today(w)),
            "cash_inputs_changed": False,
        }
    o.cancelled = True
    owned(db, CashCommitment, w, d.commitment_id).cancelled = True
    d.cancellation_reason = body.reason
    db.flush()
    return document_review(db, w, d, local_today(w))


def settle_document(db, w, ident, body):
    business_workspace(w)
    d = owned(db, CashBusinessDocument, w, ident)
    o = document_occurrence(db, w, d)
    account(db, w, o.account_id)
    if body.transaction_id:
        transaction_id = body.transaction_id
    else:
        transaction = add_movement(
            db,
            w,
            MovementCreate(
                revision=body.revision,
                request_key=body.request_key,
                account_id=o.account_id,
                amount=body.amount,
                direction=o.direction,
                date=body.date,
                title=body.title or f"Payment · {d.counterparty} · {d.reference}"[:255],
            ),
        )
        transaction_id = transaction.id
    s = add_settlement(db, w, transaction_id, o.id, body.amount)
    db.flush()
    return {
        "document": document_review(db, w, d, local_today(w)),
        "transaction_id": transaction_id,
        "settlement_id": s.id,
        "cash_effect": "0.00"
        if body.transaction_id
        else money(body.amount * (1 if o.direction == "income" else -1)),
    }


def weeks(db, w, as_of, account_ids=None):
    business_workspace(w)
    start = as_of - timedelta(days=(as_of.weekday() - w.week_start) % 7)
    end = start + timedelta(days=90)
    f = forecast(db, w, as_of, end, account_ids)
    result = []
    days = f["base"]["days"]
    for index in range(13):
        week_start = start + timedelta(days=7 * index)
        week_end = week_start + timedelta(days=6)
        rows = [d for d in days if week_start <= d["date"] <= week_end]
        low = min(rows, key=lambda d: Decimal(d["cash"])) if rows else None
        result.append(
            {
                "week_start": week_start,
                "week_end": week_end,
                "covered_from": max(as_of, week_start),
                "partial": as_of > week_start,
                "closing_cash": rows[-1]["cash"] if rows else None,
                "minimum": {"date": low["date"], "cash": low["cash"]} if low else None,
                "incoming": money(sum((Decimal(d["incoming"]) for d in rows), ZERO)),
                "outgoing": money(sum((Decimal(d["outgoing"]) for d in rows), ZERO)),
                "days": rows,
            }
        )
    return {**f, "week_start": w.week_start, "weeks": result}


def create_snapshot(db, w, body):
    business_workspace(w)
    f = forecast(db, w, body.as_of, body.end, body.account_ids)
    sources = state(db, w)
    payload = jsonable(
        {
            "forecast": f,
            "sources": sources,
            "week_start": w.week_start,
            "source_versions": {
                key: {r["id"]: digest(r) for r in rows}
                for key, rows in sources.items()
                if isinstance(rows, list)
            },
            "assumptions": [f["base"]["limit"], *f["base"]["warnings"]],
        }
    )
    row = CashForecastSnapshot(
        workspace_id=w.id,
        name=body.name,
        as_of=body.as_of,
        end=body.end,
        base_revision=base_revision(db, w),
        engine_version=f["base"]["engine_version"],
        account_ids=f["account_ids"],
        source_hash=digest(payload),
        payload=payload,
    )
    db.add(row)
    db.flush()
    return {k: v for k, v in serial(row).items() if k != "payload"}


def snapshot_detail(db, w, ident):
    business_workspace(w)
    row = owned(db, CashForecastSnapshot, w, ident)
    if digest(row.payload) != row.source_hash:
        raise HTTPException(
            409,
            "Saved forecast integrity needs review; its original sources cannot be verified",
        )
    return row


def calculate_sources(data, chosen, as_of, end, anchors=None):
    def dated(rows):
        return [
            {
                k: date.fromisoformat(v)
                if k in {"date", "nominal_date", "expected_date", "due_date"} and v
                else v
                for k, v in r.items()
            }
            for r in rows
        ]

    return calculate(
        as_of=as_of,
        end=end,
        accounts=[a for a in data["accounts"] if a["id"] in chosen],
        anchors=dated(anchors if anchors is not None else data["balance_anchors"]),
        movements=dated(data["movements"]),
        transfers=dated(data["transfers"]),
        occurrences=dated(data["occurrences"]),
        settlements=data["settlements"],
        allocations=data["goal_allocations"],
        buffer=data["workspace"]["buffer"],
    )


def cash_effects(data, anchors, through):
    movements, transfers = {}, {}
    for t in data["movements"]:
        a = anchors.get(t["account_id"])
        if a and a["date"] <= t["date"] <= through.isoformat():
            movements[t["id"]] = Decimal(t["amount"]) * (
                1 if t["direction"] == "income" else -1
            )
    for t in data["transfers"]:
        effect = ZERO
        if t["date"] <= through.isoformat():
            for field, sign in [("from_account_id", -1), ("to_account_id", 1)]:
                a = anchors.get(t[field])
                if a and a["date"] <= t["date"]:
                    effect += sign * Decimal(t["amount"])
        transfers[t["id"]] = effect
    return movements, transfers


def variance(db, w, ident, through):
    snapshot = snapshot_detail(db, w, ident)
    if not snapshot.as_of <= through <= min(snapshot.end, local_today(w)):
        raise HTTPException(
            422, "Reviewed date must be inside the saved period and on or before today"
        )
    frozen = snapshot.payload
    expected = next(
        (
            d
            for d in frozen["forecast"]["base"]["days"]
            if d["date"] == through.isoformat()
        ),
        None,
    )
    reviewed = forecast(db, w, through, snapshot.end, snapshot.account_ids)
    if reviewed["base"]["engine_version"] != snapshot.engine_version:
        raise HTTPException(
            409,
            "Engine versions differ; this saved forecast needs a compatible comparison",
        )
    current = state(db, w)
    old = frozen["sources"]
    counterfactual = calculate_sources(
        current,
        snapshot.account_ids,
        through,
        through,
        frozen["forecast"]["base"]["anchors"],
    )
    known = bool(
        expected
        and reviewed["base"]["cash_today"] is not None
        and counterfactual["cash_today"] is not None
    )
    categories = {
        key: ZERO
        for key in [
            "amount_change",
            "timing_or_unpaid",
            "new_sources",
            "unmatched_activity",
            "internal_transfers",
            "opening_balance_revision",
            "unclassified",
        ]
    }
    details = []
    difference = None
    if known:
        anchor_effect = Decimal(reviewed["base"]["cash_today"]) - Decimal(
            counterfactual["cash_today"]
        )
        categories["opening_balance_revision"] = anchor_effect
        anchors = {a["account_id"]: a for a in frozen["forecast"]["base"]["anchors"]}
        old_tx, old_transfers = cash_effects(old, anchors, snapshot.as_of)
        new_tx, new_transfers = cash_effects(current, anchors, through)
        deltas = {
            key: new_tx.get(key, ZERO) - old_tx.get(key, ZERO)
            for key in set(old_tx) | set(new_tx)
        }
        left = dict(deltas)
        old_occurrences = {o["id"]: o for o in old["occurrences"]}
        current_occurrences = {o["id"]: o for o in current["occurrences"]}
        matched = {}
        for s in current["settlements"]:
            if s["reversed"]:
                continue
            oid, tid = s["occurrence_id"], s["transaction_id"]
            o = current_occurrences.get(oid)
            delta = left.get(tid, ZERO)
            if not o or not delta:
                continue
            sign = 1 if o["direction"] == "income" else -1
            if delta * sign <= 0:
                continue
            effect = min(abs(delta), Decimal(s["amount"])) * sign
            matched[oid] = matched.get(oid, ZERO) + effect
            left[tid] -= effect
        for o in frozen["forecast"]["base"]["planned"]:
            current_o = current_occurrences.get(o["id"])
            if not current_o:
                continue  # Missing provenance remains in the residual.
            sign = 1 if o["direction"] == "income" else -1
            baseline_amount = Decimal(o["remaining"])
            prepaid = Decimal(old_occurrences[o["id"]]["amount"]) - baseline_amount
            effective = max(ZERO, Decimal(current_o["amount"]) - prepaid)
            if current_o["cancelled"]:
                effective = max(
                    ZERO,
                    sum(
                        (
                            Decimal(s["amount"])
                            for s in current["settlements"]
                            if s["occurrence_id"] == o["id"] and not s["reversed"]
                        ),
                        ZERO,
                    )
                    - prepaid,
                )
            paid_effect = matched.pop(o["id"], ZERO)
            expected_now = o["expected_date"] <= through.isoformat()
            amount_effect = (
                sign * (effective - baseline_amount) if expected_now else ZERO
            )
            timing_effect = (
                paid_effect - sign * effective if expected_now else paid_effect
            )
            categories["amount_change"] += amount_effect
            categories["timing_or_unpaid"] += timing_effect
            if amount_effect or timing_effect:
                details.append(
                    {
                        "source_id": o["id"],
                        "title": o["title"],
                        "saved_expected_date": o["expected_date"],
                        "reviewed_expected_date": current_o["expected_date"],
                        "saved_remaining": money(baseline_amount),
                        "reviewed_effective_amount": money(effective),
                        "matched_cash_change": money(paid_effect),
                        "amount_change": money(amount_effect),
                        "timing_or_unpaid": money(timing_effect),
                    }
                )
        for oid, effect in matched.items():
            bucket = (
                "new_sources" if oid not in old_occurrences else "unmatched_activity"
            )
            categories[bucket] += effect
            details.append(
                {
                    "source_id": oid,
                    "title": current_occurrences[oid]["title"],
                    "kind": bucket,
                    "cash_change": money(effect),
                }
            )
        categories["unmatched_activity"] += sum(left.values(), ZERO)
        categories["internal_transfers"] = sum(new_transfers.values(), ZERO) - sum(
            old_transfers.values(), ZERO
        )
        difference = Decimal(reviewed["base"]["cash_today"]) - Decimal(expected["cash"])
        categories["unclassified"] = difference - sum(categories.values(), ZERO)
    return {
        "snapshot_id": snapshot.id,
        "snapshot_name": snapshot.name,
        "source_hash": snapshot.source_hash,
        "as_of": snapshot.as_of,
        "end": snapshot.end,
        "reviewed_through": through,
        "account_ids": snapshot.account_ids,
        "currency": w.currency,
        "timezone": w.timezone,
        "week_start": frozen["week_start"],
        "known": known,
        "expected_cash": expected["cash"] if expected else None,
        "recorded_cash": reviewed["base"]["cash_today"],
        "difference": money(difference) if difference is not None else None,
        "components": {
            key: money(value) if known else None for key, value in categories.items()
        },
        "sources": details,
        "saved_anchors": frozen["forecast"]["base"]["anchors"],
        "reviewed_anchors": reviewed["base"]["anchors"],
        "saved_closing_cash": frozen["forecast"]["base"]["closing_cash"],
        "reviewed_closing_cash": reviewed["base"]["closing_cash"],
        "reviewed_forecast": reviewed,
        "warnings": reviewed["base"]["warnings"],
        "assumption": "Same saved account scope and end boundary. Amount and timing/unpaid attribution uses current reviewed source versions; it is not proof of customer behavior. Unmatched activity and incomplete provenance stay separate. Changed opening anchors are isolated from payments. Closing cash still includes unpaid future assumptions.",
    }
