"""Session-authenticated review and exact-money APIs."""

from datetime import date

from fastapi import APIRouter, Depends, Header, Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..cache import invalidate_user_all
from ..config import get_settings
from ..database import get_db
from ..models.user import User
from ..models.finance_ledger import LedgerAccount, LedgerDraft
from ..schemas import finance_ledger as schemas
from ..services import money_ledger as service


def enabled(db: Session = Depends(get_db)):
    if not get_settings().finance_ledger_enabled:
        raise service.MoneyError(
            "FEATURE_DISABLED",
            "The exact-money ledger is prepared but disabled. Complete the operator setup and review gates before activation.",
            503,
        )
    if db.get_bind().dialect.name not in {"sqlite", "postgresql"}:
        raise service.MoneyError(
            "UNSUPPORTED_DATABASE",
            "This ledger requires qualified PostgreSQL or SQLite.",
            503,
        )


router = APIRouter(tags=["financial ledger"], dependencies=[Depends(enabled)])
status_router = APIRouter(tags=["financial ledger"])


@status_router.get("/api/finance/status")
def status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    from ..services.finance_reads import cutover_active

    return {
        "enabled": get_settings().finance_ledger_enabled,
        "cutover_active": cutover_active(db, user.id),
        "canonical_transactions_url": "/review",
    }


def commit(db, owner, action):
    try:
        result = action()
        db.commit()
    except Exception:
        db.rollback()
        raise
    invalidate_user_all(owner)
    return result


@router.post("/api/accounts", status_code=201)
def create_account(
    body: schemas.AccountCreate,
    response: Response,
    idempotency_key: str = Header(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = commit(
        db, user.id, lambda: service.create_account(db, user.id, body, idempotency_key)
    )
    if result.get("replayed"):
        response.status_code = 200
    return result


@router.get("/api/accounts")
def accounts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [
        service.account_dict(db, a)
        for a in db.query(LedgerAccount)
        .filter_by(owner_id=user.id, visible=True)
        .order_by(LedgerAccount.name)
    ]


@router.post("/api/accounts/opening-balances", status_code=201)
def openings(
    body: schemas.OpeningsCreate,
    response: Response,
    idempotency_key: str = Header(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = commit(
        db, user.id, lambda: service.create_openings(db, user.id, body, idempotency_key)
    )
    if result.get("replayed"):
        response.status_code = 200
    return result


@router.get("/api/accounts/balances")
def balances(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.balances(db, user.id)


@router.get("/api/transaction-drafts")
def drafts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [
        service.draft_dict(db, d)
        for d in db.query(LedgerDraft)
        .filter_by(owner_id=user.id)
        .order_by(LedgerDraft.created_at.desc(), LedgerDraft.id)
        .limit(200)
    ]


@router.post("/api/transaction-drafts", status_code=201)
def create_draft(
    body: schemas.DraftPayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return commit(db, user.id, lambda: service.create_draft(db, user.id, body))


@router.patch("/api/transaction-drafts/{draft_id}")
def edit_draft(
    draft_id: str,
    body: schemas.DraftEdit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return commit(
        db,
        user.id,
        lambda: service.edit_draft(
            db, user.id, draft_id, body.expected_version, body.patch
        ),
    )


@router.post("/api/transaction-drafts/{draft_id}/confirm", status_code=201)
def confirm_draft(
    draft_id: str,
    body: schemas.DraftAction,
    response: Response,
    idempotency_key: str = Header(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = commit(
        db,
        user.id,
        lambda: service.confirm_draft(
            db, user.id, draft_id, body.expected_version, idempotency_key
        ),
    )
    if result.get("replayed"):
        response.status_code = 200
    return result


@router.post("/api/transaction-drafts/{draft_id}/cancel")
def cancel_draft(
    draft_id: str,
    body: schemas.DraftAction,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return commit(
        db,
        user.id,
        lambda: service.cancel_draft(db, user.id, draft_id, body.expected_version),
    )


@router.get("/api/financial-transactions")
def financial_transactions(
    start: date | None = None,
    end: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.financial_transactions(db, user.id, start, end)


@router.post("/api/financial-transactions/{journal_id}/corrections", status_code=201)
def correct(
    journal_id: str,
    body: schemas.Correction,
    response: Response,
    idempotency_key: str = Header(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = commit(
        db,
        user.id,
        lambda: service.correct_entry(db, user.id, journal_id, body, idempotency_key),
    )
    if result.get("replayed"):
        response.status_code = 200
    return result


@router.patch("/api/financial-transactions/{journal_id}/classification")
def classify(
    journal_id: str,
    body: schemas.Classification,
    idempotency_key: str = Header(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return commit(
        db,
        user.id,
        lambda: service.classify_entry(db, user.id, journal_id, body, idempotency_key),
    )
