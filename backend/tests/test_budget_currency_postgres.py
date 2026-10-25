"""Real PostgreSQL races between budget review and the legacy budget editor."""

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import text
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db
from app.models.budget import Budget
from app.services import finance_reads
from .test_finance_integration import client, configuration, database, setup

# Imported fixtures are collected intentionally.
# ruff: noqa: F401, F811
pytestmark = pytest.mark.skipif(not os.environ.get("AEGIS_CASH_TEST_DATABASE_URL"), reason="Genuine PostgreSQL contention required")


def seed(client):
    headers, owner, _ = setup(client)
    def insert(db):
        assert db.get_bind().dialect.name == "postgresql"
        row = Budget(user_id=owner, name="Concurrent food", amount=Decimal("1000.00"), category="food",
                     period_start=date(2026, 10, 1), period_end=date(2026, 10, 31))
        db.add(row)
        db.flush()
        report = finance_reads.budget_report(db, owner, row)
        db.commit()
        return report
    return headers, owner, database(insert)


def wait_for_blocked(engine, blocking_pid):
    deadline = time.monotonic() + 4
    # pg_stat_activity snapshots are cached within a transaction. Autocommit
    # lets each poll observe the newly opened competing backend rather than
    # keeping the pre-request statistics snapshot for the entire wait.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        while time.monotonic() < deadline:
            blocked = connection.execute(text("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND :pid = ANY(pg_blocking_pids(pid))"), {"pid": blocking_pid}).scalar_one()
            if blocked:
                return
            time.sleep(.05)
    raise AssertionError("No genuine PostgreSQL lock wait was observed")


def test_legacy_budget_edit_commits_before_review_and_old_facts_reject(client):
    headers, owner, report = seed(client)
    generator = app.dependency_overrides[get_db]()
    writer = next(generator)
    writer.execute(text("SET LOCAL statement_timeout='5s'"))
    writer_pid = writer.execute(text("SELECT pg_backend_pid()")).scalar_one()
    row = writer.query(Budget).filter_by(id=report["id"]).with_for_update().one()
    row.amount = Decimal("2000.00")
    writer.flush()
    engine = writer.get_bind()

    def confirm():
        with TestClient(app) as separate_request:
            return separate_request.post(f"/api/finance/budgets/{report['id']}/confirm-currency", headers=headers,
                                         json={"currency": "THB", "reviewed": True, "expected_facts_hash": report["facts_hash"]})
    try:
        with ThreadPoolExecutor(1) as pool:
            pending = pool.submit(confirm)
            try:
                wait_for_blocked(engine, writer_pid)
            finally:
                writer.commit()
            response = pending.result(timeout=10)
            assert response.status_code == 409, response.text
        current = client.get("/api/finance/budgets", headers=headers).json()[0]
        assert current["budget_currency_confirmed"] is False
    finally:
        writer.rollback()
        generator.close()


def test_review_holds_limit_row_until_audit_and_later_edit_invalidates_it(client, monkeypatch):
    headers, owner, report = seed(client)
    locked, release = threading.Event(), threading.Event()
    held_pid = []
    original = finance_reads.confirm_currency

    def hold(db, owner_id, kind, row):
        held_pid.append(db.execute(text("SELECT pg_backend_pid()")).scalar_one())
        locked.set()
        assert release.wait(6), "The bounded review barrier was not released"
        return original(db, owner_id, kind, row)
    monkeypatch.setattr(finance_reads, "confirm_currency", hold)

    def confirm():
        with TestClient(app) as request:
            return request.post(f"/api/finance/budgets/{report['id']}/confirm-currency", headers=headers,
                                json={"currency": "THB", "reviewed": True, "expected_facts_hash": report["facts_hash"]})

    def legacy_edit():
        def mutate(db):
            db.execute(text("SET LOCAL lock_timeout='5s'"))
            row = db.query(Budget).filter_by(id=report["id"], user_id=owner).one()
            row.amount = Decimal("2000.00")
            db.commit()
        database(mutate)

    with ThreadPoolExecutor(2) as pool:
        reviewed = pool.submit(confirm)
        assert locked.wait(5)
        editor = pool.submit(legacy_edit)
        try:
            engine = database(lambda db: db.get_bind())
            wait_for_blocked(engine, held_pid[0])
            assert not editor.done()
        finally:
            release.set()
        response = reviewed.result(timeout=10)
        editor.result(timeout=10)
        assert response.status_code == 200, response.text
    current = client.get("/api/finance/budgets", headers=headers).json()[0]
    assert current["budget_currency_confirmed"] is False
    assert current["unverified_legacy_budget_amount"] == "2000.00"
