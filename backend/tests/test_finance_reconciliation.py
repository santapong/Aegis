"""Importing and reconciling bank evidence never silently posts money."""
# Imported pytest fixtures are deliberately referenced through fixture injection.
# ruff: noqa: F811

import copy

import pytest
from fastapi import HTTPException

from app.models.finance_ledger import JournalEntry, LedgerDraft
from app.models.finance_reconciliation import StatementImport, StatementLine
from app.services import finance_reconciliation as statements, money_ledger as ledger
from .test_finance_reads import ledger_db, post  # noqa: F401


def statement(account):
    return {"account_id": account, "request_key": "statement-import-1", "period_start": "2026-01-01", "period_end": "2026-01-31",
            "opening_balance_minor": "100000", "closing_balance_minor": "85000", "rows": [
                {"stable_key": "issuer-row-1", "occurred_on": "2026-01-02", "amount_minor": "-15000", "description": "Food", "status": "posted"},
                {"stable_key": "issuer-pending-1", "occurred_on": "2026-01-03", "amount_minor": "-2000", "description": "Authorization", "status": "pending"}]}


def test_import_idempotency_match_and_pending_not_double_deducted(ledger_db):
    db, owner, account = ledger_db
    journal = post(db, owner, account, "expense", "15000")
    before = db.query(JournalEntry).count()
    result = statements.import_statement(db, owner, statement(account))
    db.commit()
    assert result["difference_minor"] == "0"
    assert result["statement_arithmetic_difference_minor"] == "0"
    row = next(r for r in result["rows"] if r["status"] == "posted")
    assert row["candidate_journal_ids"] == [journal]
    assert not result["reconciled"]
    assert statements.import_statement(db, owner, statement(account))["id"] == result["id"]
    replay = statement(account)
    replay["request_key"] = "another-import-key"
    assert statements.import_statement(db, owner, replay)["id"] == result["id"]
    from app.services.money_ledger import MoneyError
    replay["closing_balance_minor"] = "1"
    with pytest.raises(MoneyError) as conflict:
        statements.import_statement(db, owner, replay)
    assert conflict.value.code == "IDEMPOTENCY_CONFLICT"
    matched = statements.match(db, owner, result["id"], row["id"], journal)
    assert matched["reconciled"]
    status = statements.reconciliation_status(db, owner, account)
    assert status["as_of"] == "2026-01-31" and status["settlement_verified"] is False
    assert db.query(JournalEntry).count() == before and db.query(StatementImport).count() == 1
    pending = next(r for r in result["rows"] if r["status"] == "pending")
    with pytest.raises(HTTPException):
        statements.match(db, owner, result["id"], pending["id"], journal)


def test_changed_key_body_cross_owner_and_repeated_row_guard(ledger_db):
    db, owner, account = ledger_db
    result = statements.import_statement(db, owner, statement(account))
    db.commit()
    changed = statement(account)
    changed["closing_balance_minor"] = "1"
    with pytest.raises((HTTPException, ledger.MoneyError)) as error:
        statements.import_statement(db, owner, changed)
    assert getattr(error.value, "status_code", getattr(error.value, "status", None)) == 409
    with pytest.raises(HTTPException):
        statements.review(db, "another-owner", result["id"])
    changed["request_key"] = "different-import-key"
    changed["rows"][0]["amount_minor"] = "-25000"
    with pytest.raises(HTTPException):
        statements.import_statement(db, owner, changed)
    db.rollback()
    assert db.query(StatementImport).count() == 1 and db.query(StatementLine).count() == 2


def test_unmatched_difference_then_explicit_draft_and_confirmation(ledger_db):
    db, owner, account = ledger_db
    result = statements.import_statement(db, owner, statement(account))
    row = next(r for r in result["rows"] if r["status"] == "posted")
    assert result["difference_minor"] == "-15000"
    assert db.query(LedgerDraft).count() == 0
    draft = statements.row_draft(db, owner, result["id"], row["id"], {"type": "expense", "category": "food"})
    again = statements.row_draft(db, owner, result["id"], row["id"], {"type": "expense", "category": "food"})
    assert draft["id"] == again["id"] and db.query(LedgerDraft).count() == 1
    assert ledger.balances(db, owner)["net_position_minor"] == "100000"
    confirmed = ledger.confirm_draft(db, owner, draft["id"], draft["version"], "statement-confirm")
    result = statements.match(db, owner, result["id"], row["id"], confirmed["journal_id"])
    db.commit()
    assert result["reconciled"]


def test_known_match_requires_review_before_new_draft(ledger_db):
    db, owner, account = ledger_db
    post(db, owner, account, "expense", "15000")
    result = statements.import_statement(db, owner, statement(account))
    row = next(r for r in result["rows"] if r["status"] == "posted")
    with pytest.raises(HTTPException) as error:
        statements.row_draft(db, owner, result["id"], row["id"], {"type": "expense"})
    assert error.value.status_code == 409
    draft = statements.row_draft(db, owner, result["id"], row["id"], {"type": "expense", "keep_distinct": True})
    assert draft["status"] == "pending"


def test_overlapping_import_reuses_stable_row_without_duplicate_effect(ledger_db):
    db, owner, account = ledger_db
    original = statement(account)
    first = statements.import_statement(db, owner, original)
    overlapping = copy.deepcopy(original)
    overlapping["request_key"] = "overlapping-key"
    overlapping["rows"].append({"stable_key": "different-equal-payment", "occurred_on": "2026-01-02", "amount_minor": "-15000", "description": "Another food", "status": "posted"})
    overlapping["closing_balance_minor"] = "70000"
    second = statements.import_statement(db, owner, overlapping)
    assert first["id"] != second["id"] and len(second["rows"]) == 3
    assert db.query(StatementLine).count() == 3


def test_missing_opening_is_unknown_not_zero_reconciled(ledger_db):
    db, owner, _ = ledger_db
    account = ledger.create_account(db, owner, {"name": "No snapshot", "subtype": "bank"}, "no-snapshot")["id"]
    payload = statement(account)
    payload["opening_balance_minor"] = "0"
    payload["closing_balance_minor"] = "0"
    payload["rows"] = [payload["rows"][1]]
    result = statements.import_statement(db, owner, payload)
    assert result["tracked_closing_balance_minor"] is None
    assert result["difference_minor"] is None
    assert result["opening_available"] is False and result["reconciled"] is False
