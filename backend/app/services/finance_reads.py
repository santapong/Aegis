"""Exact ledger reporting and the explicit legacy compatibility boundary.

Legacy history without a confirmed currency is returned separately. A historical
row represented by a journal is never counted a second time. Read adapters derive
effects from control postings rather than trusting a mutable cached effect.
"""

from decimal import Decimal, InvalidOperation

from fastapi import HTTPException

from ..models.transaction import Transaction


def exact_minor(value):
    """Convert an existing Decimal/string directly, without a float round trip."""
    if isinstance(value, (float, bool)):
        raise ValueError("Money must be an exact decimal string")
    try:
        amount = Decimal(value)
        minor = amount * 100
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("Invalid exact money") from exc
    if not amount.is_finite() or minor != minor.to_integral_value():
        raise ValueError("THB supports at most two decimal places")
    result = int(minor)
    if not -(2**63) <= result < 2**63:
        raise ValueError("Money is outside signed 64-bit storage")
    return result


def decimal_money(minor):
    return format(Decimal(int(minor)) / 100, ".2f")


def cutover_active(db, owner_id):
    # The switch is owner-specific; enabling the feature alone is not cutover.
    from ..models.finance_ledger import LedgerOpening

    return (
        db.query(LedgerOpening.account_id).filter_by(owner_id=owner_id).first()
        is not None
    )


def lock_legacy_owner(db, owner_id):
    """Share the opening/posting serialization boundary before legacy mutation."""
    if db.get_bind().dialect.name in {"sqlite", "postgresql"}:
        from .money_ledger import lock_owner

        return lock_owner(db, owner_id)
    # Legacy database support remains independent of the gated new ledger.
    from ..models.user import User

    return db.query(User).filter_by(id=owner_id).with_for_update().first()


def guard_legacy_writer(db, owner_id):
    lock_legacy_owner(db, owner_id)
    if cutover_active(db, owner_id):
        raise HTTPException(
            409,
            "Ledger cutover is active. Choose a real account and create/confirm a financial draft through /api/transaction-drafts; no legacy record was written.",
        )


def guard_legacy_transaction_dto(db, owner_id):
    if cutover_active(db, owner_id):
        raise HTTPException(
            409,
            "This positive-only legacy transaction format cannot represent ledger transfers, refunds and corrections. Use /api/financial-transactions and /api/finance/reports.",
        )


def canonical_transactions(db, owner_id, start=None, end=None):
    from .money_ledger import MoneyError, financial_transactions

    try:
        return [
            {"origin": "ledger", "currency": "THB", **row}
            for row in financial_transactions(db, owner_id, start, end)
        ]
    except MoneyError as exc:
        raise HTTPException(
            exc.status, {"code": exc.code, "message": exc.message}
        ) from exc


def report(db, owner_id, start=None, end=None, *, category=None, trip_id=None):
    rows = canonical_transactions(db, owner_id, start, end)
    legacy_query = db.query(Transaction).filter(
        Transaction.user_id == owner_id, Transaction.migrated_journal_id.is_(None)
    )
    if start:
        legacy_query = legacy_query.filter(Transaction.date >= start)
    if end:
        legacy_query = legacy_query.filter(Transaction.date <= end)
    unverified = []
    for row in legacy_query:
        if row.migration_currency != "THB":
            unverified.append(
                {
                    "id": row.id,
                    "occurred_on": row.date.isoformat(),
                    "amount": str(row.amount),
                    "type": row.type.value,
                    "currency": row.migration_currency,
                    "reason": "Historical currency has not been confirmed as THB",
                }
            )
            continue
        amount = exact_minor(row.amount)
        rows.append(
            {
                "id": row.id,
                "origin": row.origin,
                "currency": "THB",
                "operation_kind": row.type.value,
                "amount_minor": str(amount),
                "income_effect_minor": str(amount if row.type.value == "income" else 0),
                "expense_effect_minor": str(
                    amount if row.type.value == "expense" else 0
                ),
                "occurred_on": row.date.isoformat(),
                "description": row.description,
                "category": row.category,
                "trip_id": row.trip_id,
                "tags": [t.name for t in row.tags],
                "nonposting_history": True,
            }
        )
    rows = [
        r
        for r in rows
        if (category is None or r["category"] == category)
        and (trip_id is None or r["trip_id"] == trip_id)
    ]
    income = sum(int(r["income_effect_minor"]) for r in rows)
    expense = sum(int(r["expense_effect_minor"]) for r in rows)
    categories = {}
    for row in rows:
        categories[row["category"]] = categories.get(row["category"], 0) + int(
            row["expense_effect_minor"]
        )
    return {
        "currency": "THB",
        "start": start.isoformat() if start else None,
        "end": end.isoformat() if end else None,
        "income_minor": str(income),
        "expense_minor": str(expense),
        "net_movement_minor": str(income - expense),
        "expense_by_category_minor": {k: str(v) for k, v in categories.items()},
        "transactions": rows,
        "unverified_legacy_history": unverified,
        "unverified_legacy_count": len(unverified),
    }


