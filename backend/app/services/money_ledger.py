"""Exact posting boundary. Callers own commit/rollback; this module only flushes.

PostgreSQL serializes a pilot owner's commands on the user row. Uniqueness and
deferred database constraints remain the final defense against ORM bypasses.
"""

import hashlib
import json
import re
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from pydantic import ValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models.user import User
from ..models.trip import Trip
from ..models.finance_ledger import (
    LedgerAccount,
    LedgerOpening,
    LedgerDraft,
    JournalEntry,
    Posting,
    FinancialTransactionProjection as Projection,
    LedgerIdempotency,
    EconomicIdentity,
    LedgerAudit,
    LedgerNotification,
    uid,
)
from ..schemas.finance_ledger import DraftPayload

MAX_MINOR = 2**63 - 1
BANGKOK = ZoneInfo("Asia/Bangkok")


class MoneyError(Exception):
    def __init__(self, code, message, status=422, field_errors=None):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status
        self.field_errors = field_errors or []


def minor(value, *, positive=False, signed=False):
    if not isinstance(value, str) or not re.fullmatch(
        r"-?\d{1,20}" if signed else r"\d{1,20}", value
    ):
        raise MoneyError(
            "INVALID_MONEY", "Money must be a decimal integer string in satang."
        )
    number = int(value)
    if abs(number) > MAX_MINOR or (positive and number <= 0):
        raise MoneyError(
            "INVALID_MONEY",
            "Amount must fit signed 64-bit satang and payments must be positive.",
        )
    return number


def decimal_to_minor(value):
    """For typed text/legacy Decimal input only: float is deliberately refused."""
    if isinstance(value, (float, bool)) or not isinstance(value, (str, Decimal, int)):
        raise MoneyError(
            "INVALID_MONEY", "Use exact decimal text, not floating-point input."
        )
    try:
        amount = Decimal(value)
        scaled = amount * 100
        if not amount.is_finite() or scaled != scaled.to_integral_value():
            raise InvalidOperation
        result = int(scaled)
    except (InvalidOperation, ValueError, OverflowError):
        raise MoneyError(
            "INVALID_MONEY", "THB accepts at most two decimal places."
        ) from None
    if abs(result) > MAX_MINOR:
        raise MoneyError("INVALID_MONEY", "Amount exceeds signed 64-bit satang.")
    return str(result)


