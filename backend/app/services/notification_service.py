"""Server-side notification generation & delivery.

Each entry point creates one row in ``notifications`` with an idempotent
``dedupe_key`` so callers can fire it from mutation hooks without worrying
about duplicates.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models.budget import Budget
from ..models.notification import Notification, NotificationType
from ..models.transaction import Transaction, TransactionType


def _create(
    db: Session,
    *,
    user_id: str,
    type: NotificationType,
    title: str,
    message: str,
    dedupe_key: str,
    link: str | None = None,
) -> Notification | None:
    """Insert a notification; return None if (user_id, dedupe_key) already exists."""
    note = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
        dedupe_key=dedupe_key,
    )
    db.add(note)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    db.refresh(note)
    return note


def notify_budget_overrun(
    db: Session,
    *,
    user_id: str,
    budget_id: str,
    budget_name: str,
    spent: float,
    cap: float,
    period_key: str | None = None,
    threshold: int = 100,
) -> Notification | None:
    """Emit a budget threshold notification.

    ``period_key`` defaults to the current month (``YYYY-MM``) for backward
    compatibility with monthly budgets, but callers may pass the budget's
    ``period_start`` to dedupe trip-budget notifications by their actual window.
    """
    if period_key is None:
        period_key = date.today().strftime("%Y-%m")
    pct = int(spent / cap * 100) if cap > 0 else 0
    if threshold >= 100:
        title = f"Budget over: {budget_name}"
    else:
        title = f"Budget {threshold}% used: {budget_name}"
    return _create(
        db,
        user_id=user_id,
        type=NotificationType.budget_alert,
        title=title,
        message=f"You've spent ${spent:,.2f} of a ${cap:,.2f} cap ({pct}%).",
        dedupe_key=f"budget:{budget_id}:{period_key}:{threshold}",
        link="/budgets",
    )


def evaluate_budget_thresholds(
    db: Session,
    *,
    user_id: str,
    transaction: Transaction,
) -> list[Notification]:
    """Look up budgets that the given transaction belongs to and emit threshold alerts.

    A transaction belongs to a budget when (a) the budget is linked to the same
    trip, OR (b) the budget's category matches and the transaction's date falls
    inside the budget's period. Both apply independently — a trip-tagged
    transaction in a category that also has a non-trip monthly budget evaluates
    both. Only expense transactions count. Idempotent via the
    ``(budget_id, period_start, threshold)`` dedupe key.
    """
    if transaction.type != TransactionType.expense:
        return []

    candidates: dict[str, Budget] = {}
    if transaction.trip_id is not None:
        for b in (
            db.query(Budget)
            .filter(Budget.user_id == user_id, Budget.trip_id == transaction.trip_id)
            .all()
        ):
            candidates[b.id] = b
    for b in (
        db.query(Budget)
        .filter(
            Budget.user_id == user_id,
            Budget.category == transaction.category,
            Budget.period_start <= transaction.date,
            Budget.period_end >= transaction.date,
        )
        .all()
    ):
        candidates.setdefault(b.id, b)

    fired: list[Notification] = []
    for budget in candidates.values():
        cap = float(budget.amount or 0)
        if cap <= 0:
            continue

        txn_query = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.expense,
            Transaction.date >= budget.period_start,
            Transaction.date <= budget.period_end,
        )
        if budget.trip_id is not None:
            txn_query = txn_query.filter(Transaction.trip_id == budget.trip_id)
        else:
            txn_query = txn_query.filter(Transaction.category == budget.category)

        spent = sum(float(t.amount) for t in txn_query.all())
        pct = spent / cap * 100

        period_key = budget.period_start.isoformat()
        for threshold in (80, 100):
            if pct >= threshold:
                note = notify_budget_overrun(
                    db,
                    user_id=user_id,
                    budget_id=budget.id,
                    budget_name=budget.name,
                    spent=spent,
                    cap=cap,
                    period_key=period_key,
                    threshold=threshold,
                )
                if note is not None:
                    fired.append(note)
    return fired


def notify_bill_reminder(db: Session, *, user_id: str, txn_id: str, description: str, amount: float, due: date) -> Notification | None:
    return _create(
        db,
        user_id=user_id,
        type=NotificationType.bill_reminder,
        title=f"Upcoming bill: {description}",
        message=f"${amount:,.2f} due on {due.isoformat()}.",
        dedupe_key=f"bill:{txn_id}:{due.isoformat()}",
        link="/transactions",
    )


def notify_goal_milestone(db: Session, *, user_id: str, goal_id: str, goal_name: str, percent: int) -> Notification | None:
    return _create(
        db,
        user_id=user_id,
        type=NotificationType.milestone,
        title=f"Goal milestone: {goal_name}",
        message=f"You're {percent}% of the way to your goal. Keep it up!",
        dedupe_key=f"goal:{goal_id}:{percent}",
        link="/savings",
    )


def notify_anomaly(db: Session, *, user_id: str, txn_id: str, category: str, amount: float, average: float) -> Notification | None:
    return _create(
        db,
        user_id=user_id,
        type=NotificationType.anomaly,
        title=f"Unusual spend: {category}",
        message=f"${amount:,.2f} is {amount / average:.1f}× your category average of ${average:,.2f}.",
        dedupe_key=f"anomaly:{txn_id}",
        link="/transactions",
    )


__all__ = [
    "notify_budget_overrun",
    "evaluate_budget_thresholds",
    "notify_bill_reminder",
    "notify_goal_milestone",
    "notify_anomaly",
]
