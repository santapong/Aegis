"""M2 review adapters. Every financial write stays inside the shared boundary."""

import csv
import hashlib
import io
import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from fastapi import HTTPException
from pydantic import ValidationError
from ...models.cashflow import (
    CashImportBatch,
    CashImportRow,
    CashCommitment,
    CashOccurrence,
    CashSettlement,
    CashGoalAllocation,
    CashInstallmentSchedule,
    CashTransfer,
    CashAlertScope,
    CashAlert,
)
from ...models.transaction import Transaction
from ...models.savings_goal import SavingsGoal
from ...models.debt import Debt
from ...schemas.cashflow import MovementCreate
from . import (
    account,
    owned,
    serial,
    money,
    digest,
    add_movement,
    add_settlement,
    forecast,
    base_revision,
)


def local_today(w):
    from . import local_today as reviewed_today

    return reviewed_today(w)


def upload_batch(db, w, body):
    account(db, w, body.account_id)
    if body.confirmed_currency != w.currency:
        raise HTTPException(
            422, "Confirm the workspace currency; CSV import never converts money"
        )
    content = body.content.removeprefix("\ufeff")
    if len(content.encode("utf-8")) > 262144 or "\x00" in content:
        raise HTTPException(
            422, "Use a UTF-8 CSV without NUL characters, at most 256 KiB"
        )
    reader = csv.DictReader(io.StringIO(content, newline=""), strict=True)
    try:
        headers = [x.strip().lower() for x in (reader.fieldnames or [])]
        required = {"date", "description", "amount", "type", "currency"}
        if (
            len(headers) != len(set(headers))
            or not required <= set(headers)
            or set(headers) - required - {"reference", "category"}
        ):
            raise HTTPException(
                422,
                "CSV columns: date,description,amount,type,currency; optional reference,category. Header names must be distinct.",
            )
        reader.fieldnames = headers
        parsed = []
        for number, raw in enumerate(reader, 2):
            if len(parsed) >= 500:
                raise HTTPException(422, "Review at most 500 CSV rows per batch")
            errors = []
            values = {k: (v or "").strip() for k, v in raw.items() if k is not None}
            if None in raw or any(v is None for v in raw.values()):
                errors.append("This row has too many or too few columns")
            if values.get("currency", "").upper() != w.currency:
                errors.append(
                    "Row currency differs from the confirmed workspace currency"
                )
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", values.get("date", "")):
                errors.append("Date must use YYYY-MM-DD")
            if not re.fullmatch(
                r"[0-9]{1,10}(\.[0-9]{1,2})?", values.get("amount", "")
            ):
                errors.append(
                    "Amount must be positive decimal money with at most two decimal places"
                )
            if len(values.get("reference", "")) > 120:
                errors.append("Reference is limited to 120 characters")
            payload = None
            try:
                movement = MovementCreate(
                    revision=0,
                    request_key="csv-validation",
                    account_id=body.account_id,
                    date=values.get("date", ""),
                    amount=values.get("amount", ""),
                    title=values.get("description", ""),
                    direction=values.get("type", "").lower(),
                    category=values.get("category") or "Other",
                )
                if movement.date > local_today(w):
                    errors.append(
                        "Future money must be a commitment, not a recorded movement"
                    )
                payload = movement.model_dump(
                    mode="json", exclude={"revision", "request_key", "occurrence_id"}
                )
                payload["amount"] = money(movement.amount)
                payload["currency"] = w.currency
                payload["reference"] = values.get("reference", "")
            except ValidationError as exc:
                errors.extend(
                    f"{'.'.join(str(x) for x in e['loc'])}: {e['msg']}"
                    for e in exc.errors(include_input=False)
                )
            parsed.append((number, values, payload, list(dict.fromkeys(errors))))
    except csv.Error:
        raise HTTPException(422, "Malformed CSV quoting; no batch or cash was saved")
    if not parsed:
        raise HTTPException(422, "The CSV has no data rows")
    batch = CashImportBatch(
        workspace_id=w.id,
        account_id=body.account_id,
        currency=w.currency,
        filename=body.filename,
        content_hash=hashlib.sha256(body.content.encode("utf-8")).hexdigest(),
    )
    db.add(batch)
    db.flush()
    for number, raw, payload, errors in parsed:
        db.add(
            CashImportRow(
                workspace_id=w.id,
                batch_id=batch.id,
                row_number=number,
                raw=raw,
                payload=payload,
                errors=errors,
                status="invalid" if errors else "pending",
            )
        )
    db.flush()
    return {
        **serial(batch),
        "row_count": len(parsed),
        "invalid_count": sum(bool(x[3]) for x in parsed),
        "cash_effect": "0.00",
    }


