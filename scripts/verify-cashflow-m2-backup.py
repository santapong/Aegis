"""Verify exact task-local M2 records and forecasts after PostgreSQL restore."""

import argparse
import json
from datetime import date
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from app.models.cashflow import CashWorkspace
from app.services.cashflow import forecast

p = argparse.ArgumentParser()
p.add_argument("--source", required=True)
p.add_argument("--restored", required=True)
a = p.parse_args()
results = []
for raw, name in [
    (a.source, "aegis_cash_test"),
    (a.restored, "aegis_cash_m2_restore_test"),
]:
    u = make_url(raw)
    assert (
        u.get_backend_name() == "postgresql"
        and u.host == "127.0.0.1"
        and u.port == 5548
        and u.database == name
    ), "Dedicated local test databases only"
    engine = create_engine(raw)
    with engine.connect() as c:
        rows = {
            table: sorted(
                json.dumps(dict(r), default=str, sort_keys=True)
                for r in c.execute(text('SELECT * FROM "' + table + '"')).mappings()
            )
            for table in inspect(c).get_table_names()
        }
    with Session(engine) as db:
        plans = {
            w.id: forecast(db, w, date(2026, 10, 2), date(2026, 10, 31))
            for w in db.query(CashWorkspace).all()
        }
    results.append((rows, plans))
    engine.dispose()
assert results[0] == results[1], "Restored rows or forecasts differ"
print(
    json.dumps(
        {
            "all_table_rows_equal": True,
            "all_base_forecasts_equal": True,
            "workspace_count": len(results[0][1]),
            "cash_table_counts": {
                t: len(rows)
                for t, rows in results[0][0].items()
                if t.startswith("cash_")
            },
        }
    )
)
