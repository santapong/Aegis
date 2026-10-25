"""Rehearse M4 after a populated, verified M3 database; preserve legacy LINE history."""

import argparse
import hashlib
import json
import subprocess
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, create_engine, inspect, text
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models.cashflow import CashForecastSnapshot, CashWorkspace
from app.services.cashflow import forecast
from app.services.cashflow.business import snapshot_detail

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
# The M3 predecessor guards dedicated fresh task-local paths/database names.
subprocess.run(
    [sys.executable, str(root / "scripts/rehearse-cashflow-m3.py"), "--url", args.url],
    check=True,
)
get_settings().database_url = args.url
config = Config(str(root / "backend/alembic.ini"))
config.set_main_option("script_location", str(root / "backend/alembic"))
engine = create_engine(args.url)
now = datetime.utcnow()
with engine.begin() as connection:
    schema = MetaData()
    schema.reflect(bind=connection)
    workspace = (
        connection.execute(schema.tables["cash_workspaces"].select()).mappings().one()
    )
    account = (
        connection.execute(schema.tables["cash_accounts"].select()).mappings().one()
    )
    transaction = (
        connection.execute(schema.tables["transactions"].select()).mappings().one()
    )
    uid, wid, aid = workspace["user_id"], workspace["id"], account["id"]
    connection.execute(
        schema.tables["line_finance_identities"]
        .insert()
        .values(line_id="fictional-legacy-line", user_id=uid)
    )
    connection.execute(
        schema.tables["line_finance_codes"]
        .insert()
        .values(
            digest=hashlib.sha256(b"fictional-legacy-code").hexdigest(),
            user_id=uid,
            expires_at=now + timedelta(minutes=10),
        )
    )
    connection.execute(
        schema.tables["line_finance_events"]
        .insert()
        .values(
            id=hashlib.sha256(b"fictional-legacy-event").hexdigest(), created_at=now
        )
    )
    connection.execute(
        schema.tables["line_finance_drafts"]
        .insert()
        .values(
            id=str(uuid.uuid4()),
            user_id=uid,
            state="confirmed",
            transaction_id=transaction["id"],
            data={
                "amount": "60.00",
                "type": "expense",
                "date": "2026-10-02",
                "currency": "THB",
            },
            created_at=now,
            updated_at=now,
        )
    )
    connection.execute(
        schema.tables["line_finance_replies"]
        .insert()
        .values(
            id=str(uuid.uuid4()),
            line_id="fictional-legacy-line",
            text="Fictional reply; no delivery",
            state="pending",
            attempts=2,
            created_at=now,
            next_at=now,
        )
    )


def captured():
    with engine.connect() as connection:
        schema = MetaData()
        schema.reflect(bind=connection)
        return {
            name: {
                "columns": list(table.columns.keys()),
                "pk": [c.name for c in table.primary_key.columns],
                "rows": [
                    dict(row) for row in connection.execute(table.select()).mappings()
                ],
                "indexes": inspect(connection).get_indexes(name),
            }
            for name, table in schema.tables.items()
            if name != "alembic_version"
        }


before = captured()


def preserved():
    after = captured()
    for name, saved in before.items():
        keys = {tuple(row[k] for k in saved["pk"]) for row in saved["rows"]}
        rows = [
            {k: row[k] for k in saved["columns"]}
            for row in after[name]["rows"]
            if tuple(row[k] for k in saved["pk"]) in keys
        ]
        assert sorted(map(str, rows)) == sorted(map(str, saved["rows"])), name
        assert saved["indexes"] == after[name]["indexes"], name
    with engine.connect() as connection:
        if engine.dialect.name == "sqlite":
            assert not connection.exec_driver_sql("PRAGMA foreign_key_check").all()
        assert not connection.execute(
            text(
                "SELECT workspace_id FROM line_finance_identities WHERE line_id='fictional-legacy-line'"
            )
        ).scalar()
    with Session(engine) as db:
        w = db.get(CashWorkspace, wid)
        result = forecast(db, w, date(2026, 10, 2), date(2026, 10, 31))["base"]
        assert (result["cash_today"], result["closing_cash"], result["headroom"]) == (
            "940.00",
            "900.00",
            "800.00",
        )
        for saved in db.query(CashForecastSnapshot).all():
            snapshot_detail(db, w, saved.id)


command.upgrade(config, "a1002cf00004")
command.upgrade(config, "a1002cf00004")
preserved()
command.downgrade(config, "a1002cf00003")
command.upgrade(config, "a1002cf00004")
preserved()
new_code = hashlib.sha256(b"fictional-reviewed-target").hexdigest()
with engine.begin() as connection:
    schema = MetaData()
    schema.reflect(bind=connection)
    connection.execute(
        schema.tables["line_finance_codes"]
        .insert()
        .values(
            digest=new_code,
            user_id=uid,
            expires_at=now + timedelta(minutes=10),
            workspace_id=wid,
            account_id=aid,
        )
    )


def refuse(expected):
    try:
        command.downgrade(config, "a1002cf00003")
    except RuntimeError as error:
        assert expected in str(error)
    else:
        raise AssertionError("Populated destination/history downgrade was not refused")
    preserved()


refuse("Reviewed LINE cash destinations exist")
with engine.begin() as connection:
    connection.execute(
        text("DELETE FROM line_finance_codes WHERE digest=:digest"),
        {"digest": new_code},
    )
    table = MetaData()
    table.reflect(bind=connection, only=["line_finance_drafts"])
    connection.execute(
        table.tables["line_finance_drafts"]
        .insert()
        .values(
            id=str(uuid.uuid4()),
            user_id=uid,
            state="cancelled",
            data={"workspace_id": wid, "account_id": aid, "amount": "10.00"},
            created_at=now,
            updated_at=now,
        )
    )
refuse("Workspace LINE draft/history exists")
with engine.connect() as connection:
    assert (
        connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
        == "a1002cf00004"
    )
print(
    json.dumps(
        {
            "engine": engine.dialect.name,
            "all_m3_rows_ids_links_snapshots_preserved": True,
            "legacy_line_history_preserved_and_destination_null": True,
            "repeat_upgrade": True,
            "unused_m4_downgrade_reupgrade": True,
            "destination_downgrade_refused": True,
            "history_after_unlink_downgrade_refused": True,
        }
    )
)
engine.dispose()
