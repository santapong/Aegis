"""Server-side notification generation & delivery.

Each entry point creates one row in ``notifications`` with an idempotent
``dedupe_key`` so callers can fire it from mutation hooks without worrying
about duplicates.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models.notification import Notification, NotificationType


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


def notify_budget_overrun(db: Session, *, user_id: str, budget_id: str, budget_name: str, spent: float, cap: float) -> Notification | None:
    period = date.today().strftime("%Y-%m")
    return _create(
        db,
        user_id=user_id,
        type=NotificationType.budget_alert,
        title=f"Budget over: {budget_name}",
        message=f"You've spent ${spent:,.2f} of a ${cap:,.2f} cap ({int(spent / cap * 100)}%).",
        dedupe_key=f"budget:{budget_id}:{period}",
        link="/budgets",
    )


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
        message=f"${amount:,.2f} is {amount / average:.1f}\u00d7 your category average of ${average:,.2f}.",
        dedupe_key=f"anomaly:{txn_id}",
        link="/transactions",
    )


__all__ = [
    "notify_budget_overrun",
    "notify_bill_reminder",
    "notify_goal_milestone",
    "notify_anomaly",
]
