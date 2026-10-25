"""Disposable migration, database/evidence backup and restoration rehearsal.

Only an ephemeral home-filesystem SQLite directory and uniquely named databases
inside the explicitly selected local test container are permitted. No .env file,
real LINE account, provider key, public endpoint or existing database is used.
"""

import argparse
import hashlib
import io
import json
import os
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
import time
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PREDECESSOR = "a1002cf00004"
HEAD = "a1022lf00001"
CONTAINER = "aegis-ledger-test-20261022"


def sha(content):
    return hashlib.sha256(content).hexdigest()


def serial(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(type(value).__name__)


def stable(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=serial)


def private(path, directory=False):
    os.chmod(path, 0o700 if directory else 0o600)
    expected = 0o700 if directory else 0o600
    assert stat.S_IMODE(path.stat().st_mode) == expected, "Private fixture permissions were not honored"


def run(command, *, cwd, env=None, input_bytes=None, expected=0):
    result = subprocess.run(command, cwd=cwd, env=env, input=input_bytes, capture_output=True)
    if result.returncode != expected:
        # Commands and output contain fictional values only. Never echo URLs.
        raise RuntimeError("Fixture command failed: " + " ".join(command[:3]) + "\n" + result.stderr.decode(errors="replace")[-5000:])
    return result


def environment(url):
    return {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "LANG": "C.UTF-8",
        "PYTHONPATH": str(ROOT / "backend"),
        "DATABASE_URL": url,
        "JWT_SECRET_KEY": "fictional-rehearsal-only-signing-material-never-used-externally",
        "DEBUG": "true",
        "FINANCE_LEDGER_ENABLED": "true",
        "FINANCE_INTEGRATION_DELIVERY_ENABLED": "false",
        "ANTHROPIC_API_KEY": "",
        "OPENAI_API_KEY": "",
        "GROQ_API_KEY": "",
        "TYPHOON_API_KEY": "",
        "LINE_FINANCE_CHANNEL_SECRET": "",
        "LINE_FINANCE_ACCESS_TOKEN": "",
        "FINANCE_INTEGRATION_OCR_KEY": "",
        "FINANCE_INTEGRATION_SERVICE_TOKEN": "",
        "FINANCE_INTEGRATION_DELIVERY_TOKEN": "",
    }


def migrate(url, work, direction, revision):
    return run([sys.executable, "-m", "alembic", "-c", str(ROOT / "backend/alembic.ini"), direction, revision],
               cwd=work, env=environment(url))


def engine_for(url):
    from sqlalchemy import create_engine, event

    engine = create_engine(url)
    if engine.dialect.name == "sqlite":
        @event.listens_for(engine, "connect")
        def enforce_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    return engine


def predecessor_fixture(engine):
    from sqlalchemy import MetaData

    uid, tid, tagid, txid = [str(uuid.uuid4()) for _ in range(4)]
    now = datetime(2026, 10, 18, 5, 0)
    metadata = MetaData()
    metadata.reflect(engine)
    with engine.begin() as connection:
        connection.execute(metadata.tables["users"].insert().values(id=uid, email="migration-fixture@example.invalid", username="migration-fixture", hashed_password="fictional-unusable-password-hash", is_active=True, created_at=now, updated_at=now))
        connection.execute(metadata.tables["trips"].insert().values(id=tid, user_id=uid, title="Fictional migration trip", destination="Fixture town", start_date=date(2026,10,18), end_date=date(2026,10,25), total_budget=Decimal("1234.56"), status="planned", created_at=now))
        connection.execute(metadata.tables["tags"].insert().values(id=tagid, user_id=uid, name="fictional-rehearsal", color="#aabbcc", created_at=now))
        connection.execute(metadata.tables["transactions"].insert().values(id=txid, user_id=uid, trip_id=tid, amount=Decimal("150.25"), type="expense", category="rehearsal-food", date=date(2026,10,19), description="Preserve exact legacy value and trip/tag links", created_at=now, is_recurring=False))
        connection.execute(metadata.tables["transaction_tags"].insert().values(transaction_id=txid, tag_id=tagid))
    return uid


def snapshot(engine):
    from sqlalchemy import MetaData

    metadata = MetaData()
    metadata.reflect(engine)
    result = {}
    with engine.connect() as connection:
        for name, table in sorted(metadata.tables.items()):
            result[name] = sorted([dict(row) for row in connection.execute(table.select()).mappings()], key=stable)
    return result


def preserved(before, after):
    for name, rows in before.items():
        if name == "alembic_version":
            continue
        columns = set(rows[0]) if rows else set()
        projected = [{key: row[key] for key in columns} for row in after[name]]
        assert stable(sorted(projected, key=stable)) == stable(rows), "Legacy values or links changed: " + name


def evidence_inventory(engine, evidence_dir):
    from sqlalchemy import text

    result = []
    with engine.connect() as connection:
        for row in connection.execute(text("SELECT id,storage_key,mime,size,sha256 FROM finance_evidence ORDER BY id")).mappings():
            path = evidence_dir / row["storage_key"]
            assert not path.is_symlink() and path.is_file()
            content = path.read_bytes()
            assert sha(content) == row["sha256"] and len(content) == row["size"]
            assert stat.S_IMODE(path.stat().st_mode) == 0o600
            result.append(dict(row))
    assert stat.S_IMODE(evidence_dir.stat().st_mode) == 0o700
    return result


def ledger_fixture(engine, owner, evidence_dir):
    from PIL import Image
    from sqlalchemy.orm import Session
    from app.config import get_settings
    from app.models.finance_integration import FinanceLineIdentity
    from app.services import money_ledger as ledger, finance_integration as integration

    settings = get_settings()
    settings.finance_ledger_enabled = True
    settings.finance_integration_delivery_enabled = False
    settings.finance_integration_evidence_dir = str(evidence_dir)
    image = io.BytesIO()
    Image.new("RGB", (4,4), (205,175,90)).save(image, format="PNG")
    image_bytes = image.getvalue()
    with Session(engine) as db:
        bank = ledger.create_account(db, owner, {"name": "Fictional bank", "subtype": "bank"}, "rehearsal-bank")["id"]
        ledger.create_openings(db, owner, {"reviewed": True, "cutoff_at": "2026-10-18T12:00:00+07:00", "accounts": [{"account_id": bank, "signed_balance_minor": "2000000"}]}, "rehearsal-opening")
        identity = FinanceLineIdentity(id=str(uuid.uuid4()), owner_id=owner, channel_id=settings.line_finance_channel_id, actor_id="fictional-private-rehearsal-actor")
        db.add(identity)
        db.commit()
        integration.accept_event(db, {"webhookEventId": "fictional-media-event", "type": "message", "source": {"type": "user", "userId": identity.actor_id}, "message": {"type": "image", "id": "fictional-media-123"}})
        db.commit()
        lease = integration.claim(db, ["capture"])
        assert lease is not None
        db.commit()
        captured = integration.capture_bytes(db, lease["id"], lease["lease_token"], lease["generation"], image_bytes, "image/png")
        db.commit()
        draft = ledger.create_draft(db, owner, {"type": "expense", "amount_minor": "15025", "currency": "THB", "occurred_on": "2026-10-19", "source_account_id": bank, "category": "rehearsal-food", "description": "Fictional evidence-linked restoration payment", "evidence_ids": [captured["evidence_id"]]})
        assert not draft["validation_errors"]
        result = ledger.confirm_draft(db, owner, draft["id"], draft["version"], "rehearsal-confirmation")
        db.commit()
    return {"owner": owner, "draft_id": draft["id"], "version": draft["version"], "journal_id": result["journal_id"],
            "lease": lease, "image_bytes": image_bytes, "captured": captured}


def semantic_snapshot(engine, owner):
    from sqlalchemy import text
    from sqlalchemy.orm import Session
    from app.services import money_ledger as ledger

    with Session(engine) as db:
        balances = ledger.balances(db, owner)
        transactions = ledger.financial_transactions(db, owner)
        postings = [list(row) for row in db.execute(text("SELECT journal_id,account_id,amount_minor FROM ledger_postings ORDER BY journal_id,account_id,amount_minor"))]
        assert all(int(row[1]) == 0 and int(row[2]) >= 2 for row in db.execute(text("SELECT journal_id,SUM(amount_minor),COUNT(*) FROM ledger_postings GROUP BY journal_id")))
    return {"balances": balances, "financial_transactions": transactions, "postings": postings}


def postgres_command(container, database, executable, *extra, input_bytes=None):
    command = ["docker", "exec"]
    if input_bytes is not None:
        command.append("-i")
    command += [container, executable, "-U", "aegis_test", "-d", database, *extra]
    return run(command, cwd=ROOT, input_bytes=input_bytes)


def rehearse(mode, work, container, port, created_databases):
    started = time.monotonic()
    backend = work / mode
    backend.mkdir()
    private(backend, True)
    evidence = backend / "source-evidence"
    restored_evidence = backend / "restored-evidence"
    backup = backend / "backup"
    backup.mkdir()
    private(backup, True)
    if mode == "sqlite":
        source_path, restored_path = backend / "source.sqlite", backend / "restored.sqlite"
        source_url, restored_url = "sqlite:///" + str(source_path), "sqlite:///" + str(restored_path)
    else:
        suffix = uuid.uuid4().hex[:12]
        source_name, restored_name = "aegis_ledger_rehearsal_" + suffix, "aegis_ledger_restore_" + suffix
        for name in (source_name, restored_name):
            assert name.startswith(("aegis_ledger_rehearsal_", "aegis_ledger_restore_"))
            postgres_command(container, "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-c", 'CREATE DATABASE "' + name + '"')
            created_databases.append(name)
        base = "postgresql://aegis_test:aegis_test_only@127.0.0.1:" + str(port) + "/"
        source_url, restored_url = base + source_name, base + restored_name
    migrate(source_url, work, "upgrade", PREDECESSOR)
    source = engine_for(source_url)
    owner = predecessor_fixture(source)
    legacy = snapshot(source)
    migrate(source_url, work, "upgrade", HEAD)
    preserved(legacy, snapshot(source))
    migrate(source_url, work, "downgrade", PREDECESSOR)
    preserved(legacy, snapshot(source))
    migrate(source_url, work, "upgrade", HEAD)
    preserved(legacy, snapshot(source))
    fixture = ledger_fixture(source, owner, evidence)
    source_rows = snapshot(source)
    source_semantics = semantic_snapshot(source, owner)
    source_inventory = evidence_inventory(source, evidence)
    downgrade = subprocess.run([sys.executable, "-m", "alembic", "-c", str(ROOT / "backend/alembic.ini"), "downgrade", PREDECESSOR], cwd=work, env=environment(source_url), capture_output=True)
    assert downgrade.returncode != 0 and b"preserve additive schema" in downgrade.stderr, "A populated financial downgrade was not explicitly refused"
    assert stable(source_rows) == stable(snapshot(source)), "Refused downgrade changed data"
    # Database snapshot first; immutable evidence copy second. Writers and
    # retention are deliberately quiescent throughout this fixture.
    backup_started = time.monotonic()
    if mode == "sqlite":
        dump_path = backup / "database.sqlite"
        with sqlite3.connect(source_path) as src, sqlite3.connect(dump_path) as dst:
            src.backup(dst)
        private(dump_path)
        shutil.copy2(dump_path, restored_path)
        private(restored_path)
    else:
        dump_path = backup / "database.dump"
        dump = postgres_command(container, source_name, "pg_dump", "--format=custom", "--no-owner", "--no-acl")
        dump_path.write_bytes(dump.stdout)
        private(dump_path)
        postgres_command(container, restored_name, "pg_restore", "--no-owner", "--no-acl", "--exit-on-error", input_bytes=dump_path.read_bytes())
    shutil.copytree(evidence, backup / "evidence", copy_function=shutil.copy2)
    shutil.copytree(backup / "evidence", restored_evidence, copy_function=shutil.copy2)
    private(restored_evidence, True)
    restored = engine_for(restored_url)
    restored_rows = snapshot(restored)
    assert stable(source_rows) == stable(restored_rows), "Restored database rows differ"
    assert stable(source_semantics) == stable(semantic_snapshot(restored, owner)), "Restored journal projections or balances differ"
    assert stable(source_inventory) == stable(evidence_inventory(restored, restored_evidence)), "Restored private evidence inventory differs"
    from sqlalchemy.orm import Session
    from app.config import get_settings
    from app.services import money_ledger as ledger, finance_integration as integration
    get_settings().finance_integration_evidence_dir = str(restored_evidence)
    with Session(restored) as db:
        replayed = ledger.confirm_draft(db, owner, fixture["draft_id"], fixture["version"], "rehearsal-confirmation")
        assert replayed["replayed"] and replayed["journal_id"] == fixture["journal_id"]
        lease = fixture["lease"]
        assert integration.capture_bytes(db, lease["id"], lease["lease_token"], lease["generation"], fixture["image_bytes"], "image/png") == fixture["captured"]
        db.commit()
    assert stable(source_rows) == stable(snapshot(restored)), "Restored retries changed persisted rows"
    if mode == "sqlite":
        with restored.connect() as connection:
            assert not connection.exec_driver_sql("PRAGMA foreign_key_check").all()
        private(source_path)
    result = {"backend": mode, "predecessor": PREDECESSOR, "head": HEAD,
              "populated_legacy_preserved": True, "unused_downgrade_reupgrade_passed": True, "posted_downgrade_refused_without_changes": True,
              "all_table_rows_equal_after_restore": True, "postings_balances_projections_equal": True, "idempotency_replay_no_effect": True,
              "captured_evidence_replay_no_effect": True, "private_evidence_sha_inventory_equal": True,
              "table_counts": {name: len(rows) for name, rows in source_rows.items()},
              "ledger_balance_minor": source_semantics["balances"]["net_position_minor"],
              "evidence_inventory": source_inventory, "database_backup_sha256": sha(dump_path.read_bytes()),
              "database_snapshot_sha256": sha(stable(source_rows).encode()), "semantic_snapshot_sha256": sha(stable(source_semantics).encode()),
              "backup_and_restore_seconds": round(time.monotonic()-backup_started, 3),
              "total_seconds": round(time.monotonic()-started, 3), "backup_encryption": "fictional fixture only; production encryption not configured", "cleanup": "pending"}
    source.dispose()
    restored.dispose()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--postgres-container", default=CONTAINER)
    parser.add_argument("--postgres-port", type=int, default=56422)
    parser.add_argument("--sqlite-only", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    assert args.postgres_container == CONTAINER and args.postgres_port == 56422, "Only the explicit disposable local fixture container is allowed"
    os.umask(0o077)
    manifest_paths = [Path(__file__).resolve(), ROOT / "backend/alembic/versions/a1022lf00001_exact_money_ledger_and_durable_line_.py",
                      *sorted((ROOT / "backend/app/models").glob("finance_*.py")), ROOT / "backend/app/services/money_ledger.py", ROOT / "backend/app/services/finance_integration.py"]
    source_manifest = {str(path.relative_to(ROOT)): sha(path.read_bytes()) for path in manifest_paths}
    created = []
    report = {"status": "running", "checked_at": datetime.now(timezone.utc).isoformat(), "source_manifest": source_manifest, "results": [], "live_data_used": False}
    with tempfile.TemporaryDirectory(prefix="aegis-ledger-rehearsal-", dir=str(Path.home())) as tmp:
        work = Path(tmp)
        private(work, True)
        # Importing application settings from this empty directory cannot read
        # repository or operator .env files. Initial global engine is memory-only.
        os.chdir(work)
        sys.path.insert(0, str(ROOT / "backend"))
        os.environ.update(environment("sqlite:///:memory:"))
        assert not (work / ".env").exists()
        try:
            for mode in (["sqlite"] if args.sqlite_only else ["sqlite", "postgresql"]):
                report["results"].append(rehearse(mode, work, args.postgres_container, args.postgres_port, created))
            assert all(sha(path.read_bytes()) == source_manifest[str(path.relative_to(ROOT))] for path in manifest_paths), "Core source changed during the rehearsal; rerun against stable source"
            report["status"] = "passed"
        except Exception as exc:
            report["status"] = "failed"
            report["failure"] = str(exc)
            raise
        finally:
            for name in reversed(created):
                postgres_command(args.postgres_container, "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-c", 'DROP DATABASE "' + name + '" WITH (FORCE)')
            for result in report["results"]:
                result["cleanup"] = "fixture databases dropped; temporary database/backups/evidence removed"
            report["fixture_databases_dropped"] = len(created)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(json.dumps(report, indent=2, default=serial) + "\n")
    print(json.dumps({"status": report["status"], "backends": [r["backend"] for r in report["results"]], "report": str(output), "fixture_databases_dropped": len(created)}))


if __name__ == "__main__":
    main()
