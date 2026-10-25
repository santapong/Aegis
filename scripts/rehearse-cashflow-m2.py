"""M2 migration and rollback guards on fresh task-local databases only."""

import argparse
import json
import re
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
from app.models.cashflow import (
    CashWorkspace,
    CashAccount,
    CashBalanceAnchor,
    CashSettlement,
)
from app.models.transaction import Transaction, TransactionType
from app.services.cashflow import forecast

p = argparse.ArgumentParser()
p.add_argument("--url", required=True)
a = p.parse_args()
u = make_url(a.url)
if u.get_backend_name() == "sqlite":
    assert (
        Path(u.database).parent == Path("/mnt/data/aegis-m2-2026-10-02")
        and not Path(u.database).exists()
    ), "Fresh task file only"
elif u.get_backend_name() == "postgresql":
    assert (
        u.host == "127.0.0.1"
        and u.port == 5548
        and re.fullmatch(r"aegis_cash_m2_migration_test(?:_r[1-9])?", u.database)
    ), "Dedicated local database only"
    admin = create_engine(u.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        assert not c.execute(
            text("SELECT 1 FROM pg_database WHERE datname=:name"), {"name": u.database}
        ).scalar(), "Fresh database required"
        c.exec_driver_sql(f'CREATE DATABASE "{u.database}"')
    admin.dispose()
else:
    raise ValueError("Unsupported engine")
get_settings().database_url = a.url
root = Path(__file__).resolve().parents[1]
cfg = Config(str(root / "backend/alembic.ini"))
cfg.set_main_option("script_location", str(root / "backend/alembic"))
command.upgrade(cfg, "a1002cf00001")
engine = create_engine(a.url)
uid, wid, aid, cid, oid, tid = [str(uuid.uuid4()) for _ in range(6)]
with Session(engine) as db:
    db.add(
        User(
            id=uid,
            username="M2 migration example",
            email="m2-migration@example.invalid",
            hashed_password="unused",
        )
    )
    db.flush()
    db.add(
        CashWorkspace(
            id=wid,
            user_id=uid,
            name="Preserved M1",
            kind="personal",
            currency="THB",
            timezone="Asia/Bangkok",
            buffer=50,
            revision=1,
            create_key="rehearsal",
            create_hash="rehearsal",
        )
    )
    db.flush()
    db.add(
        CashAccount(id=aid, workspace_id=wid, name="Preserved account", currency="THB")
    )
    db.flush()
    db.add(
        CashBalanceAnchor(
            workspace_id=wid,
            account_id=aid,
            amount=1000,
            date=date(2026, 10, 1),
            source="Reviewed fictional opening",
        )
    )
    db.add(
        Transaction(
            id=tid,
            user_id=uid,
            workspace_id=wid,
            account_id=aid,
            currency="THB",
            amount=60,
            type=TransactionType.expense,
            category="Other",
            date=date(2026, 10, 2),
            description="Preserved partial payment",
        )
    )
    db.commit()
with engine.begin() as c:
    m = MetaData()
    commitment = Table("cash_commitments", m, autoload_with=c)
    occurrence = Table("cash_occurrences", m, autoload_with=c)
    c.execute(
        commitment.insert().values(
            id=cid,
            workspace_id=wid,
            account_id=aid,
            title="Preserved monthly",
            direction="expense",
            amount=100,
            start_date=date(2026, 10, 15),
            end_date=None,
            recurrence="monthly",
            weekend_rule="strict",
            due_date=None,
            cancelled=False,
            source_key=None,
        )
    )
    c.execute(
        occurrence.insert().values(
            id=oid,
            workspace_id=wid,
            commitment_id=cid,
            account_id=aid,
            title="Edited M1 payment",
            direction="expense",
            amount=100,
            nominal_date=date(2026, 10, 15),
            expected_date=date(2026, 10, 16),
            due_date=date(2026, 10, 15),
            cancelled=False,
        )
    )
with Session(engine) as db:
    db.add(
        CashSettlement(
            workspace_id=wid, transaction_id=tid, occurrence_id=oid, amount=60
        )
    )
    db.commit()


def snapshot():
    with engine.connect() as c:
        metadata = MetaData()
        metadata.reflect(bind=c)
        tables = [
            name
            for name in metadata.tables
            if name != "alembic_version"
            and not name.startswith(
                ("cash_import_", "cash_goal_", "cash_installment_", "cash_alert")
            )
        ]
        return {
            name: {
                "columns": list(metadata.tables[name].columns.keys()),
                "rows": [
                    dict(r)
                    for r in c.execute(metadata.tables[name].select()).mappings()
                ],
                "indexes": inspect(c).get_indexes(name),
            }
            for name in tables
        }


before = snapshot()


def preserved():
    after = snapshot()
    for name, old in before.items():
        actual = [{k: r[k] for k in old["columns"]} for r in after[name]["rows"]]
        assert sorted(map(str, actual)) == sorted(map(str, old["rows"])), name
        assert [i for i in old["indexes"] if not i.get("duplicates_constraint")] == [
            i for i in after[name]["indexes"] if not i.get("duplicates_constraint")
        ], name
    with engine.connect() as c:
        if u.get_backend_name() == "sqlite":
            assert not c.exec_driver_sql("PRAGMA foreign_key_check").all()
    with Session(engine) as db:
        result = forecast(
            db, db.get(CashWorkspace, wid), date(2026, 10, 2), date(2026, 10, 31)
        )["base"]
        assert (
            result["cash_today"] == "940.00" and result["closing_cash"] == "900.00"
        ), result
        assert db.get(CashSettlement, db.query(CashSettlement).first().id).amount == 60


command.upgrade(cfg, "a1002cf00002")
command.upgrade(cfg, "a1002cf00002")
preserved()
command.downgrade(cfg, "a1002cf00001")
command.upgrade(cfg, "a1002cf00002")
preserved()
with engine.begin() as c:
    table = Table("cash_import_batches", MetaData(), autoload_with=c)
    c.execute(
        table.insert().values(
            id=str(uuid.uuid4()),
            workspace_id=wid,
            account_id=aid,
            filename="guard.csv",
            currency="THB",
            content_hash="guard",
            created_at=datetime.utcnow(),
        )
    )
try:
    command.downgrade(cfg, "a1002cf00001")
except RuntimeError as e:
    assert "M2 review/history exists" in str(e)
else:
    raise AssertionError("Destructive M2 downgrade not refused")
preserved()
with engine.connect() as c:
    assert (
        c.execute(text("SELECT version_num FROM alembic_version")).scalar()
        == "a1002cf00002"
    )
print(
    json.dumps(
        {
            "engine": u.get_backend_name(),
            "populated_m1_ids_values_matches_indexes_preserved": True,
            "repeat_upgrade": True,
            "unused_m2_downgrade_reupgrade": True,
            "populated_m2_downgrade_refused": True,
            "cash_today": "940.00",
            "closing_cash": "900.00",
        }
    )
)
engine.dispose()
