"""Rehearse only on a fresh disposable SQLite file or dedicated local test DB."""

import argparse
import json
import uuid
from datetime import date, datetime
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text, Table, MetaData
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models.user import User
from app.models.plan import Plan, PlanCategory

parser = argparse.ArgumentParser()
parser.add_argument("--url", required=True)
args = parser.parse_args()
url = make_url(args.url)
if url.get_backend_name() == "sqlite":
    assert Path(url.database).parent == Path(
        "/mnt/data/aegis-first-release-2026-10-02"
    ), "Disposable task folder only"
    assert not Path(url.database).exists(), (
        "Use a fresh file; never overwrite a database"
    )
elif url.get_backend_name() == "postgresql":
    assert (
        url.host == "127.0.0.1"
        and url.port == 5548
        and url.database == "aegis_cash_migration_test"
    ), "Dedicated local migration database only"
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        assert not connection.execute(
            text("SELECT 1 FROM pg_database WHERE datname='aegis_cash_migration_test'")
        ).scalar(), "Use a fresh database"
        connection.exec_driver_sql("CREATE DATABASE aegis_cash_migration_test")
    admin.dispose()
else:
    raise ValueError("Unsupported rehearsal engine")
get_settings().database_url = args.url
root = Path(__file__).resolve().parents[1]
cfg = Config(str(root / "backend/alembic.ini"))
cfg.set_main_option("script_location", str(root / "backend/alembic"))
command.upgrade(cfg, "a0923f1a0001")
engine = create_engine(args.url)
user_id, plan_id, tx_id = (str(uuid.uuid4()) for _ in range(3))
with Session(engine) as db:
    db.add(
        User(
            id=user_id,
            username="Migration example",
            email="migration@example.invalid",
            hashed_password="unused",
        )
    )
    db.flush()
    db.add(
        Plan(
            id=plan_id,
            user_id=user_id,
            title="Migration plan",
            category=PlanCategory.expense,
            amount="123.45",
            start_date=date(2026, 10, 1),
        )
    )
    db.commit()
with engine.begin() as conn:
    old_transactions = Table("transactions", MetaData(), autoload_with=conn)
    conn.execute(
        old_transactions.insert().values(
            id=tx_id,
            user_id=user_id,
            amount="123.45",
            type="expense",
            category="Other",
            date=date(2026, 10, 1),
            description="Historical record",
            plan_id=plan_id,
            created_at=datetime(2026, 10, 1),
            is_recurring=False,
        )
    )
    query = text(
        "SELECT id,user_id,amount,plan_id,description FROM transactions WHERE id=:id"
    )
    before = dict(conn.execute(query, {"id": tx_id}).mappings().one())
    indexes = {i["name"] for i in inspect(conn).get_indexes("transactions")}
command.upgrade(cfg, "a1002cf00001")
command.upgrade(cfg, "a1002cf00001")
with engine.connect() as conn:
    assert before == dict(conn.execute(query, {"id": tx_id}).mappings().one())
    assert indexes <= {i["name"] for i in inspect(conn).get_indexes("transactions")}
    assert (
        conn.execute(
            text("SELECT workspace_id FROM transactions WHERE id=:id"), {"id": tx_id}
        ).scalar()
        is None
    )
    assert (
        conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
        == "a1002cf00001"
    )
print(
    json.dumps(
        {
            "engine": url.get_backend_name(),
            "legacy_ids_links_amounts_preserved": True,
            "legacy_indexes_preserved": True,
            "unassigned_preserved": True,
            "repeat_upgrade": True,
            "revision": "a1002cf00001",
        }
    )
)
command.downgrade(cfg, "a0923f1a0001")
command.upgrade(cfg, "a1002cf00001")
with engine.connect() as conn:
    assert dict(conn.execute(query, {"id": tx_id}).mappings().one()) == before
print("PASS: empty-cash downgrade/re-upgrade preserves the historical row")
with engine.begin() as conn:
    conn.execute(
        text(
            "INSERT INTO cash_workspaces(id,user_id,name,kind,currency,timezone,buffer,revision,create_key,create_hash) VALUES(:id,:uid,'Guard example','personal','THB','Asia/Bangkok',0,0,'migration-test','migration-test')"
        ),
        {"id": str(uuid.uuid4()), "uid": user_id},
    )
try:
    command.downgrade(cfg, "a0923f1a0001")
except RuntimeError:
    print("PASS: downgrade refuses to remove existing cash workspaces")
else:
    raise AssertionError("Destructive downgrade was not refused")
engine.dispose()
