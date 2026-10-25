"""Deterministic, exact end-of-day cash. No database or network access."""

from datetime import timedelta
from decimal import Decimal

ZERO = Decimal("0.00")


def money(value):
    return format(Decimal(value).quantize(Decimal("0.01")), ".2f")


def calculate(
    *,
    as_of,
    end,
    accounts,
    anchors,
    movements,
    transfers,
    occurrences,
    settlements,
    buffer,
    warnings=None,
    allocations=None,
):
    warnings = list(warnings or [])
    chosen = {a["id"] for a in accounts}
    reservations = [
        a
        for a in (allocations or [])
        if a["account_id"] in chosen and a["mode"] == "reserved" and not a["released"]
    ]
    reserved = sum(
        (
            Decimal(a["amount"])
            for a in reservations
            if a["account_id"] in chosen
            and a["mode"] == "reserved"
            and not a["released"]
        ),
        ZERO,
    )
    account_anchors = {}
    for a in accounts:
        valid = [
            x for x in anchors if x["account_id"] == a["id"] and x["date"] <= as_of
        ]
        if not valid:
            warnings.append(
                f"Add a reviewed opening balance for {a['name']} on or before {as_of}."
            )
        else:
            account_anchors[a["id"]] = max(valid, key=lambda x: x["date"])
    future = [t for t in movements if t["account_id"] in chosen and t["date"] > as_of]
    if future:
        warnings.append(
            f"{len(future)} future-dated recorded movement(s) need review; they are not cash today or promised future cash."
        )
    cash = sum((Decimal(a["amount"]) for a in account_anchors.values()), ZERO)
    actual_events = []
    for t in movements:
        anchor = account_anchors.get(t["account_id"])
        if anchor and anchor["date"] <= t["date"] <= as_of:
            effect = Decimal(t["amount"]) * (1 if t["direction"] == "income" else -1)
            cash += effect
            actual_events.append({**t, "cash_effect": money(effect), "kind": "actual"})
    for t in transfers:
        if t["date"] > as_of:
            warnings.append(
                "A future-dated transfer is excluded from cash today; review its date."
            )
            continue
        effect = ZERO
        for key, sign in [("from_account_id", -1), ("to_account_id", 1)]:
            anchor = account_anchors.get(t[key])
            if anchor and anchor["date"] <= t["date"]:
                effect += sign * Decimal(t["amount"])
        cash += effect
        if effect or (t["from_account_id"] in chosen and t["to_account_id"] in chosen):
            actual_events.append(
                {
                    **t,
                    "title": t["description"],
                    "cash_effect": money(effect),
                    "kind": "transfer",
                }
            )
    tx_by_id = {t["id"]: t for t in movements}
    paid = {}
    for s in settlements:
        t = tx_by_id.get(s["transaction_id"])
        if not s["reversed"] and t and t["date"] <= as_of:
            paid[s["occurrence_id"]] = paid.get(s["occurrence_id"], ZERO) + Decimal(
                s["amount"]
            )
    planned, later, unresolved = [], [], []
    for o in occurrences:
        if o["account_id"] not in chosen or o["cancelled"]:
            continue
        remaining = max(ZERO, Decimal(o["amount"]) - paid.get(o["id"], ZERO))
        if not remaining:
            continue
        item = {
            **o,
            "remaining": money(remaining),
            "settled": money(paid.get(o["id"], ZERO)),
            "kind": "planned",
        }
        if o["expected_date"] <= as_of:
            unresolved.append(item)
        elif o["expected_date"] > end:
            later.append(item)
        else:
            planned.append(item)
    if unresolved:
        warnings.append(
            f"{len(unresolved)} unpaid commitment(s) on or before the as-of date need a reviewed expected date or payment match."
        )
    missing = len(account_anchors) != len(accounts) or not accounts
    if not accounts:
        warnings.append("Choose at least one cash account.")
    running = cash
    days = []
    cur = as_of
    while cur <= end:
        rows = [o for o in planned if o["expected_date"] == cur]
        incoming = sum(
            (Decimal(o["remaining"]) for o in rows if o["direction"] == "income"), ZERO
        )
        outgoing = sum(
            (Decimal(o["remaining"]) for o in rows if o["direction"] == "expense"), ZERO
        )
        running += incoming - outgoing
        days.append(
            {
                "date": cur,
                "cash": money(running),
                "incoming": money(incoming),
                "outgoing": money(outgoing),
                "headroom": money(running - Decimal(buffer) - reserved),
                "events": rows,
            }
        )
        cur += timedelta(days=1)
    minimum = min(days, key=lambda x: Decimal(x["cash"]))
    first_negative = next((d["date"] for d in days if Decimal(d["cash"]) < 0), None)
    first_buffer = next(
        (d["date"] for d in days if Decimal(d["cash"]) < Decimal(buffer)), None
    )
    first_reserved_gap = next(
        (
            d["date"]
            for d in days
            if reserved and Decimal(d["cash"]) < Decimal(buffer) + reserved
        ),
        None,
    )
    history = []
    for offset in range(30, -1, -1):
        day = as_of - timedelta(days=offset)
        known = {}
        for a in accounts:
            valid = [
                x for x in anchors if x["account_id"] == a["id"] and x["date"] <= day
            ]
            if valid:
                known[a["id"]] = max(valid, key=lambda x: x["date"])
        value = sum((Decimal(a["amount"]) for a in known.values()), ZERO)
        for t in movements:
            anchor = known.get(t["account_id"])
            if anchor and anchor["date"] <= t["date"] <= day:
                value += Decimal(t["amount"]) * (
                    1 if t["direction"] == "income" else -1
                )
        for t in transfers:
            if t["date"] <= day:
                for key, sign in [("from_account_id", -1), ("to_account_id", 1)]:
                    anchor = known.get(t[key])
                    if anchor and anchor["date"] <= t["date"]:
                        value += sign * Decimal(t["amount"])
        history.append(
            {
                "date": day,
                "cash": money(value)
                if accounts and len(known) == len(accounts)
                else None,
            }
        )
    return {
        "history": history,
        "engine_version": "dated-cash-v2",
        "as_of": as_of,
        "end": end,
        "complete": not warnings,
        "warnings": warnings,
        "cash_today": None if missing else money(cash),
        "closing_cash": None if missing else money(running),
        "buffer": money(buffer),
        "reserved_cash": money(reserved),
        "reservations": reservations,
        "headroom": None if missing else money(running - Decimal(buffer) - reserved),
        "minimum": None
        if missing
        else {"date": minimum["date"], "cash": minimum["cash"]},
        "first_negative_date": None if missing else first_negative,
        "first_below_buffer_date": None if missing else first_buffer,
        "first_reserved_gap_date": None if missing else first_reserved_gap,
        "days": [] if missing else days,
        "planned": planned,
        "later": later,
        "unresolved": unresolved,
        "actual_events": actual_events,
        "anchors": list(account_anchors.values()),
        "expected_incoming": money(
            sum(
                (
                    Decimal(o["remaining"])
                    for o in planned
                    if o["direction"] == "income"
                ),
                ZERO,
            )
        ),
        "expected_outgoing": money(
            sum(
                (
                    Decimal(o["remaining"])
                    for o in planned
                    if o["direction"] == "expense"
                ),
                ZERO,
            )
        ),
        "limit": "End-of-day amounts; same-day income may arrive after same-day bills. Expected receipts are assumptions, not cash held.",
    }
