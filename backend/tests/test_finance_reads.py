"""Exact report/cutover semantics, including history that cannot be assumed THB."""

from datetime import date
from decimal import Decimal
import os
import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import User
from app.models.budget import Budget
from app.models.finance_ledger import LedgerOpening
from app.models.finance_reconciliation import StatementImport, StatementLine  # noqa: F401
from app.models.transaction import Transaction, TransactionType
from app.services import finance_reads as reads, money_ledger as ledger
from .test_money_ledger import sessions as migrated_sessions  # noqa: F401

# Imported pytest fixture names are supplied by dependency injection.
# ruff: noqa: F811


@pytest.fixture
def ledger_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    with Session(engine) as db:
        owner = User(email="ledger-report@example.invalid", username="ledger-report", hashed_password="fixture")
        db.add(owner)
        db.flush()
        account = ledger.create_account(db, owner.id, {"name": "Bank", "subtype": "bank"}, "create-bank")
        ledger.create_openings(db, owner.id, {"cutoff_at": "2026-01-01T00:00:00+07:00", "reviewed": True,
                               "accounts": [{"account_id": account["id"], "signed_balance_minor": "100000"}]}, "fixture-open")
        db.commit()
        yield db, owner.id, account["id"]
    engine.dispose()


def post(db, owner, account, kind, amount, **extra):
    payload = {"type": kind, "amount_minor": str(amount), "currency": "THB", "occurred_on": "2026-01-02",
               "category": "food", "description": kind + str(amount), **extra}
    payload["target_account_id" if kind in {"income", "refund"} else "source_account_id"] = account
    draft = ledger.create_draft(db, owner, payload)
    result = ledger.confirm_draft(db, owner, draft["id"], draft["version"], "post-" + draft["id"])
    db.commit()
    return result["journal_id"]


def test_exact_decimal_parser():
    assert reads.exact_minor(Decimal("150.25")) == 15025
    assert reads.exact_minor("92233720368547758.07") == 2**63-1
    for bad in [1.25, "1.001", "NaN", "Infinity", "92233720368547758.08"]:
        with pytest.raises(ValueError):
            reads.exact_minor(bad)


def test_reports_refunds_history_currency_and_replay_dedup(ledger_db):
    db, owner, account = ledger_db
    expense = post(db, owner, account, "expense", "15025")
    post(db, owner, account, "refund", "2025", original_expense_entry_id=expense)
    post(db, owner, account, "income", "50000")
    rows = [Transaction(user_id=owner, amount=Decimal("10.01"), type=TransactionType.expense, category="food", date=date(2026, 1, 2)),
            Transaction(user_id=owner, amount=Decimal("2.00"), type=TransactionType.expense, category="food", date=date(2026, 1, 2), migration_currency="THB"),
            Transaction(user_id=owner, amount=Decimal("150.25"), type=TransactionType.expense, category="food", date=date(2026, 1, 2), migration_currency="THB", migrated_journal_id=expense)]
    db.add_all(rows)
    db.commit()
    result = reads.report(db, owner)
    assert result["income_minor"] == "50000"
    assert result["expense_minor"] == "13200"
    assert result["unverified_legacy_count"] == 1
    assert result["unverified_legacy_history"][0]["amount"] == "10.01"
    assert reads.account_totals(db, owner)["net_position_minor"] == "137000"


def test_zero_opening_still_closes_legacy_writers(ledger_db, monkeypatch):
    db, owner, account = ledger_db
    opening = db.query(LedgerOpening).filter_by(owner_id=owner).one()
    assert reads.cutover_active(db, owner)
    # A zero opening metadata row, without an opening journal, is still cutover.
    opening.journal_id = None
    opening.signed_balance_minor = 0
    db.flush()
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "finance_ledger_enabled", False)
    with pytest.raises(HTTPException) as error:
        reads.guard_legacy_writer(db, owner)
    assert error.value.status_code == 409
    another = User(email="another@example.invalid", username="another", hashed_password="fixture")
    db.add(another)
    db.flush()
    reads.guard_legacy_writer(db, another.id)


def test_budget_uses_own_period_category_and_refund_effect(ledger_db):
    db, owner, account = ledger_db
    expense = post(db, owner, account, "expense", "15000")
    post(db, owner, account, "refund", "5000", original_expense_entry_id=expense)
    budget = Budget(user_id=owner, name="Food", amount=Decimal("200.00"), category="food", period_start=date(2026,1,1), period_end=date(2026,1,31))
    db.add(budget)
    db.flush()
    assert reads.budget_report(db, owner, budget)["budget_minor"] is None
    reads.confirm_currency(db, owner, "budget", budget)
    result = reads.budget_report(db, owner, budget)
    assert result["spent_minor"] == "10000" and result["remaining_minor"] == "10000"
    budget.amount = Decimal("201.00")
    db.flush()
    assert reads.budget_report(db, owner, budget)["budget_minor"] is None
    assert reads.report(db, owner, date(2026,2,1), date(2026,2,28))["expense_minor"] == "0"


