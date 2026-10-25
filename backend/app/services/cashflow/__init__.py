"""Shared mutation boundary for the owner-only cash-planning release."""

import calendar
import hashlib
import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import update, or_, func
from sqlalchemy.exc import IntegrityError
from ...models.cashflow import (
    CashWorkspace,
    CashAccount,
    CashBalanceAnchor,
    CashCommitment,
    CashOccurrence,
    CashSettlement,
    CashTransfer,
    CashScenario,
    CashAudit,
    CashGoalAllocation,
    CashInstallmentSchedule,
    CashBusinessDocument,
    CashDocumentAdjustment,
)
from ...models.transaction import Transaction, TransactionType
from ...models.plan import Plan
from ...cache import invalidate_user_all
from .engine import calculate, money

MODELS = [
    CashAccount,
    CashBalanceAnchor,
    CashCommitment,
    CashOccurrence,
    CashSettlement,
    CashTransfer,
    CashScenario,
    CashGoalAllocation,
    CashInstallmentSchedule,
    CashBusinessDocument,
    CashDocumentAdjustment,
]

METADATA_OPERATIONS = [
    "create_scenario",
    "refresh_scenario",
    "create_import_batch",
    "evaluate_alerts",
    "acknowledge_alert",
    "create_forecast_snapshot",
]


def serial(row):
    result = {}
    for c in row.__table__.columns:
        value = getattr(row, c.name)
        if isinstance(value, Decimal):
            value = money(value)
        elif isinstance(value, (date, datetime)):
            value = value.isoformat()
        elif hasattr(value, "value"):
            value = value.value
        result[c.name] = value
    if isinstance(row, Transaction):
        result["direction"] = row.type.value
        result["title"] = row.description or row.category
    return result


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, default=str, separators=(",", ":")).encode()
    ).hexdigest()


def workspace(db, user_id, wid, *, lock=False):
    q = db.query(CashWorkspace).filter_by(id=wid, user_id=user_id)
    if lock:
        q = q.with_for_update()
    w = q.first()
    if not w:
        raise HTTPException(404, "Workspace not found")
    return w


def owned(db, model, w, ident):
    row = db.query(model).filter_by(id=ident, workspace_id=w.id).first()
    if not row:
        raise HTTPException(404, "Record not found in this workspace")
    return row


def account(db, w, ident):
    a = owned(db, CashAccount, w, ident)
    if a.archived:
        raise HTTPException(409, "This account is archived")
    if a.currency != w.currency:
        raise HTTPException(409, "Account currency differs from workspace")
    return a


def local_today(w):
    return datetime.now(ZoneInfo(w.timezone)).date()


