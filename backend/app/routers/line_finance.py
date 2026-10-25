import base64
import hashlib
import hmac
import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..cache import invalidate_user_all
from ..config import get_settings
from ..database import get_db
from ..models.line_finance import (
    LineFinanceCode,
    LineFinanceDraft,
    LineFinanceEvent,
    LineFinanceIdentity,
    LineFinanceReply,
)
from ..models.user import User
from ..models.user_preferences import DEFAULT_CURRENCY, UserPreferences
from ..schemas.line_finance import LineFinanceLinkCreate
from ..services import cashflow
from ..services.line_finance import handle_message, lock_owner

router = APIRouter(prefix="/api/line-finance", tags=["LINE finance"])


@router.get("/status")
def status(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    prefs = db.query(UserPreferences).filter_by(user_id=user.id).first()
    identity = db.query(LineFinanceIdentity).filter_by(user_id=user.id).first()
    destination = None
    if (
        identity
        and identity.workspace_id
        and identity.account_id
        and identity.connection_id
    ):
        try:
            workspace = cashflow.workspace(db, user.id, identity.workspace_id)
            account = cashflow.account(db, workspace, identity.account_id)
            if workspace.currency == "THB":
                destination = {
                    "workspace_id": workspace.id,
                    "workspace_name": workspace.name,
                    "account_id": account.id,
                    "account_name": account.name,
                    "currency": "THB",
                }
        except HTTPException:
            pass
    delivery = {}
    if identity:
        from sqlalchemy import func

        delivery = dict(
            db.query(LineFinanceReply.state, func.count(LineFinanceReply.id))
            .filter_by(line_id=identity.line_id)
            .group_by(LineFinanceReply.state)
            .all()
        )
    return {
        "currency": prefs.currency if prefs else DEFAULT_CURRENCY,
        "configured": bool(get_settings().line_finance_channel_secret),
        "linked": identity is not None,
        "destination": destination,
        "needs_destination_review": bool(identity and not destination),
        "cash_enabled": get_settings().cashflow_workspaces_enabled,
        "delivery_configured": bool(get_settings().line_finance_access_token),
        "delivery": delivery,
        "pending": db.query(LineFinanceDraft)
        .filter_by(user_id=user.id, state="pending")
        .count(),
    }


@router.post("/link-code")
def link_code(
    body: LineFinanceLinkCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if not get_settings().line_finance_channel_secret:
        raise HTTPException(503, "Finance LINE channel has not been configured yet")
    if not get_settings().cashflow_workspaces_enabled:
        raise HTTPException(503, "Cash workspace capture is awaiting rollout")
    lock_owner(db, user.id)
    if db.query(LineFinanceIdentity).filter_by(user_id=user.id).first():
        raise HTTPException(
            409, "Disconnect the current LINE link before choosing a new destination"
        )
    workspace = cashflow.workspace(db, user.id, body.workspace_id)
    account = cashflow.account(db, workspace, body.account_id)
    if workspace.currency != "THB":
        raise HTTPException(
            422,
            "Choose a THB workspace and cash account; linking never converts currency",
        )
    db.query(LineFinanceCode).filter_by(user_id=user.id).delete()
    code = secrets.token_urlsafe(24)
    db.add(
        LineFinanceCode(
            digest=hashlib.sha256(code.encode()).hexdigest(),
            user_id=user.id,
            workspace_id=workspace.id,
            account_id=account.id,
            expires_at=datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=10),
        )
    )
    db.commit()
    return {
        "command": "link " + code,
        "expires_in_seconds": 600,
        "destination": {
            "workspace_id": workspace.id,
            "workspace_name": workspace.name,
            "account_id": account.id,
            "account_name": account.name,
            "currency": "THB",
        },
    }


@router.delete("/link", status_code=204)
def unlink(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    lock_owner(db, user.id)
    identity = (
        db.query(LineFinanceIdentity)
        .filter_by(user_id=user.id)
        .with_for_update()
        .first()
    )
    if identity:
        # Queued financial replies must not outlive account disconnection.
        db.query(LineFinanceReply).filter(
            LineFinanceReply.line_id == identity.line_id,
            LineFinanceReply.state.in_(["pending", "needs-review"]),
        ).update({"state": "cancelled", "text": ""})
        db.delete(identity)
    db.query(LineFinanceDraft).filter(
        LineFinanceDraft.user_id == user.id,
        LineFinanceDraft.state.in_(["pending", "needs-review"]),
    ).update({"state": "cancelled"})
    db.query(LineFinanceCode).filter_by(user_id=user.id).delete()
    db.commit()


@router.get("/drafts")
def drafts(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    rows = (
        db.query(LineFinanceDraft)
        .filter_by(user_id=user.id)
        .order_by(LineFinanceDraft.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        {
            "id": d.id,
            "state": d.state,
            "data": d.data,
            "transaction_id": d.transaction_id,
        }
        for d in rows
    ]


@router.post("/webhook")
async def webhook(request: Request, db: Annotated[Session, Depends(get_db)]):
    settings = get_settings()
    if not settings.line_finance_channel_secret:
        raise HTTPException(503, "Finance LINE channel is not configured")
    body = await request.body()
    want = base64.b64encode(
        hmac.new(
            settings.line_finance_channel_secret.encode(), body, hashlib.sha256
        ).digest()
    ).decode()
    supplied = request.headers.get("x-line-signature", "")
    if not hmac.compare_digest(supplied.encode(), want.encode()):
        raise HTTPException(401, "Invalid signature")
    try:
        payload = json.loads(body)
        events = payload["events"]
        if not isinstance(events, list) or len(events) > 100:
            raise ValueError()
    except (ValueError, KeyError, TypeError):
        raise HTTPException(400, "Invalid webhook body")
    for ev in events:
        if (
            not isinstance(ev, dict)
            or ev.get("type") != "message"
            or ev.get("source", {}).get("type") != "user"
        ):
            continue
        raw_id = ev.get("webhookEventId")
        line_id = ev.get("source", {}).get("userId")
        if not raw_id or not line_id or len(line_id) > 128:
            continue
        event_id = hashlib.sha256(
            (settings.line_finance_channel_id + ":" + raw_id).encode()
        ).hexdigest()
        if db.get(LineFinanceEvent, event_id):
            continue
        try:
            db.add(LineFinanceEvent(id=event_id))
            db.flush()
            msg = ev.get("message", {})
            if msg.get("type") != "text":
                answer = "Text entry is ready. Receipt images are not enabled yet; please send expense 65 coffee or income 35000 salary."
            else:
                answer = handle_message(
                    db, line_id, str(msg.get("text", ""))[:5000], event_id
                )
            db.add(
                LineFinanceReply(
                    id=str(uuid.uuid5(uuid.NAMESPACE_URL, event_id)),
                    line_id=line_id,
                    text=answer,
                )
            )
            db.commit()
            identity = db.get(LineFinanceIdentity, line_id)
            if identity:
                invalidate_user_all(identity.user_id)
        except IntegrityError:
            db.rollback()
            if not db.get(LineFinanceEvent, event_id):
                raise HTTPException(503, "Please retry this event")
    return {"accepted": True}


@router.post("/deliver")
def deliver(request: Request, db: Annotated[Session, Depends(get_db)]):
    """Bounded drain for serverless hosting, called by an authenticated scheduler."""
    import httpx

    from ..services.line_finance_worker import deliver_batch

    settings = get_settings()
    secret = settings.line_finance_delivery_secret
    supplied = request.headers.get("authorization", "")
    if len(secret) < 32 or not hmac.compare_digest(
        supplied.encode(), ("Bearer " + secret).encode()
    ):
        raise HTTPException(401, "Unauthorized")
    if not settings.line_finance_access_token:
        raise HTTPException(503, "Finance delivery is not configured")
    with httpx.Client(timeout=5) as client:
        deliver_batch(db, settings.line_finance_access_token, client, limit=3)
    return {"processed": True}