def signature(payload):
    return (
        payload["date"],
        payload["amount"],
        payload["direction"],
        payload["title"].strip().casefold(),
    )


def review_batch(db, w, bid):
    batch = owned(db, CashImportBatch, w, bid)
    rows = (
        db.query(CashImportRow)
        .filter_by(batch_id=bid)
        .order_by(CashImportRow.row_number)
        .all()
    )
    records = (
        db.query(Transaction)
        .filter_by(workspace_id=w.id, account_id=batch.account_id)
        .all()
    )
    other_rows = (
        db.query(CashImportRow)
        .join(CashImportBatch, CashImportRow.batch_id == CashImportBatch.id)
        .filter(
            CashImportBatch.workspace_id == w.id,
            CashImportBatch.account_id == batch.account_id,
            CashImportRow.transaction_id.isnot(None),
        )
        .all()
    )
    occurrences = (
        db.query(CashOccurrence)
        .filter_by(workspace_id=w.id, account_id=batch.account_id, cancelled=False)
        .all()
    )
    settlements = (
        db.query(CashSettlement).filter_by(workspace_id=w.id, reversed=False).all()
    )
    output = []
    for row in rows:
        duplicates, matches = [], []
        p = row.payload
        if p and not row.errors and row.status == "pending":
            sig = signature(p)
            for t in records:
                candidate = (
                    t.date.isoformat(),
                    money(t.amount),
                    t.type.value,
                    (t.description or t.category).strip().casefold(),
                )
                if sig == candidate:
                    duplicates.append(
                        {
                            "id": t.id,
                            "kind": "record",
                            "date": t.date.isoformat(),
                            "title": t.description or t.category,
                            "amount": money(t.amount),
                        }
                    )
            for other in rows:
                if (
                    other.id != row.id
                    and not other.errors
                    and other.payload
                    and signature(other.payload) == sig
                ):
                    duplicates.append(
                        {
                            "id": other.id,
                            "kind": "same_batch_row",
                            "row_number": other.row_number,
                        }
                    )
            if p.get("reference"):
                for other in other_rows:
                    if (
                        other.payload
                        and other.payload.get("reference") == p["reference"]
                    ):
                        duplicates.append(
                            {
                                "id": other.transaction_id,
                                "kind": "same_reference",
                                "reference": p["reference"],
                            }
                        )
            for o in occurrences:
                remaining = o.amount - sum(
                    (s.amount for s in settlements if s.occurrence_id == o.id),
                    Decimal(0),
                )
                if (
                    remaining > 0
                    and o.direction == p["direction"]
                    and abs((o.expected_date - date.fromisoformat(p["date"])).days)
                    <= 14
                ):
                    matches.append(
                        {
                            "id": o.id,
                            "title": o.title,
                            "expected_date": o.expected_date.isoformat(),
                            "remaining": money(remaining),
                            "suggested_amount": money(
                                min(remaining, Decimal(p["amount"]))
                            ),
                        }
                    )
            matches.sort(
                key=lambda x: (
                    abs(
                        (
                            date.fromisoformat(x["expected_date"])
                            - date.fromisoformat(p["date"])
                        ).days
                    ),
                    x["id"],
                )
            )
        output.append(
            {
                **serial(row),
                "possible_duplicates": duplicates[:20],
                "candidate_matches": matches[:8],
            }
        )
    return {
        "batch": serial(batch),
        "rows": output,
        "revision": w.revision,
        "message": "Possible duplicates and matches are review signals. Unchecked rows are not posted.",
    }


def confirm_batch(db, w, bid, body):
    owned(db, CashImportBatch, w, bid)
    selected = [x.row_id for x in body.rows]
    if len(selected) != len(set(selected)):
        raise HTTPException(422, "Select each batch row only once")
    review = review_batch(db, w, bid)
    by_id = {r["id"]: r for r in review["rows"]}
    posted, matched = [], []
    for choice in body.rows:
        data = by_id.get(choice.row_id)
        if not data:
            raise HTTPException(404, "Row not found in this reviewed batch")
        if data["status"] != "pending" or data["errors"]:
            raise HTTPException(
                409, "A row is invalid or already posted; no selected rows were saved"
            )
        if data["possible_duplicates"] and choice.decision != "keep_distinct":
            raise HTTPException(
                409,
                "Review possible duplicates and explicitly choose Keep as a separate record",
            )
        if bool(choice.occurrence_id) != bool(choice.match_amount):
            raise HTTPException(
                422, "Choose both a match target and the reviewed allocation amount"
            )
        p = data["payload"]
        movement = MovementCreate(
            revision=body.revision,
            request_key=body.request_key,
            **{
                k: p[k]
                for k in [
                    "account_id",
                    "title",
                    "amount",
                    "direction",
                    "date",
                    "category",
                ]
            },
        )
        t = add_movement(db, w, movement)
        if choice.occurrence_id:
            s = add_settlement(db, w, t.id, choice.occurrence_id, choice.match_amount)
            matched.append(s.id)
        row = owned(db, CashImportRow, w, choice.row_id)
        row.status, row.transaction_id = "imported", t.id
        posted.append(t.id)
    return {
        "batch_id": bid,
        "imported_transaction_ids": posted,
        "settlement_ids": matched,
        "imported_count": len(posted),
    }


