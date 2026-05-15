"""Materialize-on-the-fly recurring transaction occurrences.

The DB stores a single source-of-truth row per recurring rule; we never
pre-insert future paydays. Callers compute occurrences inside a date
window on demand. This keeps storage flat and edits cheap (delete one row
to cancel the whole stream), at the cost of recomputing on each read.
"""
from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Iterable

from ..models.transaction import RecurringInterval, Transaction, WeekendRule


# Standard intervals fall back to the legacy single-day cadence rooted at
# `next_due_date` (or the transaction date if next_due_date is unset).
_INTERVAL_DELTAS: dict[RecurringInterval, timedelta] = {
    RecurringInterval.weekly: timedelta(days=7),
    RecurringInterval.biweekly: timedelta(days=14),
}


def _apply_weekend_rule(d: date, rule: WeekendRule | None) -> date:
    """Shift `d` per the weekend rule. weekday() 5=Sat, 6=Sun."""
    if rule is None or rule == WeekendRule.strict:
        return d
    wd = d.weekday()
    if wd < 5:
        return d
    if rule == WeekendRule.roll_back:
        # Sat -> Fri (-1), Sun -> Fri (-2)
        return d - timedelta(days=wd - 4)
    # roll_forward: Sat -> Mon (+2), Sun -> Mon (+1)
    return d + timedelta(days=7 - wd)


def _clamp_day(year: int, month: int, day: int) -> date:
    """Return a valid date in (year, month) clamping `day` to last day of month."""
    last = monthrange(year, month)[1]
    return date(year, month, min(day, last))


def _iter_months(start: date, end: date) -> Iterable[tuple[int, int]]:
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        yield y, m
        m += 1
        if m == 13:
            m = 1
            y += 1


def _advance_months(y: int, m: int, step: int) -> tuple[int, int]:
    m += step
    while m > 12:
        m -= 12
        y += 1
    return y, m


def expand_occurrences(
    tx: Transaction, start: date, end: date
) -> list[date]:
    """Return every occurrence date for `tx` within [start, end] inclusive.

    Returns [] for non-recurring transactions. Ordered ascending.
    """
    if not tx.is_recurring:
        return []

    out: list[date] = []

    if tx.recurrence_dates:
        rule = tx.recurrence_weekend_rule
        for year, month in _iter_months(start, end):
            for day in tx.recurrence_dates:
                base = _clamp_day(year, month, day)
                shifted = _apply_weekend_rule(base, rule)
                if start <= shifted <= end:
                    out.append(shifted)
        out.sort()
        return out

    interval = tx.recurring_interval
    if interval is None:
        return []

    anchor = tx.next_due_date or tx.date
    if interval in (RecurringInterval.weekly, RecurringInterval.biweekly):
        delta = _INTERVAL_DELTAS[interval]
        cur = anchor
        if cur < start:
            steps = ((start - cur) // delta)
            cur = cur + delta * steps
            while cur < start:
                cur += delta
        while cur <= end:
            out.append(cur)
            cur += delta
        return out

    step_months = {
        RecurringInterval.monthly: 1,
        RecurringInterval.quarterly: 3,
        RecurringInterval.yearly: 12,
    }[interval]
    y, m, d = anchor.year, anchor.month, anchor.day
    while _clamp_day(y, m, d) < start:
        y, m = _advance_months(y, m, step_months)
    while True:
        candidate = _clamp_day(y, m, d)
        if candidate > end:
            break
        out.append(candidate)
        y, m = _advance_months(y, m, step_months)
    return out


def monthly_equivalent(tx: Transaction, today: date | None = None) -> float:
    """Return the monthly-normalised amount for a recurring rule.

    For split schedules (`recurrence_dates`) we count actual occurrences in
    the next 30 days. For legacy intervals, fall back to fixed multipliers.
    """
    today = today or date.today()
    amount = float(tx.amount)

    if tx.recurrence_dates:
        occ = expand_occurrences(tx, today, today + timedelta(days=30))
        return amount * len(occ)

    multipliers = {
        RecurringInterval.weekly: 4.33,
        RecurringInterval.biweekly: 2.17,
        RecurringInterval.monthly: 1.0,
        RecurringInterval.quarterly: 1 / 3,
        RecurringInterval.yearly: 1 / 12,
    }
    if tx.recurring_interval is None:
        return amount
    return amount * multipliers.get(tx.recurring_interval, 1.0)