def budget_report(db, owner_id, budget):
    from .money_ledger import digest
    # A trip budget is category-scoped inside that trip and its own period.
    result = report(
        db,
        owner_id,
        budget.period_start,
        budget.period_end,
        category=budget.category,
        trip_id=budget.trip_id,
    )
    cap = exact_minor(budget.amount)
    spent = int(result["expense_minor"])
    verified = currency_confirmed(db, owner_id, "budget", budget)
    return {
        "id": budget.id,
        "facts_hash": digest(currency_facts("budget", budget)),
        "currency": "THB",
        "category": budget.category,
        "trip_id": budget.trip_id,
        "period_start": budget.period_start.isoformat(),
        "period_end": budget.period_end.isoformat(),
        "budget_currency_confirmed": verified,
        "budget_minor": str(cap) if verified else None,
        "spent_minor": str(spent),
        "remaining_minor": str(cap - spent) if verified else None,
        "unverified_legacy_budget_amount": str(budget.amount) if not verified else None,
        "unverified_legacy_count": result["unverified_legacy_count"],
    }


def currency_facts(kind, row):
    if kind == "budget":
        return {
            "amount": str(row.amount),
            "category": row.category,
            "trip_id": row.trip_id,
            "period_start": str(row.period_start),
            "period_end": str(row.period_end),
        }
    return {
        "amount": str(row.total_budget),
        "start_date": str(row.start_date),
        "end_date": str(row.end_date),
    }


def currency_confirmed(db, owner_id, kind, row):
    from ..models.finance_ledger import LedgerAudit
    from .money_ledger import digest

    facts_hash = digest(currency_facts(kind, row))
    return any(
        a.details.get("currency") == "THB" and a.details.get("facts_hash") == facts_hash
        for a in db.query(LedgerAudit).filter_by(
            owner_id=owner_id,
            operation=kind + "_currency_confirmed",
            resource_id=row.id,
        )
    )


def confirm_currency(db, owner_id, kind, row):
    from ..models.finance_ledger import LedgerAudit
    from .money_ledger import digest, lock_owner

    lock_owner(db, owner_id)
    db.refresh(row)
    value = row.amount if kind == "budget" else row.total_budget
    if value is None:
        raise HTTPException(422, "This trip has no overall budget cap")
    exact_minor(value)
    if not currency_confirmed(db, owner_id, kind, row):
        db.add(
            LedgerAudit(
                owner_id=owner_id,
                operation=kind + "_currency_confirmed",
                resource_id=row.id,
                details={
                    "currency": "THB",
                    "facts_hash": digest(currency_facts(kind, row)),
                },
            )
        )
        db.flush()
    return {"id": row.id, "currency": "THB", "confirmed": True}


def account_totals(db, owner_id):
    from .money_ledger import balances

    result = balances(db, owner_id)
    return {
        key: result[key]
        for key in (
            "asset_balance_minor",
            "liability_balance_minor",
            "net_position_minor",
        )
    }


def monthly_series(result):
    buckets = {}
    for row in result["transactions"]:
        values = buckets.setdefault(row["occurred_on"][:7], [0, 0])
        values[0] += int(row["income_effect_minor"])
        values[1] += int(row["expense_effect_minor"])
    return buckets


def financial_today(db, owner_id):
    """Ledger periods use Bangkok; legacy owners retain their existing clock."""
    from datetime import date, datetime
    from zoneinfo import ZoneInfo

    return (
        datetime.now(ZoneInfo("Asia/Bangkok")).date()
        if owner_id and cutover_active(db, owner_id)
        else date.today()
    )