def goal_allocation(db, w, body):
    account(db, w, body.account_id)
    if body.confirmed_currency != w.currency:
        raise HTTPException(
            422,
            "Confirm the currency; legacy goal values have no verified account currency",
        )
    if (
        body.goal_id
        and not db.query(SavingsGoal)
        .filter_by(id=body.goal_id, user_id=w.user_id)
        .first()
    ):
        raise HTTPException(404, "Goal not found for this owner")
    if body.mode == "transferred":
        t = db.query(CashTransfer).filter_by(id=body.transfer_id).first()
        if not t or body.account_id not in {t.from_account_id, t.to_account_id}:
            raise HTTPException(
                404, "Choose an existing transfer involving this cash account"
            )
        if t.date > local_today(w) or t.amount != body.amount:
            raise HTTPException(
                422, "Use the exact amount of a transfer already recorded"
            )
        if db.query(CashGoalAllocation).filter_by(transfer_id=t.id).first():
            raise HTTPException(
                409,
                "This transfer already has a goal allocation; review the existing link",
            )
    elif body.transfer_id:
        raise HTTPException(422, "A reservation cannot also link a transfer")
    row = CashGoalAllocation(
        workspace_id=w.id,
        **body.model_dump(exclude={"revision", "request_key", "confirmed_currency"}),
    )
    db.add(row)
    db.flush()
    return row


def entered_installments(db, w, body):
    account(db, w, body.account_id)
    if body.confirmed_currency != w.currency:
        raise HTTPException(
            422, "Confirm the entered installment currency; no conversion is performed"
        )
    if (
        body.debt_id
        and not db.query(Debt).filter_by(id=body.debt_id, user_id=w.user_id).first()
    ):
        raise HTTPException(404, "Debt not found for this owner")
    key = f"debt:{body.debt_id}" if body.debt_id else None
    if key and db.query(CashCommitment).filter_by(source_key=key).first():
        raise HTTPException(409, "This debt already has an entered cash schedule")
    total = sum((x.amount for x in body.entries), Decimal(0))
    if total > Decimal("9999999999.99"):
        raise HTTPException(
            422, "Entered schedule total exceeds the supported money range"
        )
    c = CashCommitment(
        workspace_id=w.id,
        account_id=body.account_id,
        title=body.name,
        direction="expense",
        amount=total,
        start_date=min(x.date for x in body.entries),
        end_date=max(x.date for x in body.entries),
        generated_through=max(x.date for x in body.entries),
        recurrence="installments",
        interval_every=1,
        weekend_rule="strict",
        source_key=key,
    )
    db.add(c)
    db.flush()
    for slot, entry in enumerate(body.entries, 1):
        db.add(
            CashOccurrence(
                id=str(uuid.uuid5(uuid.UUID(c.id), f"installment:{slot}")),
                workspace_id=w.id,
                commitment_id=c.id,
                account_id=body.account_id,
                title=f"{body.name} · installment {slot}",
                direction="expense",
                amount=entry.amount,
                nominal_date=entry.date,
                schedule_slot=slot,
                expected_date=entry.date,
                due_date=entry.date,
            )
        )
    schedule = CashInstallmentSchedule(
        workspace_id=w.id, commitment_id=c.id, debt_id=body.debt_id, name=body.name
    )
    db.add(schedule)
    db.flush()
    return {
        **serial(schedule),
        "entered_total": money(total),
        "entry_count": len(body.entries),
        "message": "Only entered cash obligations were created. Debt principal and interest were not recalculated.",
    }


def scope_key(as_of, end, accounts):
    return digest({"as_of": str(as_of), "end": str(end), "accounts": sorted(accounts)})


