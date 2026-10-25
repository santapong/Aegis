"""Compare all fictional pilot rows, forecasts, weeks and snapshots after restore."""

import argparse
import json
from datetime import date

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.models.cashflow import CashForecastSnapshot, CashWorkspace
from app.services.cashflow import forecast
from app.services.cashflow.business import snapshot_detail, variance, weeks


parser = argparse.ArgumentParser()
parser.add_argument("--source", required=True)
parser.add_argument("--restored", required=True)
parser.add_argument("--restore-milestone", choices=["m3", "m4"], default="m3")
args = parser.parse_args()
captured = []
for raw, database in [
    (args.source, "aegis_cash_test"),
    (args.restored, "aegis_cash_" + args.restore_milestone + "_restore_test"),
]:
    url = make_url(raw)
    assert (
        url.get_backend_name() == "postgresql"
        and url.host == "127.0.0.1"
        and url.port == 5548
        and url.database == database
    ), "Dedicated local pilot databases only"
    engine = create_engine(raw)
    with engine.connect() as connection:
        tables = {
            table: sorted(
                json.dumps(dict(row), default=str, sort_keys=True)
                for row in connection.execute(
                    text('SELECT * FROM "' + table + '"')
                ).mappings()
            )
            for table in inspect(connection).get_table_names()
        }
    with Session(engine) as db:
        workspaces = db.query(CashWorkspace).all()
        forecasts = {
            w.id: forecast(db, w, date(2026, 10, 2), date(2026, 10, 31))
            for w in workspaces
        }
        weekly = {
            w.id: weeks(db, w, date(2026, 10, 2))
            for w in workspaces
            if w.kind == "business"
        }
        snapshots = {}
        for saved in db.query(CashForecastSnapshot).all():
            workspace = db.get(CashWorkspace, saved.workspace_id)
            checked = snapshot_detail(db, workspace, saved.id)
            through = max(saved.as_of, min(saved.end, date(2026, 10, 2)))
            snapshots[saved.id] = {
                "hash": checked.source_hash,
                "payload": checked.payload,
                "variance": variance(db, workspace, saved.id, through),
            }
    captured.append(
        json.dumps(
            {
                "tables": tables,
                "forecasts": forecasts,
                "weeks": weekly,
                "snapshots": snapshots,
            },
            default=str,
            sort_keys=True,
        )
    )
    engine.dispose()
assert captured[0] == captured[1], "Restored records or calculations differ"
print(
    json.dumps(
        {
            "all_table_rows_equal": True,
            "all_forecasts_equal": True,
            "all_business_weeks_equal": True,
            "all_snapshot_hash_payload_variance_equal": True,
        }
    )
)