def canonical(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return json.loads(json.dumps(value, default=str))


def digest(value):
    return hashlib.sha256(
        json.dumps(
            canonical(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False
        ).encode()
    ).hexdigest()


def lock_owner(db: Session, owner):
    dialect = db.get_bind().dialect.name
    if dialect not in {"postgresql", "sqlite"}:
        raise MoneyError(
            "UNSUPPORTED_DATABASE",
            "The finance ledger requires qualified PostgreSQL or SQLite.",
            503,
        )
    if dialect == "sqlite":
        connection = db.connection()
        raw = connection.connection.driver_connection
        if not raw.in_transaction:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
    user = db.query(User).filter(User.id == owner).with_for_update().first()
    if not user:
        raise MoneyError("NOT_FOUND", "Owner not found.", 404)
    if not user.is_active:
        raise MoneyError(
            "ACCOUNT_UNAVAILABLE", "This owner's account is unavailable.", 403
        )
    return user


def owned(db, model, owner, identity):
    row = db.query(model).filter_by(owner_id=owner, id=identity).first()
    if not row:
        raise MoneyError("NOT_FOUND", "Record not found.", 404)
    return row


def _replay(db, owner, namespace, key, body):
    if not isinstance(key, str) or not 1 <= len(key) <= 128:
        raise MoneyError(
            "MISSING_IDEMPOTENCY_KEY", "Provide an Idempotency-Key of 1–128 characters."
        )
    record = (
        db.query(LedgerIdempotency)
        .filter_by(owner_id=owner, namespace=namespace, key=key)
        .first()
    )
    if record and record.request_hash != digest(body):
        raise MoneyError(
            "IDEMPOTENCY_CONFLICT", "This key was used with different fields.", 409
        )
    return record.result if record else None


def _save(db, owner, namespace, key, body, result):
    db.add(
        LedgerIdempotency(
            owner_id=owner,
            namespace=namespace,
            key=key,
            request_hash=digest(body),
            result=result,
        )
    )
    db.flush()
    return result


def _audit(db, owner, operation, identity, details):
    db.add(
        LedgerAudit(
            owner_id=owner,
            operation=operation,
            resource_id=identity,
            details=canonical(details),
        )
    )


def account_dict(db, account):
    opening = db.query(LedgerOpening).filter_by(account_id=account.id).first()
    return {
        "id": account.id,
        "name": account.name,
        "kind": account.kind,
        "subtype": account.subtype,
        "currency": account.currency,
        "archived": account.archived,
        "opening": {
            "cutoff_at": aware(opening.cutoff_at).isoformat(),
            "signed_balance_minor": str(opening.signed_balance_minor),
        }
        if opening
        else None,
    }


def create_account(db, owner, body, key):
    lock_owner(db, owner)
    data = canonical(body)
    if result := _replay(db, owner, "create_account", key, data):
        return {**result, "replayed": True}
    subtype = data.get("subtype")
    if (
        subtype not in {"bank", "savings", "cash", "card"}
        or data.get("currency", "THB") != "THB"
    ):
        raise MoneyError(
            "UNSUPPORTED_CURRENCY", "Use a THB bank, savings, cash or card account."
        )
    name = data.get("name", "").strip()
    if not name or len(name) > 100:
        raise MoneyError(
            "INVALID_ACCOUNT", "Provide an account name of 1–100 characters."
        )
    account = LedgerAccount(
        owner_id=owner,
        name=name,
        subtype=subtype,
        kind="liability" if subtype == "card" else "asset",
        currency="THB",
        visible=True,
    )
    db.add(account)
    db.flush()
    return _save(db, owner, "create_account", key, data, account_dict(db, account))


def aware(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if value.tzinfo is None:
        # SQLite drops the offset; all persisted instants are normalized to UTC.
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _control(db, owner, kind):
    result = db.query(LedgerAccount).filter_by(owner_id=owner, system_key=kind).first()
    if not result:
        result = LedgerAccount(
            owner_id=owner,
            name=f"{kind.title()} control",
            kind=kind,
            subtype="control",
            system_key=kind,
            currency="THB",
            visible=False,
        )
        db.add(result)
        db.flush()
    return result


def _post(
    db,
    owner,
    kind,
    day,
    instant,
    precision,
    legs,
    amount,
    *,
    payload=None,
    source_draft_id=None,
    reversal_of=None,
    original_expense_entry_id=None,
    correction_group=None,
):
    legs = [(a, n) for a, n in legs if n]
    if len(legs) < 2 or sum(n for _, n in legs) != 0:
        raise MoneyError(
            "UNBALANCED_JOURNAL",
            "A journal requires at least two nonzero balanced postings.",
        )
    for account, number in legs:
        if (
            account.owner_id != owner
            or account.currency != "THB"
            or abs(number) > MAX_MINOR
        ):
            raise MoneyError(
                "INVALID_POSTING", "Posting owner, currency or amount is invalid."
            )
        current = int(
            db.query(func.coalesce(func.sum(Posting.amount_minor), 0))
            .filter_by(account_id=account.id, owner_id=owner)
            .scalar()
        )
        # Include every leg for the same account in the range check.
        if abs(current + sum(n for a, n in legs if a.id == account.id)) > MAX_MINOR:
            raise MoneyError(
                "BALANCE_OVERFLOW",
                "The resulting account balance exceeds signed 64-bit satang.",
            )
    payload = payload or {}
    entry = JournalEntry(
        id=uid(),
        owner_id=owner,
        kind=kind,
        currency="THB",
        occurred_on=day,
        occurred_at=instant,
        precision=precision,
        source_draft_id=source_draft_id,
        reversal_of=reversal_of,
        original_expense_entry_id=original_expense_entry_id,
        correction_group=correction_group,
        description=payload.get("description", ""),
    )
    db.add(entry)
    db.flush()
    income = -sum(n for a, n in legs if a.kind == "income")
    expense = sum(n for a, n in legs if a.kind == "expense")
    for account, number in legs:
        db.add(
            Posting(
                owner_id=owner,
                journal_id=entry.id,
                account_id=account.id,
                amount_minor=number,
            )
        )
    db.add(
        Projection(
            owner_id=owner,
            journal_entry_id=entry.id,
            operation_kind=kind,
            amount_minor=amount,
            income_effect_minor=income,
            expense_effect_minor=expense,
            category=payload.get("category", "uncategorized"),
            trip_id=payload.get("trip_id"),
            tags=payload.get("tags", []),
        )
    )
    _audit(
        db,
        owner,
        "post",
        entry.id,
        {"kind": kind, "source_draft_id": source_draft_id, "reversal_of": reversal_of},
    )
    db.flush()
    return entry


def create_openings(db, owner, body, key):
    lock_owner(db, owner)
    data = canonical(body)
    if result := _replay(db, owner, "openings", key, data):
        return {**result, "replayed": True}
    if data.get("reviewed") is not True:
        raise MoneyError(
            "OPENING_REVIEW_REQUIRED",
            "Review the posted balance and cutoff before confirming.",
        )
    raw = data.get("cutoff_at", "")
    try:
        cutoff = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if cutoff.tzinfo is None:
            raise ValueError
        cutoff = aware(cutoff)
    except (ValueError, TypeError):
        raise MoneyError(
            "INVALID_CUTOFF", "Provide an explicit cutoff timestamp with UTC offset."
        ) from None
    if cutoff > datetime.now(timezone.utc):
        raise MoneyError(
            "INVALID_CUTOFF", "An opening is a posted snapshot, not a future forecast."
        )
    items = data.get("accounts", [])
    if not items or len({item["account_id"] for item in items}) != len(items):
        raise MoneyError(
            "INVALID_OPENINGS",
            "Select at least one account, with each account listed once.",
        )
    checked = []
    for item in items:
        account = owned(db, LedgerAccount, owner, item["account_id"])
        if not account.visible or account.archived:
            raise MoneyError("INVALID_ACCOUNT", "Choose an active user account.")
        if db.query(LedgerOpening).filter_by(account_id=account.id).first():
            raise MoneyError(
                "OPENING_EXISTS",
                "This account already has its immutable opening snapshot.",
                409,
            )
        number = minor(item["signed_balance_minor"], signed=True)
        if account.subtype == "cash" and number < 0:
            raise MoneyError(
                "NEGATIVE_CASH_OPENING", "A cash wallet cannot open below zero."
            )
        checked.append((account, number))
    equity = _control(db, owner, "equity")
    for account, number in checked:
        debit = -number if account.kind == "liability" else number
        entry = (
            _post(
                db,
                owner,
                "opening",
                cutoff.astimezone(BANGKOK).date(),
                cutoff,
                "instant",
                [(account, debit), (equity, -debit)],
                abs(number),
            )
            if number
            else None
        )
        db.add(
            LedgerOpening(
                owner_id=owner,
                account_id=account.id,
                cutoff_at=cutoff,
                signed_balance_minor=number,
                journal_id=entry.id if entry else None,
                setup_key=key,
            )
        )
    db.flush()
    result = balances(db, owner)
    _audit(
        db,
        owner,
        "openings",
        checked[0][0].id,
        {"cutoff_at": cutoff.isoformat(), "account_ids": [a.id for a, _ in checked]},
    )
    return _save(db, owner, "openings", key, data, result)


def balances(db, owner):
    from .finance_reconciliation import reconciliation_status

    totals = dict(
        db.query(Posting.account_id, func.sum(Posting.amount_minor))
        .filter_by(owner_id=owner)
        .group_by(Posting.account_id)
        .all()
    )
    accounts, assets, liabilities = [], 0, 0
    for account in (
        db.query(LedgerAccount)
        .filter_by(owner_id=owner, visible=True)
        .order_by(LedgerAccount.name, LedgerAccount.id)
        .all()
    ):
        number = int(totals.get(account.id, 0))
        if abs(number) > MAX_MINOR:
            raise MoneyError(
                "BALANCE_OVERFLOW", "Account balance is outside supported range."
            )
        if account.kind == "liability":
            number = -number
            liabilities += number
        else:
            assets += number
        reconciliation = reconciliation_status(db, owner, account.id)
        accounts.append(
            {
                **account_dict(db, account),
                "balance_minor": str(number),
                "reconciliation": reconciliation,
            }
        )
    if any(abs(n) > MAX_MINOR for n in (assets, liabilities, assets - liabilities)):
        raise MoneyError(
            "BALANCE_OVERFLOW", "Aggregate position is outside supported range."
        )
    dates = [a["reconciliation"]["as_of"] for a in accounts]
    return {
        "currency": "THB",
        "accounts": accounts,
        "asset_balance_minor": str(assets),
        "liability_balance_minor": str(liabilities),
        "net_position_minor": str(assets - liabilities),
        "last_reconciled_at": min(dates) if dates and all(dates) else None,
        "settlement_verified": False,
    }


def _normalize(payload):
    try:
        return DraftPayload.model_validate(payload).model_dump(mode="json")
    except ValidationError as exc:
        raise MoneyError(
            "INVALID_DRAFT",
            "Draft contains unsupported fields or types.",
            field_errors=[
                {
                    "field": ".".join(map(str, e["loc"])),
                    "code": e["type"],
                    "message": e["msg"],
                }
                for e in exc.errors()
            ],
        ) from None


def _account(db, owner, identity):
    account = (
        db.query(LedgerAccount)
        .filter_by(owner_id=owner, id=identity, visible=True, archived=False)
        .first()
        if identity
        else None
    )
    if not account:
        raise MoneyError("MISSING_ACCOUNT", "Choose an active account owned by you.")
    return account


def _cutoff(db, owner, account, payload):
    opening = (
        db.query(LedgerOpening).filter_by(owner_id=owner, account_id=account.id).first()
    )
    if not opening:
        raise MoneyError(
            "MISSING_OPENING", "Confirm this account's opening snapshot before posting."
        )
    cutoff = aware(opening.cutoff_at)
    day = date.fromisoformat(payload["occurred_on"])
    if payload.get("date_precision") == "instant":
        raw = payload.get("occurred_at")
        if not raw:
            raise MoneyError(
                "MISSING_DATE", "An exact date requires its timestamp and UTC offset."
            )
        try:
            instant = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if instant.tzinfo is None or instant.astimezone(BANGKOK).date() != day:
                raise ValueError
        except ValueError:
            raise MoneyError(
                "INVALID_DATE",
                "Timestamp requires an offset and must match the Bangkok date.",
            ) from None
        if aware(instant) <= cutoff:
            raise MoneyError(
                "BEFORE_CUTOFF",
                "This payment is already inside the opening snapshot; retain it as history.",
            )
    else:
        if payload.get("occurred_at"):
            raise MoneyError(
                "INVALID_DATE_PRECISION",
                "A date-only record cannot assert a precise timestamp.",
            )
        local_cutoff = cutoff.astimezone(BANGKOK).date()
        if day < local_cutoff or (
            day == local_cutoff and payload.get("cutoff_resolution") == "before"
        ):
            raise MoneyError(
                "BEFORE_CUTOFF", "This payment is included in the opening snapshot."
            )
        if day == local_cutoff and payload.get("cutoff_resolution") != "after":
            raise MoneyError(
                "AMBIGUOUS_CUTOFF",
                "Confirm whether this date-only payment happened after the opening snapshot.",
            )


def _economic_key(payload):
    identity = payload.get("economic_identity") or {}
    if identity.get("trustworthy") is not True:
        return None
    schemes = getattr(get_settings(), "finance_trusted_reference_schemes", [])
    if identity.get("scheme") not in schemes:
        raise MoneyError(
            "UNVERIFIED_REFERENCE",
            "This issuer/reference scheme has not been qualified for unique payment identity.",
        )
    if not identity.get("reference") or not identity.get("account_context"):
        raise MoneyError(
            "UNVERIFIED_REFERENCE",
            "A trustworthy reference needs issuer and account context.",
        )
    return digest(
        {
            k: str(identity[k]).strip()
            for k in ("scheme", "reference", "account_context")
        }
    )


def economic_lineage(db, owner, root_id):
    """A trusted identity survives reversals; report its current effective state."""
    current, visited = root_id, set()
    while current not in visited:
        visited.add(current)
        reversal = (
            db.query(JournalEntry)
            .filter_by(owner_id=owner, reversal_of=current)
            .first()
        )
        if not reversal:
            return {
                "root_journal_id": root_id,
                "effective_journal_id": current,
                "state": "effective",
            }
        replacement = (
            db.query(JournalEntry)
            .filter(
                JournalEntry.owner_id == owner,
                JournalEntry.correction_group == reversal.correction_group,
                JournalEntry.kind != "reversal",
            )
            .first()
            if reversal.correction_group
            else None
        )
        if not replacement:
            return {
                "root_journal_id": root_id,
                "effective_journal_id": None,
                "state": "fully_reversed",
            }
        current = replacement.id
    raise MoneyError(
        "CORRUPT_LINEAGE", "Correction lineage requires operator review.", 503
    )


def _refunded(db, owner, original_id):
    return -int(
        db.query(func.coalesce(func.sum(Projection.expense_effect_minor), 0))
        .join(JournalEntry, JournalEntry.id == Projection.journal_entry_id)
        .filter(
            JournalEntry.owner_id == owner,
            JournalEntry.original_expense_entry_id == original_id,
        )
        .scalar()
    )


def _prepare(db, owner, payload, *, duplicate_check=True):
    if payload.get("type") not in {
        "income",
        "expense",
        "transfer",
        "card_purchase",
        "card_repayment",
        "refund",
    }:
        raise MoneyError(
            "MISSING_DIRECTION",
            "Review whether this is income, expense, transfer, card activity or a refund.",
        )
    amount = minor(payload.get("amount_minor"), positive=True)
    fee = minor(payload.get("fee_minor", "0"))
    if payload.get("currency") != "THB":
        raise MoneyError(
            "UNSUPPORTED_CURRENCY",
            "The ledger supports THB only; display preferences do not convert money.",
        )
    if not payload.get("occurred_on"):
        raise MoneyError("MISSING_DATE", "Review the actual payment date.")
    day = date.fromisoformat(payload["occurred_on"])
    if day > datetime.now(BANGKOK).date():
        raise MoneyError("FUTURE_ACTUAL", "A future plan is not a posted payment.")
    if payload.get("date_precision") == "instant" and payload.get("occurred_at"):
        try:
            instant = datetime.fromisoformat(
                payload["occurred_at"].replace("Z", "+00:00")
            )
            if instant.tzinfo is None:
                raise ValueError
        except ValueError:
            raise MoneyError(
                "INVALID_DATE", "A precise timestamp requires a UTC offset."
            ) from None
        if aware(instant) > datetime.now(timezone.utc):
            raise MoneyError(
                "FUTURE_ACTUAL", "A future timestamp is not a posted payment."
            )
    if (
        payload.get("trip_id")
        and not db.query(Trip).filter_by(id=payload["trip_id"], user_id=owner).first()
    ):
        raise MoneyError("INVALID_TRIP", "Choose a trip owned by you.")
    if any(
        not isinstance(tag, str) or not tag.strip() or len(tag) > 100
        for tag in payload.get("tags", [])
    ):
        raise MoneyError(
            "INVALID_TAG", "Tags must be nonempty names of at most 100 characters."
        )
    kind = payload["type"]
    if fee and kind != "transfer":
        raise MoneyError(
            "INVALID_FEE", "Only a transfer may include a separately shown fee."
        )
    source = (
        _account(db, owner, payload.get("source_account_id"))
        if kind in {"expense", "card_purchase", "transfer", "card_repayment"}
        else None
    )
    target = (
        _account(db, owner, payload.get("target_account_id"))
        if kind in {"income", "refund", "transfer", "card_repayment"}
        else None
    )
    for account in (source, target):
        if account:
            _cutoff(db, owner, account, payload)
    if source and target and source.id == target.id:
        raise MoneyError("INVALID_TRANSFER", "A transfer requires different accounts.")
    if kind in {"income", "expense", "transfer", "card_repayment"}:
        asset = target if kind == "income" else source
        if asset.kind != "asset" or (kind == "transfer" and target.kind != "asset"):
            raise MoneyError(
                "INVALID_ACCOUNT_KIND",
                "Choose asset accounts; use card purchase or repayment for a card.",
            )
    if kind == "card_purchase" and source.kind != "liability":
        raise MoneyError(
            "INVALID_ACCOUNT_KIND", "A card purchase requires a card account."
        )
    if kind == "card_repayment" and target.kind != "liability":
        raise MoneyError(
            "INVALID_ACCOUNT_KIND", "A card repayment targets a card account."
        )
    expense = (
        _control(db, owner, "expense")
        if kind in {"expense", "card_purchase", "refund"} or fee
        else None
    )
    original_id = None
    if kind == "refund":
        original_id = payload.get("original_expense_entry_id")
        original = owned(db, JournalEntry, owner, original_id)
        projection = (
            db.query(Projection)
            .filter_by(journal_entry_id=original.id, owner_id=owner)
            .one()
        )
        if (
            original.kind not in {"expense", "card_purchase"}
            or db.query(JournalEntry).filter_by(reversal_of=original.id).first()
        ):
            raise MoneyError(
                "INVALID_REFUND", "Link the current effective expense to refund."
            )
        if amount + _refunded(db, owner, original.id) > projection.amount_minor:
            raise MoneyError(
                "OVER_REFUND",
                "Refunds cannot exceed the original expense principal.",
                409,
            )
    if kind == "income":
        legs = [(target, amount), (_control(db, owner, "income"), -amount)]
    elif kind in {"expense", "card_purchase"}:
        legs = [(expense, amount), (source, -amount)]
    elif kind in {"transfer", "card_repayment"}:
        legs = [(target, amount), (source, -amount - fee)] + (
            [(expense, fee)] if fee else []
        )
    else:
        legs = [(target, amount), (expense, -amount)]
    economic_key = _economic_key(payload)
    if economic_key:
        previous = (
            db.query(EconomicIdentity)
            .filter_by(owner_id=owner, key_hash=economic_key)
            .first()
        )
        if previous:
            lineage = economic_lineage(db, owner, previous.journal_id)
            raise MoneyError(
                "ECONOMIC_DUPLICATE",
                "This trusted payment identity already belongs to a recorded correction lineage; attach evidence to that history.",
                409,
                [
                    {
                        "field": "economic_identity",
                        "code": "ECONOMIC_DUPLICATE",
                        "message": json.dumps(lineage, sort_keys=True),
                    }
                ],
            )
    if duplicate_check:
        candidates = (
            db.query(Projection.journal_entry_id)
            .join(JournalEntry, JournalEntry.id == Projection.journal_entry_id)
            .join(Posting, Posting.journal_id == JournalEntry.id)
            .filter(
                Projection.owner_id == owner,
                Projection.amount_minor == amount,
                Projection.operation_kind == kind,
                JournalEntry.occurred_on == day,
                Posting.account_id.in_([a.id for a in (source, target) if a]),
            )
            .distinct()
            .all()
        )
        if candidates and payload.get("duplicate_resolution") != "distinct":
            raise MoneyError(
                "POSSIBLE_DUPLICATE",
                "A similar payment exists. Attach evidence or explicitly confirm this is a distinct payment.",
                409,
                [
                    {
                        "field": "duplicate_resolution",
                        "code": "POSSIBLE_DUPLICATE",
                        "message": ", ".join(p.journal_entry_id for p in candidates),
                    }
                ],
            )
    return amount, day, legs, original_id, economic_key


def validation_errors(db, draft):
    if draft.status != "pending":
        return []
    try:
        _prepare(db, draft.owner_id, draft.payload)
    except MoneyError as exc:
        return exc.field_errors or [
            {"field": "draft", "code": exc.code, "message": exc.message}
        ]
    return []


def draft_dict(db, draft):
    return {
        "id": draft.id,
        "version": draft.version,
        "status": draft.status,
        "payload": draft.payload,
        "validation_errors": validation_errors(db, draft),
        "posted_journal_id": draft.posted_journal_id,
    }


def create_draft(db, owner, payload):
    lock_owner(db, owner)
    normalized = _normalize(canonical(payload))
    # Explicit typed references resolve only against existing owned records.
    # Ambiguous or unknown names remain missing fields; never invent accounts.
    for field in ("source_account_id", "target_account_id"):
        value = normalized.get(field)
        if (
            value
            and not db.query(LedgerAccount.id)
            .filter_by(id=value, owner_id=owner)
            .first()
        ):
            matches = (
                db.query(LedgerAccount)
                .filter(
                    LedgerAccount.owner_id == owner,
                    LedgerAccount.visible.is_(True),
                    LedgerAccount.archived.is_(False),
                    func.lower(LedgerAccount.name) == value.strip().lower(),
                )
                .all()
            )
            if len(matches) == 1:
                normalized[field] = matches[0].id
    trip = normalized.get("trip_id")
    if trip and not db.query(Trip.id).filter_by(id=trip, user_id=owner).first():
        matches = [
            t
            for t in db.query(Trip).filter_by(user_id=owner)
            if re.sub(r"\s+", "-", t.title.strip().lower()) == trip.lower()
        ]
        if len(matches) == 1:
            normalized["trip_id"] = matches[0].id
    draft = LedgerDraft(owner_id=owner, payload=normalized, status="pending", version=1)
    db.add(draft)
    db.flush()
    _audit(db, owner, "draft_created", draft.id, {"version": 1})
    return draft_dict(db, draft)


def edit_draft(db, owner, identity, expected_version, patch):
    lock_owner(db, owner)
    draft = owned(db, LedgerDraft, owner, identity)
    if draft.version != expected_version or draft.status != "pending":
        raise MoneyError(
            "STALE_DRAFT",
            "This draft changed or is no longer editable. Reload the current version.",
            409,
        )
    before = canonical(draft.payload)
    updated = _normalize({**draft.payload, **canonical(patch)})
    provenance = dict(before.get("provenance") or {})
    fields = provenance.get("fields")
    fields = dict(fields) if isinstance(fields, dict) else {}
    for field in patch:
        if field != "provenance":
            fields[field] = {"source": "human_review", "version": draft.version + 1}
    provenance["fields"] = fields
    updated["provenance"] = provenance
    draft.payload = updated
    draft.version += 1
    _audit(
        db,
        owner,
        "draft_edited",
        draft.id,
        {"version": draft.version, "fields": sorted(patch), "before": before, "after": canonical(draft.payload)},
    )
    from .finance_integration import draft_lifecycle
    draft_lifecycle(db, owner, draft.id, {"status": "pending"}, "edited")
    db.flush()
    return draft_dict(db, draft)


def cancel_draft(db, owner, identity, expected_version):
    lock_owner(db, owner)
    draft = owned(db, LedgerDraft, owner, identity)
    if draft.status == "canceled" and draft.version == expected_version:
        from .finance_integration import draft_lifecycle
        result = draft_dict(db, draft)
        result["notification_queued"] = draft_lifecycle(db, owner, draft.id, result, "canceled")
        return result
    if draft.version != expected_version or draft.status != "pending":
        raise MoneyError(
            "STALE_DRAFT", "This draft changed or was already posted.", 409
        )
    draft.status = "canceled"
    _audit(db, owner, "draft_canceled", draft.id, {"version": draft.version})
    db.flush()
    from .finance_integration import draft_lifecycle
    result = draft_dict(db, draft)
    result["notification_queued"] = draft_lifecycle(db, owner, draft.id, result, "canceled")
    return result


def confirm_draft(db, owner, identity, expected_version, idempotency_key):
    from .finance_integration import draft_lifecycle
    lock_owner(db, owner)
    body = {"draft_id": identity, "expected_version": expected_version}
    namespace = "confirm_draft"
    if result := _replay(db, owner, namespace, idempotency_key, body):
        return {**result, "replayed": True}
    draft = owned(db, LedgerDraft, owner, identity)
    if draft.version != expected_version:
        raise MoneyError(
            "STALE_DRAFT", "Review the current version before confirming.", 409
        )
    if draft.status in {"posted", "attached"}:
        result = {
            "draft_id": draft.id,
            "journal_id": draft.posted_journal_id,
            "status": draft.status,
            "amount_minor": draft.payload.get("amount_minor"),
            "currency": "THB",
            "balances": balances(db, owner),
            "replayed": True,
        }
        result["notification_queued"] = draft_lifecycle(db, owner, draft.id, result, draft.status)
        return _save(db, owner, namespace, idempotency_key, body, result)
    if draft.status != "pending":
        raise MoneyError(
            "STALE_DRAFT", "A canceled or attached draft cannot post.", 409
        )
    payload = draft.payload
    from .finance_integration import (
        validate_evidence_for_posting,
        attach_evidence_to_entry,
    )

    validate_evidence_for_posting(db, owner, payload)
    if payload.get("duplicate_resolution") == "attach":
        existing = owned(db, JournalEntry, owner, payload.get("attach_to_journal_id"))
        if existing.kind in {"opening", "reversal"}:
            raise MoneyError(
                "INVALID_ATTACHMENT_TARGET",
                "Attach payment evidence to the original payment or its effective replacement.",
            )
        if not payload.get("evidence_ids"):
            raise MoneyError(
                "MISSING_EVIDENCE",
                "Select captured evidence to attach to the existing payment.",
            )
        attach_evidence_to_entry(db, owner, payload, existing.id)
        draft.status, draft.posted_journal_id = "attached", existing.id
        _audit(db, owner, "evidence_attached", draft.id, {"journal_id": existing.id})
        result = {
            "draft_id": draft.id,
            "journal_id": existing.id,
            "status": "attached",
            "currency": "THB",
            "balances": balances(db, owner),
        }
        result["notification_queued"] = draft_lifecycle(db, owner, draft.id, result, "attached")
        return _save(db, owner, namespace, idempotency_key, body, result)
    amount, day, legs, original_id, economic_key = _prepare(db, owner, payload)
    instant = aware(payload["occurred_at"]) if payload.get("occurred_at") else None
    entry = _post(
        db,
        owner,
        payload["type"],
        day,
        instant,
        payload["date_precision"],
        legs,
        amount,
        payload=payload,
        source_draft_id=draft.id,
        original_expense_entry_id=original_id,
    )
    attach_evidence_to_entry(db, owner, payload, entry.id)
    if economic_key:
        db.add(
            EconomicIdentity(owner_id=owner, key_hash=economic_key, journal_id=entry.id)
        )
    draft.status, draft.posted_journal_id = "posted", entry.id
    db.flush()
    result = {
        "draft_id": draft.id,
        "journal_id": entry.id,
        "status": "posted",
        "amount_minor": str(amount),
        "currency": "THB",
        "balances": balances(db, owner),
    }
    db.add(
        LedgerNotification(
            owner_id=owner,
            draft_id=draft.id,
            journal_id=entry.id,
            purpose="posted",
            payload=result,
            status="pending",
        )
    )
    result["notification_queued"] = draft_lifecycle(db, owner, draft.id, result, "posted")
    _audit(
        db,
        owner,
        "draft_confirmed",
        draft.id,
        {"version": draft.version, "journal_id": entry.id},
    )
    return _save(db, owner, namespace, idempotency_key, body, result)


def _projection_dict(db, entry, projection):
    # Verify every read against control-account postings; projections are derived.
    effects = (
        db.query(LedgerAccount.kind, func.sum(Posting.amount_minor))
        .join(Posting, Posting.account_id == LedgerAccount.id)
        .filter(Posting.journal_id == entry.id, Posting.owner_id == entry.owner_id)
        .group_by(LedgerAccount.kind)
        .all()
    )
    control = {k: int(n) for k, n in effects}
    income, expense = -control.get("income", 0), control.get("expense", 0)
    if (
        income != projection.income_effect_minor
        or expense != projection.expense_effect_minor
    ):
        raise MoneyError(
            "PROJECTION_MISMATCH",
            "Financial projection differs from immutable postings; rebuild under the repair runbook.",
            503,
        )
    account_effects = [
        {
            "account_id": a.id,
            "name": a.name,
            "subtype": a.subtype,
            "amount_minor": str(p.amount_minor),
        }
        for p, a in db.query(Posting, LedgerAccount)
        .join(LedgerAccount, LedgerAccount.id == Posting.account_id)
        .filter(
            Posting.owner_id == entry.owner_id,
            Posting.journal_id == entry.id,
            LedgerAccount.visible.is_(True),
        )
        .order_by(LedgerAccount.id)
        .all()
    ]
    from ..models.finance_integration import FinanceEntryEvidence

    evidence_ids = [
        r[0]
        for r in db.query(FinanceEntryEvidence.evidence_id)
        .filter_by(owner_id=entry.owner_id, journal_id=entry.id)
        .order_by(FinanceEntryEvidence.evidence_id)
    ]
    draft = (
        db.query(LedgerDraft)
        .filter_by(id=entry.source_draft_id, owner_id=entry.owner_id)
        .first()
        if entry.source_draft_id
        else None
    )
    reversed_entry = bool(
        db.query(JournalEntry.id)
        .filter_by(owner_id=entry.owner_id, reversal_of=entry.id)
        .first()
    )
    return {
        "id": entry.id,
        "currency": "THB",
        "journal_entry_id": entry.id,
        "operation_kind": entry.kind,
        "amount_minor": str(projection.amount_minor),
        "income_effect_minor": str(income),
        "expense_effect_minor": str(expense),
        "category": projection.category,
        "trip_id": projection.trip_id,
        "tags": projection.tags,
        "occurred_on": entry.occurred_on.isoformat(),
        "occurred_at": aware(entry.occurred_at).isoformat()
        if entry.occurred_at
        else None,
        "date_precision": entry.precision,
        "description": entry.description,
        "source_draft_id": entry.source_draft_id,
        "reversal_of": entry.reversal_of,
        "original_expense_entry_id": entry.original_expense_entry_id,
        "correction_group": entry.correction_group,
        "account_effects": account_effects,
        "evidence_ids": evidence_ids,
        "source": draft.payload.get("provenance", {}).get("source", "aegis_review")
        if draft
        else ("correction" if entry.correction_group else "opening"),
        "status": "reversed" if reversed_entry else "posted",
        "reversed": reversed_entry,
    }


def financial_transactions(db, owner, start=None, end=None):
    query = (
        db.query(JournalEntry, Projection)
        .join(Projection, Projection.journal_entry_id == JournalEntry.id)
        .filter(JournalEntry.owner_id == owner)
    )
    if start:
        query = query.filter(JournalEntry.occurred_on >= start)
    if end:
        query = query.filter(JournalEntry.occurred_on <= end)
    return [
        _projection_dict(db, entry, projection)
        for entry, projection in query.order_by(
            JournalEntry.occurred_on, JournalEntry.created_at, JournalEntry.id
        ).all()
    ]


def correct_entry(db, owner, identity, body, key):
    lock_owner(db, owner)
    data = canonical(body)
    if result := _replay(db, owner, f"correct:{identity}", key, data):
        return {**result, "replayed": True}
    original = owned(db, JournalEntry, owner, identity)
    if original.kind in {"opening", "reversal"}:
        raise MoneyError(
            "INVALID_CORRECTION",
            "Opening snapshots and reversal records require their explicit migration/audit process.",
        )
    if db.query(JournalEntry).filter_by(owner_id=owner, reversal_of=identity).first():
        raise MoneyError(
            "ALREADY_REVERSED",
            "Correct the latest effective replacement; this entry already has a reversal.",
            409,
        )
    if (
        original.kind in {"expense", "card_purchase"}
        and _refunded(db, owner, identity) > 0
    ):
        raise MoneyError(
            "ACTIVE_REFUNDS",
            "Resolve the linked refund chain before correcting this expense.",
            409,
        )
    day = date.fromisoformat(data["correction_effective_on"])
    if day > datetime.now(BANGKOK).date():
        raise MoneyError("FUTURE_ACTUAL", "A correction date cannot be in the future.")
    projection = db.query(Projection).filter_by(journal_entry_id=identity).one()
    legs = [
        (owned(db, LedgerAccount, owner, row.account_id), -row.amount_minor)
        for row in db.query(Posting)
        .filter_by(owner_id=owner, journal_id=identity)
        .all()
    ]
    for account, _ in legs:
        if account.visible:
            _cutoff(
                db,
                owner,
                account,
                {
                    "occurred_on": day.isoformat(),
                    "date_precision": "day",
                    "cutoff_resolution": data.get("cutoff_resolution"),
                },
            )
    group = uid()
    reversal = _post(
        db,
        owner,
        "reversal",
        day,
        None,
        "day",
        legs,
        projection.amount_minor,
        payload={
            "description": data["reason"],
            "category": projection.category,
            "trip_id": projection.trip_id,
            "tags": projection.tags,
        },
        reversal_of=identity,
        original_expense_entry_id=original.original_expense_entry_id,
        correction_group=group,
    )
    replacement_id = None
    if data.get("replacement"):
        replacement = _normalize(data["replacement"])
        (
            replacement["occurred_on"],
            replacement["occurred_at"],
            replacement["date_precision"],
        ) = day.isoformat(), None, "day"
        replacement["cutoff_resolution"] = data.get("cutoff_resolution")
        if original.kind == "refund":
            replacement["original_expense_entry_id"] = (
                original.original_expense_entry_id
            )
            if replacement["type"] != "refund":
                raise MoneyError(
                    "INVALID_CORRECTION",
                    "A refund replacement must retain its original expense lineage.",
                )
        from .finance_integration import (
            validate_evidence_for_posting,
            attach_evidence_to_entry,
        )

        validate_evidence_for_posting(
            db, owner, replacement, lineage_journal_id=original.id
        )
        # The reversed refund effects are now flushed; recompute the available principal.
        amount, rday, rlegs, expense_id, _ = _prepare(
            db, owner, {**replacement, "economic_identity": None}, duplicate_check=False
        )
        replacement_entry = _post(
            db,
            owner,
            replacement["type"],
            rday,
            None,
            "day",
            rlegs,
            amount,
            payload=replacement,
            original_expense_entry_id=expense_id,
            correction_group=group,
        )
        attach_evidence_to_entry(
            db, owner, replacement, replacement_entry.id, lineage_journal_id=original.id
        )
        replacement_id = replacement_entry.id
    result = {
        "original_journal_id": identity,
        "reversal_journal_id": reversal.id,
        "replacement_journal_id": replacement_id,
        "correction_effective_on": day.isoformat(),
        "balances": balances(db, owner),
    }
    _audit(db, owner, "correction", identity, {**result, "reason": data["reason"]})
    db.add(
        LedgerNotification(
            owner_id=owner,
            journal_id=reversal.id,
            purpose="corrected",
            payload=result,
            status="pending",
        )
    )
    from .finance_integration import journal_notification
    result["notification_queued"] = journal_notification(db, owner, reversal.id, result)
    return _save(db, owner, f"correct:{identity}", key, data, result)


def classify_entry(db, owner, identity, body, key):
    lock_owner(db, owner)
    data = canonical(body)
    if result := _replay(db, owner, f"classify:{identity}", key, data):
        return {**result, "replayed": True}
    entry = owned(db, JournalEntry, owner, identity)
    if (
        entry.kind in {"opening", "reversal"}
        or db.query(JournalEntry.id)
        .filter_by(owner_id=owner, reversal_of=identity)
        .first()
    ):
        raise MoneyError(
            "INACTIVE_CLASSIFICATION",
            "Classify the latest effective payment; immutable opening/reversal and reversed rows retain their matching classifications.",
            409,
        )
    if (
        data.get("trip_id")
        and not db.query(Trip).filter_by(id=data["trip_id"], user_id=owner).first()
    ):
        raise MoneyError("INVALID_TRIP", "Choose your own trip.")
    projection = (
        db.query(Projection).filter_by(owner_id=owner, journal_entry_id=identity).one()
    )
    old = {k: getattr(projection, k) for k in ("category", "trip_id", "tags")}
    for key_name in old:
        setattr(projection, key_name, data[key_name])
    _audit(db, owner, "classification", identity, {"before": old, "after": data})
    db.flush()
    return _save(
        db,
        owner,
        f"classify:{identity}",
        key,
        data,
        _projection_dict(db, entry, projection),
    )