def alert_conditions(result, currency, accounts):
    conditions = []
    for kind, field in [
        ("negative_cash", "first_negative_date"),
        ("below_buffer", "first_below_buffer_date"),
        ("reserved_gap", "first_reserved_gap_date"),
    ]:
        event_date = result[field]
        if event_date:
            day = next(d for d in result["days"] if d["date"] == event_date)
            sources = [o for o in result["planned"] if o["expected_date"] <= event_date]
            conditions.append(
                (
                    kind,
                    event_date,
                    {
                        "currency": currency,
                        "account_ids": accounts,
                        "cash": day["cash"],
                        "cash_today": result["cash_today"],
                        "buffer": result["buffer"],
                        "reserved_cash": result["reserved_cash"],
                        "sources": sources,
                        "warnings": result["warnings"],
                        "as_of": result["as_of"],
                        "end": result["end"],
                        "opening_balances": result["anchors"],
                        "reservations": result["reservations"],
                        "recorded_sources": result["actual_events"],
                        "assumption": result["limit"],
                    },
                )
            )
    if result["warnings"]:
        conditions.append(
            (
                "incomplete_inputs",
                None,
                {
                    "currency": currency,
                    "account_ids": accounts,
                    "warnings": result["warnings"],
                    "as_of": result["as_of"],
                    "end": result["end"],
                    "cash_known": result["cash_today"] is not None,
                },
            )
        )
    return conditions


def reconcile_alerts(db, w, review):
    f = forecast(db, w, review.as_of, review.end, review.account_ids)
    conditions = alert_conditions(f["base"], w.currency, f["account_ids"])
    fingerprint = digest(conditions)
    existing = db.query(CashAlert).filter_by(scope_id=review.id).all()
    active_keys = set()
    for kind, event_date, details in conditions:
        key = digest(
            {
                "scope": review.scope_key,
                "kind": kind,
                "date": str(event_date),
                "details": details,
            }
        )
        active_keys.add(key)
        old = next((a for a in existing if a.dedupe_key == key), None)
        if old:
            if old.resolved_at:
                old.resolved_at = None
                old.acknowledged = False
                old.detected_at = datetime.utcnow()
            old.base_revision = base_revision(db, w)
        else:
            db.add(
                CashAlert(
                    workspace_id=w.id,
                    scope_id=review.id,
                    dedupe_key=key,
                    kind=kind,
                    event_date=event_date,
                    base_revision=base_revision(db, w),
                    details=jsonable(details),
                )
            )
    for old in existing:
        if old.dedupe_key not in active_keys and not old.resolved_at:
            old.resolved_at = datetime.utcnow()
    review.input_hash = fingerprint
    review.base_revision = base_revision(db, w)
    review.evaluated_at = datetime.utcnow()
    db.flush()


def jsonable(value):
    # Exact strings and ISO dates only; no float arithmetic enters persistence.
    import json

    return json.loads(json.dumps(value, default=str))


def evaluate_alerts(db, w, body):
    f = forecast(db, w, body.as_of, body.end, body.account_ids)
    key = scope_key(body.as_of, body.end, f["account_ids"])
    review = (
        db.query(CashAlertScope).filter_by(workspace_id=w.id, scope_key=key).first()
    )
    if not review:
        review = CashAlertScope(
            workspace_id=w.id,
            scope_key=key,
            as_of=body.as_of,
            end=body.end,
            account_ids=f["account_ids"],
            input_hash="",
            base_revision=base_revision(db, w),
        )
        db.add(review)
        db.flush()
    reconcile_alerts(db, w, review)
    return {"scope_id": review.id, "scope_key": key, "cash_effect": "0.00"}


def reconcile_registered_alerts(db, w):
    # Bound work during financial writes. Older dated reviews retain their
    # history and refresh on revisit instead of blocking new date ranges.
    reviews = (
        db.query(CashAlertScope)
        .filter_by(workspace_id=w.id)
        .order_by(CashAlertScope.evaluated_at.desc(), CashAlertScope.id)
        .limit(20)
        .all()
    )
    for review in reviews:
        reconcile_alerts(db, w, review)


def alert_review(db, w, as_of, end, account_ids):
    f = forecast(db, w, as_of, end, account_ids)
    key = scope_key(as_of, end, f["account_ids"])
    review = (
        db.query(CashAlertScope).filter_by(workspace_id=w.id, scope_key=key).first()
    )
    current_hash = digest(alert_conditions(f["base"], w.currency, f["account_ids"]))
    if not review:
        return {
            "scope": None,
            "alerts": [],
            "current_base_revision": f["base_revision"],
            "input_fingerprint": current_hash,
            "needs_evaluation": True,
        }
    rows = (
        db.query(CashAlert)
        .filter_by(scope_id=review.id)
        .order_by(
            CashAlert.resolved_at.is_not(None),
            CashAlert.detected_at.desc(),
            CashAlert.id,
        )
        .limit(60)
        .all()
    )
    return {
        "scope": serial(review),
        "alerts": [serial(a) for a in rows],
        "current_base_revision": f["base_revision"],
        "input_fingerprint": current_hash,
        "needs_evaluation": current_hash != review.input_hash,
    }
