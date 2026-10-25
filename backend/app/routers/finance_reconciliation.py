"""Canonical reports and reviewed statement reconciliation for the ledger."""

import csv
import io
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import get_settings
from ..database import get_db
from ..models.budget import Budget
from ..models.trip import Trip
from ..models.transaction import Transaction
from ..models.user import User
from ..services import finance_reads, finance_reconciliation


def enabled(db: Session = Depends(get_db)):
    if not get_settings().finance_ledger_enabled:
        raise HTTPException(404, "Financial ledger is not enabled")
    if db.get_bind().dialect.name not in {"sqlite", "postgresql"}:
        raise HTTPException(503, "The financial ledger requires qualified PostgreSQL or SQLite")


router = APIRouter(prefix="/api/finance", tags=["finance-reconciliation"], dependencies=[Depends(enabled)])


class StatementRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stable_key: str = Field(min_length=1, max_length=128)
    occurred_on: date
    amount_minor: str
    status: Literal["posted", "pending"] = "posted"
    reference: str = Field(default="", max_length=160)
    description: str = Field(default="", max_length=500)


class StatementBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: str
    request_key: str = Field(min_length=8, max_length=80)
    period_start: date
    period_end: date
    opening_balance_minor: str
    closing_balance_minor: str
    rows: list[StatementRow] = Field(min_length=1, max_length=1000)


class MatchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    journal_id: str


class RowDraftBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["income", "expense", "transfer", "card_purchase", "card_repayment", "refund"]
    keep_distinct: bool = False
    counterparty_account_id: str | None = None
    original_expense_entry_id: str | None = None
    category: str = Field(default="uncategorized", max_length=100)


class LegacyCurrencyBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transaction_ids: list[str] = Field(min_length=1, max_length=500)
    confirmed_currency: Literal["THB"]
    reviewed: bool


class CurrencyConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    currency: Literal["THB"]
    reviewed: bool
    expected_facts_hash: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")


