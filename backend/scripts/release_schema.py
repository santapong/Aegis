"""Explicit production-build schema gate. Never exports connection values."""
import json
import os
from pathlib import Path
import signal
import sys

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool

BACKEND = Path(__file__).resolve().parents[1]
HEAD = "a1022lf00001"
LOCK = 285910351501
LEGACY = ("users", "transactions", "budgets", "trips")


def limits(connection):
    caps = {"statement_timeout": 5000, "lock_timeout": 1000,
            "idle_in_transaction_session_timeout": 10000,
            "work_mem": 4096, "maintenance_work_mem": 32768}
    for name, ceiling in caps.items():
        row = connection.execute(text("SELECT setting::bigint, unit FROM pg_settings WHERE name=:name"), {"name": name}).one()
        value = min(row[0], ceiling) if row[0] else ceiling
        suffix = "kB" if row[1] == "kB" else "ms"
        connection.execute(text("SELECT set_config(:name,:value,true)"), {"name": name, "value": str(value) + suffix})
    connection.exec_driver_sql("SET LOCAL max_parallel_workers_per_gather=0")
    connection.exec_driver_sql("SET LOCAL max_parallel_maintenance_workers=0")


def revision(connection):
    if not connection.exec_driver_sql("SELECT to_regclass('alembic_version') IS NOT NULL").scalar_one():
        raise RuntimeError("Existing Aegis migration history required")
    values = connection.exec_driver_sql("SELECT version_num FROM alembic_version LIMIT 2").scalars().all()
    if len(values) != 1:
        raise RuntimeError("One existing migration head required")
    return values[0]


def snapshots(connection):
    quote = connection.dialect.identifier_preparer.quote
    values = {}
    for table in LEGACY:
        size = connection.execute(text("SELECT pg_total_relation_size(to_regclass(:table))"), {"table": table}).scalar_one()
        if size is None or size > 32 * 1024**2:
            raise RuntimeError("Legacy data size needs a separate migration plan")
        connection.exec_driver_sql("LOCK TABLE " + quote(table) + " IN SHARE MODE")
        count = connection.exec_driver_sql("SELECT count(*) FROM " + quote(table)).scalar_one()
        if count > 100000:
            raise RuntimeError("Legacy row count needs a separate migration plan")
        columns = [column["name"] for column in inspect(connection).get_columns(table)]
        values[table] = (columns, checksum(connection, table, columns))
    return values


def checksum(connection, table, columns):
    quote = connection.dialect.identifier_preparer.quote
    projection = ",".join(quote(column) for column in columns)
    sql = ("SELECT count(*),md5(coalesce(string_agg(md5(row_to_json(s)::text),'' ORDER BY id),'')) "
           "FROM (SELECT " + projection + " FROM " + quote(table) + ") s")
    return tuple(connection.exec_driver_sql(sql).one())


def main():
    target = os.environ.get("AEGIS_RELEASE_SCHEMA_TARGET", "")
    if os.environ.get("VERCEL_ENV") != "production":
        if target:
            raise RuntimeError("Schema migration requires the production build environment")
        return {"status": "skipped", "reason": "not_production"}
    if target and target != HEAD:
        raise RuntimeError("Only the current forward migration head is accepted")
    raw = os.environ["DATABASE_URL"]
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://"):]
    url = make_url(raw)
    if url.get_backend_name() != "postgresql":
        raise RuntimeError("Qualified PostgreSQL required")
    url = url.set(drivername="postgresql+psycopg2")
    direct = os.environ.get("DATABASE_URL_UNPOOLED")
    if direct:
        parsed = make_url(direct.replace("postgres://", "postgresql://", 1))
        if (url.host.replace("-pooler.", ".") == parsed.host
                and url.database == parsed.database and url.username == parsed.username):
            url = parsed.set(drivername="postgresql+psycopg2")
    ssl = url.query.get("sslmode", "require")
    if ssl not in {"require", "verify-ca", "verify-full"}:
        ssl = "require"
    # Local disposable test databases may use their existing loopback connection.
    options = {"connect_timeout": 5}
    if url.host not in {"127.0.0.1", "localhost"}:
        options["sslmode"] = ssl
    engine = create_engine(url, poolclass=NullPool, connect_args=options)
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "alembic"))
    script = ScriptDirectory.from_config(config)
    if script.get_current_head() != HEAD:
        raise RuntimeError("Release script and migration head differ")
    try:
        with engine.begin() as connection:
            if not target:
                connection.exec_driver_sql("SET TRANSACTION READ ONLY")
            limits(connection)
            before = revision(connection)
            allowed = {entry.revision for entry in script.walk_revisions()}
            if before not in allowed:
                raise RuntimeError("Database history is outside this Aegis release")
            if before == HEAD:
                return {"status": "ready", "revision": HEAD, "migrated": False}
            if not target:
                raise RuntimeError("Explicit forward schema migration is required")
            if not connection.execute(text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": LOCK}).scalar_one():
                raise RuntimeError("Another schema operation owns the release lock")
            saved = snapshots(connection)
            # Alembic shares this transaction: any failed check rolls back all DDL.
            config.attributes["connection"] = connection
            os.environ["DATABASE_URL"] = url.render_as_string(hide_password=False)
            os.chdir(BACKEND)
            command.upgrade(config, HEAD)
            if revision(connection) != HEAD:
                raise RuntimeError("Migration did not reach the expected head")
            for table, (columns, expected) in saved.items():
                if checksum(connection, table, columns) != expected:
                    raise RuntimeError("Legacy data preservation check failed")
        return {"status": "ready", "revision": HEAD, "migrated": True, "legacy_data_preserved": True}
    finally:
        engine.dispose()


if __name__ == "__main__":
    signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(RuntimeError("Release schema deadline exceeded")))
    signal.alarm(120)
    try:
        result = main()
        print("AEGIS_RELEASE_SCHEMA " + json.dumps(result), flush=True)
    except Exception as error:
        print("AEGIS_RELEASE_SCHEMA " + json.dumps({"status": "blocked", "error_type": type(error).__name__, "details_redacted": True}), flush=True)
        sys.exit(2)
    finally:
        signal.alarm(0)
