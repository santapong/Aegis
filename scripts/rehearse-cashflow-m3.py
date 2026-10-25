"""Rehearse M2→M3 with preserved data on fresh, explicitly disposable databases."""

import argparse
import json
import re
import uuid
from datetime import date, datetime
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, create_engine, event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.cashflow import CashWorkspace
from app.schemas.cashflow import ForecastSnapshotCreate
from app.services.cashflow import forecast
from app.services.cashflow.business import create_snapshot, snapshot_detail


parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
args = parser.parse_args()
url = make_url(args.url)
if url.get_backend_name() == "sqlite":
    path = Path(url.database)
    assert path.parent == Path("/mnt/data/aegis-all-m-2026-10-02")
    assert not path.exists(), "A fresh rehearsal file is required"
elif url.get_backend_name() == "postgresql":
    assert url.host == "127.0.0.1" and url.port == 5548
    assert re.fullmatch(r"aegis_cash_m[34]_migration_test(?:_r[1-9])?", url.database)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        assert not connection.execute(
            text("SELECT 1 FROM pg_database WHERE datname=:name"),
            {"name": url.database},
        ).scalar(), "A fresh rehearsal database is required"
        connection.exec_driver_sql(f'CREATE DATABASE "{url.database}"')
    admin.dispose()
else:
    raise ValueError("Only dedicated local SQLite/PostgreSQL rehearsals are supported")

get_settings().database_url = args.url
root = Path(__file__).resolve().parents[1]
config = Config(str(root / "backend/alembic.ini"))
config.set_main_option("script_location", str(root / "backend/alembic"))
command.upgrade(config, "a1002cf00002")
engine = create_engine(args.url)
if url.get_backend_name() == "sqlite":

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")


