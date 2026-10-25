"""Compare the local fictional pilot with its restored PostgreSQL copy."""

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
    (a.restored, "aegis_cash_restore_test"),
]:
    url = make_url(raw)
    assert (
        url.get_backend_name() == "postgresql"
        and url.host == "127.0.0.1"
        and url.port == 5548
        and url.database == name
    ), "Only the dedicated local pilot/restore databases are allowed"
    engine = create_engine(raw)
    with engine.connect() as conn:
        tables = inspect(conn).get_table_names()
        counts = {
            table: conn.execute(text('SELECT COUNT(*) FROM "' + table + '"')).scalar()
            for table in tables
        }
    with Session(engine) as db:
        forecasts = {
            w.id: forecast(db, w, date(2026, 10, 2), date(2026, 10, 31))
            for w in db.query(CashWorkspace).all()
        }
    results.append((counts, forecasts))
    engine.dispose()
assert results[0] == results[1], "Restored data/forecasts differ"
print(
    json.dumps(
        {
            "all_table_counts_equal": True,
            "all_base_forecasts_equal": True,
            "workspaces": len(results[0][1]),
            "cash_table_counts": {
                k: v for k, v in results[0][0].items() if k.startswith("cash_")
            },
        }
    )
)
