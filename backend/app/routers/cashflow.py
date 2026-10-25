from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..config import get_settings
from ..database import get_db
from ..models.user import User
from ..models.transaction import Transaction
from ..models.cashflow import (
    CashWorkspace,
    CashAccount,
    CashBalanceAnchor,
    CashOccurrence,
    CashCommitment,
    CashSettlement,
    CashTransfer,
    CashScenario,
    CashImportBatch,
    CashImportRow,
    CashGoalAllocation,
    CashAlert,
    CashBusinessDocument,
    CashForecastSnapshot,
)
from ..schemas import cashflow as schemas
from ..services import cashflow as service
from ..services.cashflow import business
from ..services.transaction_scope import claim_transaction


def enabled():
    if not get_settings().cashflow_workspaces_enabled:
        raise HTTPException(
            503,
            "Cash workspaces are awaiting rollout. Existing records remain available.",
        )


router = APIRouter(
    prefix="/api/cash", tags=["cash planning"], dependencies=[Depends(enabled)]
)


@router.get("/workspaces")
def list_workspaces(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return [
        service.serial(w)
        for w in db.query(CashWorkspace)
        .filter_by(user_id=user.id)
        .order_by(CashWorkspace.name, CashWorkspace.id)
        .all()
    ]


@router.post("/workspaces", status_code=201)
def create_workspace(
    body: schemas.WorkspaceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.create_workspace(db, user.id, body)


@router.get("/workspaces/{wid}")
def get_workspace(
    wid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return service.state(db, service.workspace(db, user.id, wid, lock=True))


@router.get("/forecast")
def get_forecast(
    workspace_id: str,
    as_of: date | None = None,
    end: date | None = None,
    account_ids: list[str] | None = Query(default=None),
    scenario_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = service.workspace(db, user.id, workspace_id, lock=True)
    start = as_of or service.local_today(w)
    return service.forecast(
        db, w, start, end or start + timedelta(days=30), account_ids, scenario_id
    )


@router.post("/workspaces/{wid}/accounts", status_code=201)
def create_account(
    wid: str,
    body: schemas.AccountCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        a = CashAccount(
            workspace_id=w.id, name=body.name, kind=body.kind, currency=w.currency
        )
        db.add(a)
        db.flush()
        return a

    return service.mutate(db, user.id, wid, "create_account", body, action)


@router.post("/workspaces/{wid}/accounts/{aid}/archive")
def archive_account(
    wid: str,
    aid: str,
    body: schemas.Mutation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        a = service.owned(db, CashAccount, w, aid)
        a.archived = True
        return a

    return service.mutate(
        db, user.id, wid, "archive_account", body, action, resource_id=aid
    )


@router.post("/workspaces/{wid}/anchors", status_code=201)
def create_anchor(
    wid: str,
    body: schemas.AnchorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.finance_reads import guard_legacy_writer
    guard_legacy_writer(db, user.id)

    def action(w):
        service.account(db, w, body.account_id)
        if (
            db.query(CashBalanceAnchor)
            .filter_by(account_id=body.account_id, date=body.date)
            .first()
        ):
            raise HTTPException(
                409,
                "An opening balance exists on this date. Use a later reviewed start-of-day balance.",
            )
        a = CashBalanceAnchor(
            workspace_id=w.id, **body.model_dump(exclude={"revision", "request_key"})
        )
        db.add(a)
        db.flush()
        return a

    return service.mutate(db, user.id, wid, "create_anchor", body, action)


@router.post("/workspaces/{wid}/movements", status_code=201)
def create_movement(
    wid: str,
    body: schemas.MovementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "create_movement",
        body,
        lambda w: service.add_movement(db, w, body),
    )


@router.post("/workspaces/{wid}/movements/{tid}/reverse")
def reverse_movement(
    wid: str,
    tid: str,
    body: schemas.Mutation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "reverse_movement",
        body,
        lambda w: service.reverse_movement(db, w, tid),
        resource_id=tid,
    )


@router.post("/workspaces/{wid}/transfers", status_code=201)
def create_transfer(
    wid: str,
    body: schemas.TransferCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.finance_reads import guard_legacy_writer
    guard_legacy_writer(db, user.id)
    destination = db.query(CashAccount).filter_by(id=body.to_account_id).first()
    if not destination:
        raise HTTPException(404, "Destination account not found")
    target = service.workspace(db, user.id, destination.workspace_id)
    peers = []
    if target.id != wid:
        if body.to_workspace_revision is None:
            raise HTTPException(
                422, "Review the destination workspace before transferring"
            )
        peers = [(target, body.to_workspace_revision)]

    def action(w):
        service.account(db, w, body.from_account_id)
        service.account(db, target, body.to_account_id)
        if target.currency != w.currency:
            raise HTTPException(422, "Transfers require the same currency")
        if body.from_account_id == body.to_account_id:
            raise HTTPException(422, "Select different accounts")
        if body.date > min(service.local_today(w), service.local_today(target)):
            raise HTTPException(422, "A transfer must record money already moved")
        t = CashTransfer(
            workspace_id=w.id,
            **body.model_dump(
                exclude={"revision", "request_key", "to_workspace_revision"}
            ),
        )
        db.add(t)
        db.flush()
        return t

    return service.mutate(
        db, user.id, wid, "create_transfer", body, action, peers=peers
    )


@router.post("/workspaces/{wid}/commitments", status_code=201)
def create_commitment(
    wid: str,
    body: schemas.CommitmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "create_commitment",
        body,
        lambda w: service.add_commitment(db, w, body),
    )


@router.post("/workspaces/{wid}/occurrences/{oid}")
def edit_occurrence(
    wid: str,
    oid: str,
    body: schemas.OccurrenceEdit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        o = service.owned(db, CashOccurrence, w, oid)
        document = (
            db.query(CashBusinessDocument)
            .filter_by(workspace_id=w.id, commitment_id=o.commitment_id)
            .first()
        )
        if document and (
            {"amount", "cancelled", "title"} & body.model_fields_set
            or "due_date" in body.model_fields_set
            and body.due_date is None
        ):
            raise HTTPException(
                409,
                "Review document amounts, credits and cancellation in Business review",
            )
        if body.expected_date is not None:
            o.expected_date = body.expected_date
        if body.cancelled is not None:
            o.cancelled = body.cancelled
        if body.amount is not None:
            settled = sum(
                (
                    s.amount
                    for s in db.query(CashSettlement).filter_by(
                        occurrence_id=o.id, reversed=False
                    )
                ),
                0,
            )
            if body.amount < settled:
                raise HTTPException(
                    409,
                    "Amount cannot be less than payments already matched; unmatch or enter a reviewed correction",
                )
            o.amount = body.amount
        if body.title is not None:
            o.title = body.title
        if "due_date" in body.model_fields_set:
            o.due_date = body.due_date
        return o

    return service.mutate(
        db, user.id, wid, "edit_occurrence", body, action, resource_id=oid
    )


@router.post("/workspaces/{wid}/commitments/{cid}/cancel")
def cancel_commitment(
    wid: str,
    cid: str,
    body: schemas.Mutation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        c = service.owned(db, CashCommitment, w, cid)
        if (
            db.query(CashBusinessDocument)
            .filter_by(workspace_id=w.id, commitment_id=cid)
            .first()
        ):
            raise HTTPException(
                409, "Cancel this document with a reason in Business review"
            )
        c.cancelled = True
        for o in db.query(CashOccurrence).filter_by(commitment_id=cid).all():
            o.cancelled = True
        return c

    return service.mutate(
        db, user.id, wid, "cancel_commitment", body, action, resource_id=cid
    )


@router.post("/workspaces/{wid}/settlements/preview")
def preview_settlement(
    wid: str,
    body: schemas.AllocationPreview,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = service.workspace(db, user.id, wid, lock=True)
    t, o, available, remaining = service.validate_allocation(
        db, w, body.transaction_id, body.occurrence_id, body.amount
    )
    return {
        "revision": w.revision,
        "transaction": service.serial(t),
        "occurrence": service.serial(o),
        "unallocated_before": service.money(available),
        "remaining_before": service.money(remaining),
        "remaining_after": service.money(remaining - body.amount),
        "cash_effect": "0.00",
        "message": "The recorded payment is already in cash. Matching reduces the future commitment once.",
    }


@router.post("/workspaces/{wid}/settlements", status_code=201)
def create_settlement(
    wid: str,
    body: schemas.SettlementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "create_settlement",
        body,
        lambda w: service.add_settlement(
            db, w, body.transaction_id, body.occurrence_id, body.amount
        ),
    )


@router.post("/workspaces/{wid}/settlements/{sid}/reverse")
def reverse_settlement(
    wid: str,
    sid: str,
    body: schemas.Mutation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        s = service.owned(db, CashSettlement, w, sid)
        s.reversed = True
        return s

    return service.mutate(
        db, user.id, wid, "reverse_settlement", body, action, resource_id=sid
    )


@router.post("/workspaces/{wid}/scenarios", status_code=201)
def create_scenario(
    wid: str,
    body: schemas.ScenarioCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "create_scenario",
        body,
        lambda w: service.add_scenario(db, w, body),
    )


@router.post("/workspaces/{wid}/scenarios/{sid}/refresh")
def refresh_scenario(
    wid: str,
    sid: str,
    body: schemas.Mutation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        s = service.owned(db, CashScenario, w, sid)
        s.base_revision = service.base_revision(db, w)
        return s

    return service.mutate(
        db, user.id, wid, "refresh_scenario", body, action, resource_id=sid
    )


@router.post("/workspaces/{wid}/buffer")
def update_buffer(
    wid: str,
    body: schemas.BufferUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        w.buffer = body.buffer
        return {"buffer": service.money(w.buffer)}

    return service.mutate(db, user.id, wid, "update_buffer", body, action)


@router.get("/legacy")
def legacy_records(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return [
        service.serial(t)
        for t in db.query(Transaction)
        .filter_by(user_id=user.id, workspace_id=None)
        .order_by(Transaction.date.desc(), Transaction.id)
        .limit(500)
        .all()
    ]


@router.post("/workspaces/{wid}/legacy/adopt")
def adopt_legacy(
    wid: str,
    body: schemas.LegacyAdopt,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.finance_reads import guard_legacy_writer
    guard_legacy_writer(db, user.id)

    def action(w):
        service.account(db, w, body.account_id)
        if body.confirmed_currency != w.currency:
            raise HTTPException(
                422,
                "Confirm the actual historical currency; no conversion is performed",
            )
        if len(set(body.transaction_ids)) != len(body.transaction_ids):
            raise HTTPException(422, "Duplicate record selection")
        rows = []
        # Stable transaction order prevents two multi-row assignments from
        # locking the same historical records in opposite orders.
        for tid in sorted(body.transaction_ids):
            t = claim_transaction(db, user.id, tid)
            if not t:
                raise HTTPException(404, "Legacy record not found")
            if t.workspace_id and (
                t.workspace_id != w.id or t.account_id != body.account_id
            ):
                raise HTTPException(409, "Record already belongs to another account")
            if t.amount <= 0:
                raise HTTPException(422, "Review nonpositive legacy amounts separately")
            t.workspace_id = w.id
            t.account_id = body.account_id
            t.currency = w.currency
            rows.append(t.id)
        return {
            "adopted_ids": rows,
            "currency": w.currency,
            "account_id": body.account_id,
        }

    return service.mutate(db, user.id, wid, "adopt_legacy", body, action)


@router.post("/workspaces/{wid}/legacy/exclude")
def exclude_legacy(
    wid: str,
    body: schemas.Mutation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        data = service.state(db, w)
        w.legacy_exclusion_hash = data["legacy_review_hash"]
        return {
            "excluded_count": data["legacy_count"],
            "message": "Reviewed older records remain available in the legacy records view, outside this workspace.",
        }

    return service.mutate(db, user.id, wid, "exclude_legacy", body, action)


@router.post("/workspaces/{wid}/commitments/{cid}/extend")
def extend_schedule(
    wid: str,
    cid: str,
    body: schemas.ScheduleExtend,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.cashflow.scheduling import materialize

    def action(w):
        c = service.owned(db, CashCommitment, w, cid)
        count = materialize(db, c, body.through)
        return {
            "commitment_id": cid,
            "generated_through": c.generated_through.isoformat(),
            "added_count": count,
            "cash_inputs_changed": bool(count),
        }

    return service.mutate(
        db, user.id, wid, "extend_schedule", body, action, resource_id=cid
    )


@router.get("/workspaces/{wid}/imports")
def list_imports(
    wid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    w = service.workspace(db, user.id, wid, lock=True)
    result = []
    for b in (
        db.query(CashImportBatch)
        .filter_by(workspace_id=w.id)
        .order_by(CashImportBatch.created_at.desc(), CashImportBatch.id)
        .limit(50)
    ):
        rows = db.query(CashImportRow).filter_by(batch_id=b.id).all()
        result.append(
            {
                **service.serial(b),
                "row_count": len(rows),
                "imported_count": sum(r.status == "imported" for r in rows),
                "invalid_count": sum(r.status == "invalid" for r in rows),
            }
        )
    return result


@router.post("/workspaces/{wid}/imports", status_code=201)
def upload_import(
    wid: str,
    body: schemas.ImportUpload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.cashflow.everyday import upload_batch

    return service.mutate(
        db,
        user.id,
        wid,
        "create_import_batch",
        body,
        lambda w: upload_batch(db, w, body),
    )


@router.get("/workspaces/{wid}/imports/{bid}")
def get_import(
    wid: str,
    bid: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.cashflow.everyday import review_batch

    return review_batch(db, service.workspace(db, user.id, wid, lock=True), bid)


@router.post("/workspaces/{wid}/imports/{bid}/confirm", status_code=201)
def confirm_import(
    wid: str,
    bid: str,
    body: schemas.ImportConfirm,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.cashflow.everyday import confirm_batch

    return service.mutate(
        db,
        user.id,
        wid,
        "confirm_import",
        body,
        lambda w: confirm_batch(db, w, bid, body),
        resource_id=bid,
    )


@router.get("/workspaces/{wid}/purpose-sources")
def purpose_sources(
    wid: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    from ..models.savings_goal import SavingsGoal
    from ..models.debt import Debt

    service.workspace(db, user.id, wid)
    return {
        "goals": [
            {"id": g.id, "name": g.name}
            for g in db.query(SavingsGoal)
            .filter_by(user_id=user.id)
            .order_by(SavingsGoal.name)
        ],
        "debts": [
            {"id": d.id, "name": d.name}
            for d in db.query(Debt).filter_by(user_id=user.id).order_by(Debt.name)
        ],
        "message": "Legacy purpose records have no verified currency. Confirm the cash workspace currency when linking.",
    }


@router.post("/workspaces/{wid}/goal-allocations", status_code=201)
def create_goal_allocation(
    wid: str,
    body: schemas.GoalAllocationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.cashflow.everyday import goal_allocation

    return service.mutate(
        db,
        user.id,
        wid,
        "create_goal_allocation",
        body,
        lambda w: goal_allocation(db, w, body),
    )


@router.post("/workspaces/{wid}/goal-allocations/{gid}")
def update_goal_allocation(
    wid: str,
    gid: str,
    body: schemas.GoalAllocationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        row = service.owned(db, CashGoalAllocation, w, gid)
        before = (row.amount, row.released)
        if body.amount is not None:
            if row.mode != "reserved":
                raise HTTPException(
                    422,
                    "A linked transfer amount is fixed; releasing the link does not reverse money",
                )
            row.amount = body.amount
        if body.released is not None:
            row.released = body.released
        return {
            **service.serial(row),
            "cash_inputs_changed": before != (row.amount, row.released),
        }

    return service.mutate(
        db, user.id, wid, "update_goal_allocation", body, action, resource_id=gid
    )


@router.post("/workspaces/{wid}/installments", status_code=201)
def create_installments(
    wid: str,
    body: schemas.InstallmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.cashflow.everyday import entered_installments

    return service.mutate(
        db,
        user.id,
        wid,
        "create_installments",
        body,
        lambda w: entered_installments(db, w, body),
    )


@router.get("/workspaces/{wid}/alerts")
def get_alerts(
    wid: str,
    as_of: date,
    end: date,
    account_ids: list[str] | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.cashflow.everyday import alert_review

    return alert_review(
        db, service.workspace(db, user.id, wid, lock=True), as_of, end, account_ids
    )


@router.post("/workspaces/{wid}/alerts/evaluate")
def evaluate_alerts(
    wid: str,
    body: schemas.AlertEvaluate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from ..services.cashflow.everyday import evaluate_alerts as evaluate

    return service.mutate(
        db, user.id, wid, "evaluate_alerts", body, lambda w: evaluate(db, w, body)
    )


@router.post("/workspaces/{wid}/alerts/{aid}/acknowledge")
def acknowledge_alert(
    wid: str,
    aid: str,
    body: schemas.Mutation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def action(w):
        row = service.owned(db, CashAlert, w, aid)
        row.acknowledged = True
        return row

    return service.mutate(
        db, user.id, wid, "acknowledge_alert", body, action, resource_id=aid
    )


@router.get("/workspaces/{wid}/business/documents")
def list_business_documents(
    wid: str,
    as_of: date | None = None,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = service.workspace(db, user.id, wid, lock=True)
    business.business_workspace(w)
    day = as_of or service.local_today(w)
    if not 1900 <= day.year <= 2100:
        raise HTTPException(422, "Supported cash dates are between 1900 and 2100")
    rows = (
        db.query(CashBusinessDocument)
        .filter_by(workspace_id=w.id)
        .order_by(CashBusinessDocument.created_at.desc(), CashBusinessDocument.id)
        .offset(offset)
        .limit(limit + 1)
        .all()
    )
    return {
        "documents": [business.document_review(db, w, r, day) for r in rows[:limit]],
        "offset": offset,
        "has_more": len(rows) > limit,
        "as_of": day,
    }


@router.post("/workspaces/{wid}/business/documents", status_code=201)
def create_business_document(
    wid: str,
    body: schemas.BusinessDocumentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "create_business_document",
        body,
        lambda w: business.create_document(db, w, body),
    )


@router.post("/workspaces/{wid}/business/documents/{did}")
def review_business_document(
    wid: str,
    did: str,
    body: schemas.BusinessDocumentReview,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "review_business_document",
        body,
        lambda w: business.review_document(db, w, did, body),
        resource_id=did,
    )


@router.post("/workspaces/{wid}/business/documents/{did}/credit")
def credit_business_document(
    wid: str,
    did: str,
    body: schemas.BusinessDocumentCredit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "credit_business_document",
        body,
        lambda w: business.credit_document(db, w, did, body),
        resource_id=did,
    )


@router.post("/workspaces/{wid}/business/documents/{did}/cancel")
def cancel_business_document(
    wid: str,
    did: str,
    body: schemas.BusinessDocumentCancel,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "cancel_business_document",
        body,
        lambda w: business.cancel_document(db, w, did, body),
        resource_id=did,
    )


@router.post("/workspaces/{wid}/business/documents/{did}/settle", status_code=201)
def settle_business_document(
    wid: str,
    did: str,
    body: schemas.BusinessDocumentSettle,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "settle_business_document",
        body,
        lambda w: business.settle_document(db, w, did, body),
        resource_id=did,
    )


@router.get("/workspaces/{wid}/business/weeks")
def business_weeks(
    wid: str,
    as_of: date | None = None,
    account_ids: list[str] | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = service.workspace(db, user.id, wid, lock=True)
    return business.weeks(db, w, as_of or service.local_today(w), account_ids)


@router.get("/workspaces/{wid}/business/snapshots")
def list_forecast_snapshots(
    wid: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    w = service.workspace(db, user.id, wid, lock=True)
    business.business_workspace(w)
    rows = (
        db.query(CashForecastSnapshot)
        .filter_by(workspace_id=w.id)
        .order_by(CashForecastSnapshot.created_at.desc(), CashForecastSnapshot.id)
        .limit(30)
        .all()
    )
    return [
        {k: v for k, v in service.serial(row).items() if k != "payload"} for row in rows
    ]


@router.post("/workspaces/{wid}/business/snapshots", status_code=201)
def create_forecast_snapshot(
    wid: str,
    body: schemas.ForecastSnapshotCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.mutate(
        db,
        user.id,
        wid,
        "create_forecast_snapshot",
        body,
        lambda w: business.create_snapshot(db, w, body),
    )


@router.get("/workspaces/{wid}/business/snapshots/{sid}")
def get_forecast_snapshot(
    wid: str,
    sid: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return service.serial(
        business.snapshot_detail(
            db, service.workspace(db, user.id, wid, lock=True), sid
        )
    )


@router.get("/workspaces/{wid}/business/snapshots/{sid}/variance")
def forecast_variance(
    wid: str,
    sid: str,
    reviewed_through: date,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return business.variance(
        db, service.workspace(db, user.id, wid, lock=True), sid, reviewed_through
    )
