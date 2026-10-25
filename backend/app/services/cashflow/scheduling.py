"""Bounded recurrence identities; expected dates never determine occurrence identity."""

import calendar
import uuid
from datetime import date, timedelta
from fastapi import HTTPException
from ...models.cashflow import CashOccurrence
from ...models.transaction import WeekendRule
from ..recurrence import _apply_weekend_rule

MAX_DATE = date(2100, 12, 31)
MAX_ADDED = 1000


def slots(start, end, recurrence, every=1, month_days=None):
    if recurrence == "once":
        yield start, 0
        return
    if recurrence == "installments":
        return
    if recurrence in {"weekly", "biweekly"}:
        delta = timedelta(days=(7 if recurrence == "weekly" else 14) * every)
        cur = start
        while cur <= end:
            yield cur, 0
            cur += delta
        return
    step = {"monthly": 1, "quarterly": 3, "yearly": 12, "split": 1}[recurrence] * every
    month_index = start.year * 12 + start.month - 1
    while True:
        year, zero_month = divmod(month_index, 12)
        month = zero_month + 1
        if date(year, month, 1) > end:
            return
        for day in sorted(month_days or [start.day]):
            nominal = date(year, month, min(day, calendar.monthrange(year, month)[1]))
            if start <= nominal <= end:
                yield nominal, day if recurrence == "split" else 0
        month_index += step


def initial_horizon(c):
    if c.recurrence == "once":
        return c.start_date
    return min(c.end_date or MAX_DATE, date(min(2100, c.start_date.year + 5), 12, 31))


def materialize(db, c, through):
    if c.cancelled:
        raise HTTPException(409, "A cancelled schedule cannot be extended")
    if c.recurrence == "installments":
        raise HTTPException(
            422, "Installments use only the dates and amounts you entered"
        )
    if through < c.start_date or through > MAX_DATE:
        raise HTTPException(
            422, "Choose a schedule end between its start date and 2100"
        )
    end = min(through, c.end_date or MAX_DATE)
    existing = {
        (o.nominal_date, o.schedule_slot)
        for o in db.query(CashOccurrence).filter_by(commitment_id=c.id)
    }
    missing = [
        (d, slot)
        for d, slot in slots(
            c.start_date, end, c.recurrence, c.interval_every, c.recurrence_days
        )
        if (d, slot) not in existing
    ]
    if len(missing) > MAX_ADDED:
        raise HTTPException(
            422, "Extend in smaller steps: at most 1,000 new occurrences per review"
        )
    for nominal, slot in missing:
        identity = (
            nominal.isoformat() if slot == 0 else f"{nominal.isoformat()}:day-{slot}"
        )
        db.add(
            CashOccurrence(
                id=str(uuid.uuid5(uuid.UUID(c.id), identity)),
                workspace_id=c.workspace_id,
                commitment_id=c.id,
                account_id=c.account_id,
                title=c.title,
                direction=c.direction,
                amount=c.amount,
                nominal_date=nominal,
                schedule_slot=slot,
                expected_date=_apply_weekend_rule(nominal, WeekendRule(c.weekend_rule)),
                due_date=c.due_date if c.recurrence == "once" else nominal,
            )
        )
    c.generated_through = max(c.generated_through or c.start_date, end)
    db.flush()
    return len(missing)
