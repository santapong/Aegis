"""Tests for the split-schedule recurrence helper + /upcoming endpoint."""
from datetime import date

from app.models.transaction import (
    RecurringInterval,
    Transaction,
    TransactionType,
    WeekendRule,
)
from app.services.recurrence import expand_occurrences, monthly_equivalent
from tests.conftest import _register


def _tx(**kw) -> Transaction:
    """Build a transient Transaction with sane defaults for unit tests."""
    base = dict(
        id="t1",
        amount=21000.0,
        type=TransactionType.income,
        category="salary",
        date=date(2026, 1, 1),
        is_recurring=True,
    )
    base.update(kw)
    return Transaction(**base)


def test_split_schedule_two_dates_per_month():
    tx = _tx(recurrence_dates=[1, 15], recurrence_weekend_rule=WeekendRule.strict)
    out = expand_occurrences(tx, date(2026, 1, 1), date(2026, 3, 31))
    assert out == [
        date(2026, 1, 1),
        date(2026, 1, 15),
        date(2026, 2, 1),
        date(2026, 2, 15),
        date(2026, 3, 1),
        date(2026, 3, 15),
    ]


def test_split_schedule_clamps_day_31_in_feb():
    tx = _tx(recurrence_dates=[31], recurrence_weekend_rule=WeekendRule.strict)
    out = expand_occurrences(tx, date(2026, 2, 1), date(2026, 2, 28))
    # Feb 2026 has 28 days, so day-31 clamps to Feb 28.
    assert out == [date(2026, 2, 28)]


def test_weekend_rule_roll_back():
    # 15 Aug 2026 is a Saturday.
    tx = _tx(recurrence_dates=[15], recurrence_weekend_rule=WeekendRule.roll_back)
    out = expand_occurrences(tx, date(2026, 8, 1), date(2026, 8, 31))
    assert out == [date(2026, 8, 14)]  # Fri


def test_weekend_rule_roll_forward_sunday():
    # 15 Nov 2026 is a Sunday.
    tx = _tx(recurrence_dates=[15], recurrence_weekend_rule=WeekendRule.roll_forward)
    out = expand_occurrences(tx, date(2026, 11, 1), date(2026, 11, 30))
    assert out == [date(2026, 11, 16)]  # Mon


def test_weekend_rule_strict_keeps_weekend():
    tx = _tx(recurrence_dates=[15], recurrence_weekend_rule=WeekendRule.strict)
    out = expand_occurrences(tx, date(2026, 8, 1), date(2026, 8, 31))
    assert out == [date(2026, 8, 15)]  # Sat


def test_legacy_monthly_interval_still_works():
    tx = _tx(
        recurrence_dates=None,
        recurring_interval=RecurringInterval.monthly,
        next_due_date=date(2026, 1, 10),
    )
    out = expand_occurrences(tx, date(2026, 1, 1), date(2026, 3, 31))
    assert out == [date(2026, 1, 10), date(2026, 2, 10), date(2026, 3, 10)]


def test_legacy_weekly_interval():
    tx = _tx(
        recurrence_dates=None,
        recurring_interval=RecurringInterval.weekly,
        next_due_date=date(2026, 1, 5),
    )
    out = expand_occurrences(tx, date(2026, 1, 1), date(2026, 1, 31))
    assert out == [
        date(2026, 1, 5),
        date(2026, 1, 12),
        date(2026, 1, 19),
        date(2026, 1, 26),
    ]


def test_monthly_equivalent_split_schedule_sums_occurrences():
    tx = _tx(
        amount=21000.0,
        recurrence_dates=[1, 15],
        recurrence_weekend_rule=WeekendRule.strict,
    )
    today = date(2026, 1, 1)
    # 30-day window from Jan 1 → Jan 31 catches Jan 1, Jan 15, Jan 31? No — Feb 1
    # falls within +30 days but Jan 31 ends the window. So expect 21000 * 2.
    val = monthly_equivalent(tx, today=today)
    assert val == 21000.0 * 2  # Jan 1 + Jan 15


def test_non_recurring_returns_empty():
    tx = _tx(is_recurring=False)
    assert expand_occurrences(tx, date(2026, 1, 1), date(2026, 12, 31)) == []


def test_upcoming_endpoint_returns_split_occurrences(client):
    headers, _ = _register(client)
    payload = {
        "amount": 21000,
        "type": "income",
        "category": "salary",
        "date": date.today().isoformat(),
        "is_recurring": True,
        "recurrence_dates": [1, 15],
        "recurrence_weekend_rule": "strict",
    }
    r = client.post("/api/transactions/", json=payload, headers=headers)
    assert r.status_code == 201, r.text

    r = client.get("/api/transactions/upcoming?days=60", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["window_days"] == 60
    # At least 3 occurrences fit into a 60-day window for dates [1, 15].
    assert len(body["occurrences"]) >= 3
    # All occurrences carry the same parent transaction id.
    parent_ids = {o["transaction_id"] for o in body["occurrences"]}
    assert len(parent_ids) == 1
