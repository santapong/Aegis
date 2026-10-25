"""Real PostgreSQL rehearsal for the explicit cloud release schema gate."""
import json
import importlib.util
import os
from pathlib import Path
import subprocess
import sys

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

BACKEND = Path(__file__).resolve().parents[1]
HEAD = "a1022lf00001"
OLD = "d5e9a37b2c81"


@pytest.fixture
def release_database():
    url = os.environ.get("AEGIS_RELEASE_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Dedicated real PostgreSQL release database required")
    parsed = make_url(url)
    assert parsed.host in {"127.0.0.1", "localhost"} and parsed.database == "aegis_release_test"
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP SCHEMA public CASCADE")
        connection.exec_driver_sql("CREATE SCHEMA public")
    env = {**os.environ, "DATABASE_URL": url, "DEBUG": "true",
           "JWT_SECRET_KEY": "fictional-release-rehearsal-key-0000000000000000000"}
    env.pop("DATABASE_URL_UNPOOLED", None)
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", OLD], cwd=BACKEND, env=env, check=True, capture_output=True, timeout=60)
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO users(id,email,username,hashed_password,is_active,created_at,updated_at) VALUES ('release-owner','release@example.invalid','release-owner','fictional-only',true,now(),now())")
        connection.exec_driver_sql("INSERT INTO transactions(id,user_id,amount,type,category,date,description,created_at,is_recurring) VALUES ('release-record','release-owner',123.45,'expense','Food','2026-10-20','Fictional preserved record',now(),false)")
    try:
        yield engine, env
    finally:
        engine.dispose()


def run_gate(env, *, target="", environment="production"):
    values = {**env, "VERCEL_ENV": environment, "AEGIS_RELEASE_SCHEMA_TARGET": target}
    process = subprocess.run([sys.executable, "scripts/release_schema.py"], cwd=BACKEND, env=values, capture_output=True, text=True, timeout=135)
    lines = [line for line in process.stdout.splitlines() if line.startswith("AEGIS_RELEASE_SCHEMA ")]
    assert lines, process.stderr[-1000:]
    return process.returncode, json.loads(lines[-1].split(" ", 1)[1])


def test_release_schema_gate_preserves_rows_and_is_idempotent(release_database):
    engine, env = release_database
    code, result = run_gate(env)
    assert code == 2 and result["status"] == "blocked"
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == OLD
    code, result = run_gate(env, target=HEAD)
    assert code == 0 and result["migrated"] and result["legacy_data_preserved"]
    with engine.connect() as connection:
        row = connection.exec_driver_sql("SELECT amount,description,workspace_id,migrated_journal_id FROM transactions WHERE id='release-record'").one()
        assert str(row[0]) == "123.45" and row[1] == "Fictional preserved record"
        assert row[2:] == (None, None)
        assert connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == HEAD
    assert run_gate(env, target=HEAD)[1] == {"status": "ready", "revision": HEAD, "migrated": False}
    assert run_gate(env)[0] == 0


def test_release_schema_refuses_preview_and_wrong_head(release_database):
    engine, env = release_database
    assert run_gate(env, target=HEAD, environment="preview")[0] == 2
    assert run_gate(env, target="unreviewed-head")[0] == 2
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == OLD


def test_release_schema_refuses_another_owner_of_migration_lock(release_database):
    engine, env = release_database
    with engine.begin() as connection:
        connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": 285910351501})
        assert run_gate(env, target=HEAD)[0] == 2
        assert connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == OLD
    assert run_gate(env, target=HEAD)[0] == 0


def test_release_schema_rolls_back_failed_preservation_check(release_database, monkeypatch):
    engine, env = release_database
    for name in ["DATABASE_URL", "DEBUG", "JWT_SECRET_KEY"]:
        monkeypatch.setenv(name, env[name])
    monkeypatch.delenv("DATABASE_URL_UNPOOLED", raising=False)
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("AEGIS_RELEASE_SCHEMA_TARGET", HEAD)
    spec = importlib.util.spec_from_file_location("release_schema_under_test", BACKEND / "scripts/release_schema.py")
    gate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gate)
    upgrade = gate.command.upgrade

    def changed_record(config, target):
        upgrade(config, target)
        config.attributes["connection"].exec_driver_sql("UPDATE transactions SET amount=999 WHERE id='release-record'")

    monkeypatch.setattr(gate.command, "upgrade", changed_record)
    with pytest.raises(RuntimeError, match="preservation"):
        gate.main()
    with engine.connect() as connection:
        assert connection.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one() == OLD
        assert str(connection.exec_driver_sql("SELECT amount FROM transactions WHERE id='release-record'").scalar_one()) == "123.45"
        assert connection.exec_driver_sql("SELECT to_regclass('finance_journal_entries')").scalar_one() is None