def test_projection_mismatch_fails_closed(ledger_db):
    db, owner, account = ledger_db
    post(db, owner, account, "expense", "15000")
    from app.models.finance_ledger import FinancialTransactionProjection
    projection = db.query(FinancialTransactionProjection).filter_by(owner_id=owner, operation_kind="expense").one()
    projection.expense_effect_minor = 1
    db.flush()
    with pytest.raises(HTTPException) as error:
        reads.report(db, owner)
    assert error.value.status_code == 503


def test_http_legacy_writers_close_and_reports_use_exact_canonical_effects(ledger_db, monkeypatch):
    from fastapi.testclient import TestClient
    from app.auth import create_access_token
    from app.config import get_settings
    from app.database import get_db
    from app.main import app

    db, owner, account = ledger_db
    expense = post(db, owner, account, "expense", "15025")
    post(db, owner, account, "refund", "2025", original_expense_entry_id=expense)
    monkeypatch.setattr(get_settings(), "finance_ledger_enabled", True)
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = lambda: db
    try:
        client = TestClient(app)
        headers = {"Authorization": "Bearer " + create_access_token(owner)}
        refused = client.post("/api/transactions/", headers=headers, json={"amount": 1.5, "type": "expense", "category": "food", "date": "2026-01-02"})
        assert refused.status_code == 409
        refused_csv = client.post("/api/transactions/import/confirm", headers=headers, json={"rows": [{"amount": 1.5, "type": "expense", "category": "food", "date": "2026-01-02", "description": None}]})
        assert refused_csv.status_code == 409
        assert db.query(Transaction).filter_by(user_id=owner).count() == 0
        summary = client.get("/api/transactions/summary", headers=headers)
        assert summary.status_code == 200 and summary.json()["total_expenses"] == 130
        exact = client.get("/api/finance/reports", headers=headers)
        assert exact.status_code == 200 and exact.json()["expense_minor"] == "13000"
        export = client.get("/api/reports/export", headers=headers)
        assert export.status_code == 200 and "expense_effect_minor" in export.text and "-2025" in export.text
        dashboard = client.get("/api/dashboard/summary", headers=headers)
        assert dashboard.status_code == 200 and dashboard.json()["balance_basis"] == "net_position"
        assert dashboard.json()["net_position_minor"] == "87000"
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_mcp_writer_refuses_accountless_effect_after_cutover(ledger_db, monkeypatch):
    import asyncio
    from contextlib import contextmanager
    from app.mcp.tools import transactions

    db, owner, account = ledger_db

    @contextmanager
    def scope():
        yield db

    monkeypatch.setattr(transactions, "session_scope", scope)
    monkeypatch.setattr(transactions, "resolve_user_id", lambda: owner)
    with pytest.raises(HTTPException) as error:
        asyncio.run(transactions.create_transaction({"amount": 5.0, "type": "expense", "category": "food", "date": "2026-01-02"}))
    assert error.value.status_code == 409


def test_postgres_opening_and_legacy_writer_share_one_cutover_boundary(migrated_sessions):
    if not os.environ.get("AEGIS_LEDGER_TEST_DATABASE_URL"):
        pytest.skip("Requires actual migrated PostgreSQL row locks")
    import uuid
    with migrated_sessions() as db:
        user = User(email=uuid.uuid4().hex + "@example.invalid", username=uuid.uuid4().hex, hashed_password="fixture")
        db.add(user)
        db.flush()
        owner = user.id
        account = ledger.create_account(db, owner, {"name": "Concurrent bank", "subtype": "bank"}, "concurrent-account")["id"]
        db.commit()
        engine = db.get_bind()
    opened, release, legacy_waiting = threading.Event(), threading.Event(), threading.Event()

    def before_execute(connection, cursor, statement, parameters, context, executemany):
        if connection.info.get("legacy_cutover_test") and "FROM users" in statement and "FOR UPDATE" in statement:
            legacy_waiting.set()

    event.listen(engine, "before_cursor_execute", before_execute)

    def opener():
        with migrated_sessions() as db:
            ledger.create_openings(db, owner, {"reviewed": True, "cutoff_at": "2026-01-01T00:00:00+07:00",
                                   "accounts": [{"account_id": account, "signed_balance_minor": "0"}]}, "concurrent-opening")
            opened.set()
            assert release.wait(10)
            db.commit()

    def legacy_writer():
        with migrated_sessions() as db:
            connection = db.connection()
            connection_info = connection.info
            connection_info["legacy_cutover_test"] = True
            try:
                reads.guard_legacy_writer(db, owner)
                db.add(Transaction(user_id=owner, amount=Decimal("1.00"), type=TransactionType.expense,
                                   category="food", date=date(2026,1,2)))
                db.commit()
                return 201
            except HTTPException as exc:
                db.rollback()
                return exc.status_code
            finally:
                connection_info.pop("legacy_cutover_test", None)

    try:
        with ThreadPoolExecutor(2) as pool:
            opening = pool.submit(opener)
            assert opened.wait(10)
            writer = pool.submit(legacy_writer)
            try:
                assert legacy_waiting.wait(10)
                assert not writer.done()
            finally:
                release.set()
            opening.result(timeout=15)
            assert writer.result(timeout=15) == 409
        with migrated_sessions() as db:
            assert db.query(Transaction).filter_by(user_id=owner).count() == 0
    finally:
        release.set()
        event.remove(engine, "before_cursor_execute", before_execute)