@router.get("/reports")
def reports(start: date | None = None, end: date | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if start and end and start > end:
        raise HTTPException(422, "Report period is reversed")
    return finance_reads.report(db, user.id, start, end)


@router.get("/legacy/history")
def legacy_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [{"id": row.id, "amount": str(row.amount), "type": row.type.value, "occurred_on": str(row.date),
             "category": row.category, "description": row.description, "confirmed_currency": row.migration_currency,
             "nonposting_history": row.nonposting_history, "migrated_journal_id": row.migrated_journal_id}
            for row in db.query(Transaction).filter_by(user_id=user.id).order_by(Transaction.date, Transaction.id)]


@router.post("/legacy/confirm-currency")
def confirm_legacy_currency(body: LegacyCurrencyBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..services.money_ledger import lock_owner
    from ..models.finance_ledger import LedgerAudit
    from ..cache import invalidate_user_all

    if not body.reviewed or len(set(body.transaction_ids)) != len(body.transaction_ids):
        raise HTTPException(422, "Review each distinct historical row and explicitly confirm its actual THB currency")
    try:
        lock_owner(db, user.id)
        rows = db.query(Transaction).filter(Transaction.user_id == user.id, Transaction.id.in_(body.transaction_ids)).with_for_update().all()
        if len(rows) != len(body.transaction_ids):
            raise HTTPException(404, "Historical record not found")
        if any(row.migration_currency not in {None, "THB"} for row in rows):
            raise HTTPException(409, "A historical currency was already confirmed differently; review a correction")
        for row in rows:
            finance_reads.exact_minor(row.amount)
            row.migration_currency = "THB"
            row.nonposting_history = True
            db.add(LedgerAudit(owner_id=user.id, operation="legacy_currency_confirmed", resource_id=row.id,
                               details={"currency": "THB", "nonposting_history": True}))
        db.commit()
        invalidate_user_all(user.id)
        return {"confirmed_transaction_ids": sorted(body.transaction_ids), "currency": "THB", "posting_effect": "0"}
    except Exception:
        db.rollback()
        raise


@router.get("/export.csv")
def export_csv(start: date | None = None, end: date | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    result = reports(start, end, db, user)
    output = io.StringIO()
    columns = ["id", "origin", "currency", "operation_kind", "occurred_on", "amount_minor", "income_effect_minor", "expense_effect_minor", "category", "trip_id", "description"]
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(result["transactions"])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=financial-transactions.csv", "X-Unverified-Legacy-Count": str(result["unverified_legacy_count"])})


@router.get("/budgets")
def budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [finance_reads.budget_report(db, user.id, b) for b in db.query(Budget).filter_by(user_id=user.id).order_by(Budget.id)]


@router.post("/budgets/{budget_id}/confirm-currency")
def confirm_budget_currency(budget_id: str, body: CurrencyConfirmation, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Budget).filter_by(id=budget_id, user_id=user.id).first()
    return _confirm_currency(db, user.id, "budget", row, body)


@router.post("/trips/{trip_id}/confirm-currency")
def confirm_trip_currency(trip_id: str, body: CurrencyConfirmation, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.query(Trip).filter_by(id=trip_id, user_id=user.id).first()
    return _confirm_currency(db, user.id, "trip", row, body)


def _confirm_currency(db, owner_id, kind, row, body):
    from ..cache import invalidate_user_all
    if row is None:
        raise HTTPException(404, "Record not found")
    if not body.reviewed:
        raise HTTPException(422, "Review the actual budget amount and explicitly confirm its currency")
    try:
        from ..services.money_ledger import digest, lock_owner
        lock_owner(db, owner_id)
        # Legacy budget/trip editors need not lock the owner. Hold the actual
        # limit row through the reviewed-facts check and audit confirmation.
        row = db.query(type(row)).filter_by(id=row.id, user_id=owner_id).with_for_update().populate_existing().first()
        if row is None:
            raise HTTPException(404, "Record not found")
        if body.expected_facts_hash is not None and body.expected_facts_hash != digest(finance_reads.currency_facts(kind, row)):
            raise HTTPException(409, "The budget changed. Refresh and review its current amount and period before confirming currency.")
        result = finance_reads.confirm_currency(db, owner_id, kind, row)
        db.commit()
        invalidate_user_all(owner_id)
        return result
    except Exception:
        db.rollback()
        raise


@router.get("/trips/{trip_id}")
def trip_report(trip_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    trip = db.query(Trip).filter_by(id=trip_id, user_id=user.id).first()
    if trip is None:
        raise HTTPException(404, "Trip not found")
    result = finance_reads.report(db, user.id, trip_id=trip_id)
    result["trip_id"] = trip_id
    result["budgets"] = [finance_reads.budget_report(db, user.id, b) for b in db.query(Budget).filter_by(user_id=user.id, trip_id=trip_id)]
    if trip.total_budget is not None:
        verified = finance_reads.currency_confirmed(db, user.id, "trip", trip)
        result["budget_minor"] = str(finance_reads.exact_minor(trip.total_budget)) if verified else None
        result["unverified_legacy_budget_amount"] = str(trip.total_budget) if not verified else None
    else:
        verified = bool(result["budgets"]) and all(b["budget_currency_confirmed"] for b in result["budgets"])
        result["budget_minor"] = str(sum(int(x["budget_minor"]) for x in result["budgets"])) if verified else None
    result["budget_currency_confirmed"] = verified
    result["remaining_minor"] = str(int(result["budget_minor"]) - int(result["expense_minor"])) if verified else None
    return result


@router.post("/statements", status_code=201)
def import_statement(body: StatementBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        result = finance_reconciliation.import_statement(db, user.id, body.model_dump(mode="json"))
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.get("/statements/{statement_id}")
def statement(statement_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return finance_reconciliation.review(db, user.id, statement_id)


@router.get("/statements")
def list_statements(account_id: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..models.finance_reconciliation import StatementImport
    query = db.query(StatementImport).filter_by(owner_id=user.id)
    if account_id:
        finance_reconciliation.owned_account(db, user.id, account_id)
        query = query.filter_by(account_id=account_id)
    return [{"id": row.id, "account_id": row.account_id, "period_start": str(row.period_start), "period_end": str(row.period_end),
             "closing_balance_minor": str(row.closing_balance_minor)} for row in query.order_by(StatementImport.created_at.desc(), StatementImport.id).limit(100)]


@router.post("/statements/{statement_id}/rows/{line_id}/match")
def match(statement_id: str, line_id: str, body: MatchBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        result = finance_reconciliation.match(db, user.id, statement_id, line_id, body.journal_id)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


@router.post("/statements/{statement_id}/rows/{line_id}/draft", status_code=201)
def row_draft(statement_id: str, line_id: str, body: RowDraftBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        result = finance_reconciliation.row_draft(db, user.id, statement_id, line_id, body.model_dump())
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