def create_workspace(db, user_id, body):
    payload = body.model_dump(mode="json")
    h = digest(payload)
    old = (
        db.query(CashWorkspace)
        .filter_by(user_id=user_id, create_key=body.request_key)
        .first()
    )
    if old:
        if old.create_hash != h:
            raise HTTPException(409, "Request key reused with different inputs")
        return serial(old)
    # Serialize workspace creation for the owner too, including duplicate retries.
    from ...models.user import User

    db.query(User).filter_by(id=user_id).with_for_update().one()
    old = (
        db.query(CashWorkspace)
        .filter_by(user_id=user_id, create_key=body.request_key)
        .first()
    )
    if old:
        if old.create_hash != h:
            raise HTTPException(409, "Request key reused with different inputs")
        return serial(old)
    w = CashWorkspace(
        **body.model_dump(exclude={"request_key"}),
        user_id=user_id,
        create_key=body.request_key,
        create_hash=h,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return serial(w)


def mutate(
    db,
    user_id,
    wid,
    operation,
    body,
    action,
    *,
    resource_id=None,
    peers=None,
    commit=True,
):
    """Shared writer. With commit=False, the caller owns a rollback savepoint
    and commits cash/audit plus its receipt/outbox in the same outer transaction.
    """
    from ..finance_reads import lock_legacy_owner
    lock_legacy_owner(db, user_id)
    w = workspace(db, user_id, wid)
    inputs = {"operation": operation, "body": body.model_dump(mode="json")}
    if resource_id is not None:
        # Existing target-less audit keys cannot establish a safe resource
        # replay. Keep them immutable and reject that ambiguous retry with 409.
        inputs["resource_id"] = resource_id
    h = digest(inputs)

    def replay():
        old = (
            db.query(CashAudit)
            .filter_by(workspace_id=wid, request_key=body.request_key)
            .first()
        )
        if old:
            if old.request_hash != h:
                raise HTTPException(409, "Request key reused with different inputs")
            return old.result
        return None

    previous = replay()
    if previous is not None:
        return previous
    # Conditional UPDATE is the serialization boundary on SQLite and PostgreSQL.
    # It locks the workspace before allocations, source adoption or mutation reads.
    # Cross-workspace transfers lock both endpoints in a stable order. A stale
    # endpoint aborts the entire transaction, including earlier revision bumps.
    scopes = [(w, body.revision), *(peers or [])]
    for scope, expected in sorted(scopes, key=lambda x: x[0].id):
        changed = db.execute(
            update(CashWorkspace)
            .where(
                CashWorkspace.id == scope.id,
                CashWorkspace.user_id == user_id,
                CashWorkspace.revision == expected,
            )
            .values(revision=CashWorkspace.revision + 1),
            execution_options={"synchronize_session": False},
        )
        if not changed.rowcount:
            if commit:
                db.rollback()
            previous = replay()
            if previous is not None:
                return previous
            raise HTTPException(
                409, "Workspace changed. Refresh, review your inputs and try again."
            )
        db.refresh(scope)
    try:
        result = action(w)
        db.flush()
    except IntegrityError:
        if commit:
            db.rollback()
        raise HTTPException(
            409,
            "A linked source or record already exists. Refresh and review before retrying.",
        )
    if result is None:
        result = {"ok": True}
    elif not isinstance(result, dict):
        result = serial(result)
    result["revision"] = w.revision
    if peers:
        result["related_revisions"] = {scope.id: scope.revision for scope, _ in peers}
    for scope, _ in scopes:
        db.add(
            CashAudit(
                workspace_id=scope.id,
                user_id=user_id,
                operation=operation,
                request_key=body.request_key,
                request_hash=h,
                result=result,
                revision=scope.revision,
            )
        )
    db.flush()
    if operation not in METADATA_OPERATIONS:
        from .everyday import reconcile_registered_alerts

        for scope, _ in scopes:
            reconcile_registered_alerts(db, scope)
    if commit:
        db.commit()
        invalidate_user_all(user_id)
    return result


def nominal_dates(start, end, recurrence):
    if recurrence == "once":
        yield start
        return
    if recurrence == "weekly":
        cur = start
        while cur <= end:
            yield cur
            cur += timedelta(days=7)
        return
    y, m = start.year, start.month
    while True:
        cur = date(y, m, min(start.day, calendar.monthrange(y, m)[1]))
        if cur > end:
            break
        yield cur
        m += 1
        if m == 13:
            y, m = y + 1, 1


def add_commitment(db, w, body):
    account(db, w, body.account_id)
    if body.end_date and body.end_date < body.start_date:
        raise HTTPException(422, "End date must follow start date")
    source_key = None
    if bool(body.source_kind) != bool(body.source_id):
        raise HTTPException(422, "Provide both source kind and source ID")
    if body.source_id:
        model = Plan if body.source_kind == "plan" else Transaction
        source = db.query(model).filter_by(id=body.source_id, user_id=w.user_id).first()
        if not source:
            raise HTTPException(404, "Source not found")
        linked_plan = source.id if model is Plan else source.plan_id
        keys = [f"{body.source_kind}:{body.source_id}"]
        if linked_plan:
            keys.append(f"plan:{linked_plan}")
            keys.extend(
                f"transaction:{t.id}"
                for t in db.query(Transaction)
                .filter_by(user_id=w.user_id, plan_id=linked_plan)
                .all()
            )
        if db.query(CashCommitment).filter(CashCommitment.source_key.in_(keys)).first():
            raise HTTPException(
                409, "This source or its linked plan already has a cash commitment"
            )
        # A linked transaction and its plan share one canonical identity, so
        # concurrent adoption into different owner workspaces cannot duplicate it.
        source_key = f"plan:{linked_plan}" if linked_plan else keys[0]
    c = CashCommitment(
        **body.model_dump(
            exclude={"revision", "request_key", "source_kind", "source_id"}
        ),
        workspace_id=w.id,
        source_key=source_key,
    )
    db.add(c)
    db.flush()
    from .scheduling import initial_horizon, materialize

    materialize(db, c, initial_horizon(c))
    return c


def validate_allocation(db, w, txid, oid, amount):
    t = owned(db, Transaction, w, txid)
    o = owned(db, CashOccurrence, w, oid)
    if (
        t.cash_reversal_of_id
        or db.query(Transaction).filter_by(cash_reversal_of_id=t.id).first()
    ):
        raise HTTPException(409, "Reversed cash records cannot settle a commitment")
    if t.date > local_today(w):
        raise HTTPException(409, "Future-dated records cannot be matched as paid")
    if o.cancelled:
        raise HTTPException(409, "Cannot match a cancelled commitment")
    if (
        t.account_id != o.account_id
        or t.currency != w.currency
        or t.type.value != o.direction
    ):
        raise HTTPException(
            422, "Match requires the same account, currency and direction"
        )
    active = db.query(CashSettlement).filter_by(workspace_id=w.id, reversed=False).all()
    available = Decimal(t.amount) - sum(
        (s.amount for s in active if s.transaction_id == t.id), Decimal(0)
    )
    remaining = Decimal(o.amount) - sum(
        (s.amount for s in active if s.occurrence_id == o.id), Decimal(0)
    )
    if amount > min(available, remaining):
        raise HTTPException(
            409, "Amount exceeds the unallocated payment or outstanding commitment"
        )
    return t, o, available, remaining


def add_settlement(db, w, txid, oid, amount):
    validate_allocation(db, w, txid, oid, amount)
    s = CashSettlement(
        workspace_id=w.id, transaction_id=txid, occurrence_id=oid, amount=amount
    )
    db.add(s)
    db.flush()
    return s


def add_movement(db, w, body):
    from ..finance_reads import guard_legacy_writer
    guard_legacy_writer(db, w.user_id)
    account(db, w, body.account_id)
    if body.date > local_today(w):
        raise HTTPException(
            422,
            "Record actual money on or before today. Use a commitment for future money.",
        )
    t = Transaction(
        user_id=w.user_id,
        workspace_id=w.id,
        account_id=body.account_id,
        currency=w.currency,
        amount=body.amount,
        type=TransactionType(body.direction),
        date=body.date,
        description=body.title,
        category=body.category,
    )
    db.add(t)
    db.flush()
    if body.occurrence_id:
        add_settlement(db, w, t.id, body.occurrence_id, body.amount)
    return t


def reverse_movement(db, w, tid):
    from ..finance_reads import guard_legacy_writer
    guard_legacy_writer(db, w.user_id)
    t = owned(db, Transaction, w, tid)
    if (
        t.cash_reversal_of_id
        or db.query(Transaction).filter_by(cash_reversal_of_id=t.id).first()
    ):
        raise HTTPException(
            409,
            "A reversal cannot be reversed again; record a reviewed correction instead",
        )
    if db.query(CashSettlement).filter_by(transaction_id=t.id, reversed=False).first():
        raise HTTPException(
            409, "Unmatch this payment before reversing its recorded cash"
        )
    row = Transaction(
        user_id=w.user_id,
        workspace_id=w.id,
        account_id=t.account_id,
        currency=t.currency,
        type=TransactionType.expense
        if t.type == TransactionType.income
        else TransactionType.income,
        amount=t.amount,
        date=t.date,
        description=f"Reversal: {t.description or t.category}"[:255],
        category=t.category,
        cash_reversal_of_id=t.id,
    )
    db.add(row)
    db.flush()
    return row


def base_revision(db, w):
    """Scenario saves/refreshes do not change the underlying cash inputs."""
    return (
        db.query(func.max(CashAudit.revision))
        .filter(
            CashAudit.workspace_id == w.id,
            CashAudit.operation.notin_(METADATA_OPERATIONS),
            or_(
                CashAudit.result["cash_inputs_changed"].as_boolean().is_(None),
                CashAudit.result["cash_inputs_changed"].as_boolean().is_(True),
            ),
        )
        .scalar()
        or 0
    )


def add_scenario(db, w, body):
    if not body.dates and not body.extras:
        raise HTTPException(422, "Add a changed date or extra movement to compare")
    ids = [x.occurrence_id for x in body.dates]
    if len(set(ids)) != len(ids):
        raise HTTPException(422, "One override per occurrence")
    for item in body.dates:
        owned(db, CashOccurrence, w, item.occurrence_id)
    for item in body.extras:
        account(db, w, item.account_id)
    s = CashScenario(
        workspace_id=w.id,
        name=body.name,
        base_revision=base_revision(db, w),
        changes=body.model_dump(
            mode="json", exclude={"revision", "request_key", "name"}
        ),
    )
    db.add(s)
    db.flush()
    return s


def state(db, w):
    result = {"workspace": serial(w)}
    for model in MODELS:
        key = model.__tablename__.removeprefix("cash_")
        query = db.query(model).filter_by(workspace_id=w.id)
        if model is CashTransfer:
            account_ids = [
                a[0] for a in db.query(CashAccount.id).filter_by(workspace_id=w.id)
            ]
            query = db.query(model).filter(
                or_(
                    CashTransfer.from_account_id.in_(account_ids),
                    CashTransfer.to_account_id.in_(account_ids),
                )
            )
        result[key] = [serial(r) for r in query.order_by(model.id).all()]
    result["movements"] = [
        serial(t)
        for t in db.query(Transaction)
        .filter_by(user_id=w.user_id, workspace_id=w.id)
        .order_by(Transaction.date.desc(), Transaction.id)
        .all()
    ]
    legacy = (
        db.query(Transaction)
        .filter_by(user_id=w.user_id, workspace_id=None)
        .order_by(Transaction.id)
        .all()
    )
    result["legacy_count"] = len(legacy)
    result["legacy_review_hash"] = digest([serial(t) for t in legacy])
    result["legacy_excluded"] = w.legacy_exclusion_hash == result["legacy_review_hash"]
    result["audit"] = [
        serial(r)
        for r in db.query(CashAudit)
        .filter_by(workspace_id=w.id)
        .order_by(CashAudit.created_at.desc(), CashAudit.id)
        .limit(100)
        .all()
    ]
    return result


def forecast(db, w, as_of, end, account_ids=None, scenario_id=None):
    if as_of.year < 1900 or end.year > 2100:
        raise HTTPException(422, "Supported cash dates are between 1900 and 2100")
    if end < as_of or (end - as_of).days > 180:
        raise HTTPException(422, "Forecast must cover 0–180 days after the as-of date")
    data = state(db, w)
    chosen = account_ids or [a["id"] for a in data["accounts"] if not a["archived"]]
    if len(set(chosen)) != len(chosen):
        raise HTTPException(422, "Duplicate account selection")
    for ident in chosen:
        owned(db, CashAccount, w, ident)
    warnings = []
    if data["legacy_count"] and not data["legacy_excluded"]:
        warnings.append(
            f"{data['legacy_count']} older record(s) remain unassigned. Review adoption or explicitly confirm they are outside this workspace."
        )
    if len(chosen) != len(data["accounts"]):
        warnings.append("This forecast covers a selected subset of accounts.")
    for c in data["commitments"]:
        if (
            c["account_id"] in chosen
            and c["recurrence"] not in {"once", "installments"}
            and not c["cancelled"]
        ):
            horizon = (
                date.fromisoformat(c["generated_through"])
                if c["generated_through"]
                else date(
                    min(2100, date.fromisoformat(c["start_date"]).year + 5), 12, 31
                )
            )
            if end > horizon and (
                not c["end_date"] or date.fromisoformat(c["end_date"]) > horizon
            ):
                warnings.append(
                    f"Extend the schedule for {c['title']} before forecasting beyond {horizon}."
                )

    def dates(rows):
        return [
            {
                k: date.fromisoformat(v)
                if k in ["date", "nominal_date", "expected_date", "due_date"] and v
                else v
                for k, v in r.items()
            }
            for r in rows
        ]

    inputs = dict(
        as_of=as_of,
        end=end,
        accounts=[a for a in data["accounts"] if a["id"] in chosen],
        anchors=dates(data["balance_anchors"]),
        movements=dates(data["movements"]),
        transfers=dates(data["transfers"]),
        occurrences=dates(data["occurrences"]),
        settlements=data["settlements"],
        allocations=data["goal_allocations"],
        buffer=w.buffer,
        warnings=warnings,
    )
    base = calculate(**inputs)
    result = {
        "workspace_id": w.id,
        "currency": w.currency,
        "timezone": w.timezone,
        "revision": w.revision,
        "base_revision": base_revision(db, w),
        "account_ids": chosen,
        "base": base,
        "scenario": None,
        "scenario_stale": False,
    }
    if scenario_id:
        s = owned(db, CashScenario, w, scenario_id)
        changes = s.changes
        overrides = {
            x["occurrence_id"]: date.fromisoformat(x["expected_date"])
            for x in changes["dates"]
        }
        for d in list(overrides.values()) + [
            date.fromisoformat(x["date"]) for x in changes["extras"]
        ]:
            if d <= as_of:
                raise HTTPException(422, "Scenario dates must be after the as-of date")
        occurrences = [
            {**o, "expected_date": overrides.get(o["id"], o["expected_date"])}
            for o in inputs["occurrences"]
        ]
        for i, x in enumerate(changes["extras"]):
            occurrences.append(
                {
                    **x,
                    "id": f"scenario-{i}",
                    "expected_date": date.fromisoformat(x["date"]),
                    "nominal_date": date.fromisoformat(x["date"]),
                    "due_date": None,
                    "cancelled": False,
                }
            )
        result["scenario"] = calculate(**{**inputs, "occurrences": occurrences})
        result["scenario_stale"] = s.base_revision != result["base_revision"]
    return result