uid, wid, aid, cid, oid, tid, sid, bid = [str(uuid.uuid4()) for _ in range(8)]
now = datetime.utcnow()
# Reflect the source schema. The current ORM includes M3 columns that do not yet
# exist at this point, so it must not insert/read the old workspace table.
with engine.begin() as connection:
    schema = MetaData()
    schema.reflect(bind=connection)

    def insert(table, **values):
        connection.execute(schema.tables[table].insert().values(**values))

    insert(
        "users",
        id=uid,
        username="M3 migration example",
        email="m3@example.invalid",
        hashed_password="unused",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    insert(
        "cash_workspaces",
        id=wid,
        user_id=uid,
        name="Preserved M2 business",
        kind="business",
        currency="THB",
        timezone="Asia/Bangkok",
        buffer=50,
        revision=1,
        create_key="rehearsal",
        create_hash="rehearsal",
    )
    insert(
        "cash_accounts",
        id=aid,
        workspace_id=wid,
        name="Preserved cash",
        kind="bank",
        currency="THB",
        archived=False,
    )
    insert(
        "cash_balance_anchors",
        id=str(uuid.uuid4()),
        workspace_id=wid,
        account_id=aid,
        amount=1000,
        date=date(2026, 10, 1),
        source="Fictional checked opening",
        created_at=now,
    )
    insert(
        "transactions",
        id=tid,
        user_id=uid,
        workspace_id=wid,
        account_id=aid,
        currency="THB",
        amount=60,
        type="expense",
        category="Other",
        date=date(2026, 10, 2),
        description="Preserved partial payment",
        is_recurring=False,
        created_at=now,
    )
    insert(
        "cash_commitments",
        id=cid,
        workspace_id=wid,
        account_id=aid,
        title="Preserved supplier plan",
        direction="expense",
        amount=100,
        start_date=date(2026, 10, 15),
        recurrence="once",
        interval_every=1,
        generated_through=date(2026, 10, 15),
        weekend_rule="strict",
        cancelled=False,
        due_date=date(2026, 10, 15),
        source_key="rehearsal-preserved-source",
    )
    insert(
        "cash_occurrences",
        id=oid,
        workspace_id=wid,
        commitment_id=cid,
        account_id=aid,
        title="Edited supplier payment",
        direction="expense",
        amount=100,
        nominal_date=date(2026, 10, 15),
        schedule_slot=0,
        expected_date=date(2026, 10, 16),
        due_date=date(2026, 10, 15),
        cancelled=False,
    )
    insert(
        "cash_settlements",
        id=sid,
        workspace_id=wid,
        transaction_id=tid,
        occurrence_id=oid,
        amount=60,
        reversed=False,
        created_at=now,
    )
    insert(
        "cash_import_batches",
        id=bid,
        workspace_id=wid,
        account_id=aid,
        filename="preserved.csv",
        currency="THB",
        content_hash="preserved",
        created_at=now,
    )
    insert(
        "cash_import_rows",
        id=str(uuid.uuid4()),
        workspace_id=wid,
        batch_id=bid,
        row_number=2,
        raw={"amount": "60"},
        payload={"amount": "60.00"},
        errors=[],
        status="imported",
        transaction_id=tid,
    )
    insert(
        "cash_goal_allocations",
        id=str(uuid.uuid4()),
        workspace_id=wid,
        account_id=aid,
        name="Preserved purpose",
        amount=50,
        mode="reserved",
        released=False,
        created_at=now,
    )


def captured():
    with engine.connect() as connection:
        metadata = MetaData()
        metadata.reflect(bind=connection)
        return {
            name: {
                "columns": list(table.columns.keys()),
                "rows": [
                    dict(row) for row in connection.execute(table.select()).mappings()
                ],
                "indexes": inspect(connection).get_indexes(name),
            }
            for name, table in metadata.tables.items()
            if name
            not in {
                "alembic_version",
                "cash_business_documents",
                "cash_document_adjustments",
                "cash_forecast_snapshots",
            }
        }


before = captured()


def preserved():
    after = captured()
    for name, old in before.items():
        rows = [
            {key: row[key] for key in old["columns"]} for row in after[name]["rows"]
        ]
        assert sorted(map(str, rows)) == sorted(map(str, old["rows"])), name
        assert after[name]["indexes"] == old["indexes"], name
    with engine.connect() as connection:
        if url.get_backend_name() == "sqlite":
            assert not connection.exec_driver_sql("PRAGMA foreign_key_check").all()
    with Session(engine) as db:
        workspace = db.get(CashWorkspace, wid)
        assert workspace.week_start == 0
        result = forecast(db, workspace, date(2026, 10, 2), date(2026, 10, 31))["base"]
        assert result["cash_today"] == "940.00", result
        assert result["closing_cash"] == "900.00", result
        assert result["headroom"] == "800.00", result


command.upgrade(config, "a1002cf00003")
command.upgrade(config, "a1002cf00003")
preserved()
command.downgrade(config, "a1002cf00002")
command.upgrade(config, "a1002cf00003")
preserved()
with Session(engine) as db:
    saved = create_snapshot(
        db,
        db.get(CashWorkspace, wid),
        ForecastSnapshotCreate(
            name="Preserved snapshot",
            as_of=date(2026, 10, 2),
            end=date(2026, 10, 31),
            revision=1,
            request_key="snapshot-rehearsal",
        ),
    )
    db.commit()
    assert (
        snapshot_detail(db, db.get(CashWorkspace, wid), saved["id"]).source_hash
        == saved["source_hash"]
    )
try:
    command.downgrade(config, "a1002cf00002")
except RuntimeError as error:
    assert "M3 documents/snapshots exist" in str(error)
else:
    raise AssertionError("Populated M3 downgrade was not refused")
preserved()
with engine.connect() as connection:
    assert (
        connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
        == "a1002cf00003"
    )
print(
    json.dumps(
        {
            "engine": url.get_backend_name(),
            "populated_m2_values_ids_links_indexes_preserved": True,
            "repeat_upgrade": True,
            "unused_m3_downgrade_reupgrade": True,
            "populated_m3_downgrade_refused": True,
            "snapshot_hash_verified": True,
            "cash_today": "940.00",
            "closing_cash": "900.00",
            "headroom": "800.00",
        }
    )
)
engine.dispose()
