"""Opt-in LINE ledger routes. Service callers can propose, never approve money."""

import hmac
from contextlib import contextmanager
from typing import Annotated, Literal

import httpx

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import get_settings
from ..database import get_db
from ..models.finance_integration import (
    FinanceEvidence,
    FinanceInbox,
    FinanceIntegrationJob,
    FinanceNotificationOutbox,
)
from ..models.user import User
from ..services import finance_integration as integration
from ..services.money_ledger import MoneyError

router = APIRouter(prefix="/api/integrations", tags=["Exact-money LINE integration"])
DB = Annotated[Session, Depends(get_db)]
Owner = Annotated[User, Depends(get_current_user)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Claim(Strict):
    kinds: list[Literal["text", "extract"]] = Field(
        default_factory=lambda: ["text"], min_length=1, max_length=2
    )


class Complete(Strict):
    generation: int = Field(ge=1)
    result: dict = Field(default_factory=dict)


class Fail(Strict):
    generation: int = Field(ge=1)
    retryable: bool = True
    code: str = Field(default="EXTRACTION_FAILED", max_length=64)


class Generation(Strict):
    generation: int = Field(ge=1)


class DeliveryResult(Generation):
    provider_status: int = Field(ge=100, le=599)
    provider_ack: str | None = Field(default=None, max_length=128)


@contextmanager
def domain_errors():
    # The application handler supplies the shared correlation/field-error DTO.
    yield


def lease_token(request):
    value = request.headers.get("authorization", "")
    if not value.startswith("Bearer ") or len(value) > 256:
        raise HTTPException(
            401,
            {
                "code": "INVALID_CAPABILITY",
                "message": "A job lease capability is required",
            },
        )
    return value[7:]


def service_authorized(request, *, delivery=False):
    secret = (
        get_settings().finance_integration_delivery_token
        if delivery
        else get_settings().finance_integration_service_token
    )
    value = request.headers.get("authorization", "")
    if len(secret) < 32 or not hmac.compare_digest(
        value.encode(), ("Bearer " + secret).encode()
    ):
        raise HTTPException(
            401,
            {"code": "INVALID_SERVICE_CREDENTIAL", "message": "Unauthorized service"},
        )


@router.get("/line/status")
def status(db: DB, user: Owner):
    settings = get_settings()
    result = {
        "enabled": settings.finance_ledger_enabled,
        "configured": bool(
            settings.line_finance_channel_secret and settings.line_finance_destination
        ),
        "delivery_enabled": settings.finance_integration_delivery_enabled,
        "linked": False,
        "linked_at": None,
        "setup_lifetime_seconds": settings.finance_integration_link_ttl_hours * 3600,
        "web_session_lifetime_seconds": settings.jwt_expire_minutes * 60,
        "pending_jobs": 0,
        "delivery": {},
    }
    if not settings.finance_ledger_enabled:
        return result
    with domain_errors():
        integration.enabled(db)
        identity = integration.active_identity(db, owner=user.id)
        result["linked"] = identity is not None
        result["linked_at"] = identity.created_at.isoformat() + "Z" if identity else None
        result["pending_jobs"] = (
            db.query(FinanceIntegrationJob)
            .filter(
                FinanceIntegrationJob.owner_id == user.id,
                FinanceIntegrationJob.state.in_(["queued", "leased"]),
            )
            .count()
        )
        result["delivery"] = dict(
            db.query(FinanceNotificationOutbox.state, func.count())
            .filter_by(owner_id=user.id)
            .group_by(FinanceNotificationOutbox.state)
            .all()
        )
        return result


@router.post("/line/link-challenges")
def link_challenge(db: DB, user: Owner, response: Response):
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Pragma"] = "no-cache"
    with domain_errors():
        result = integration.link_challenge(db, user.id)
        db.commit()
        return result


@router.delete("/line/link", status_code=204)
def unlink(db: DB, user: Owner):
    with domain_errors():
        integration.unlink(db, user.id)
        db.commit()


@router.post("/line/drafts/{draft_id}/preview")
def preview(draft_id: str, db: DB, user: Owner):
    with domain_errors():
        integration.enabled(db)
        integration.ledger.lock_owner(db, user.id)
        identity = integration.active_identity(db, owner=user.id)
        if not identity:
            raise HTTPException(
                409,
                {
                    "code": "UNLINKED_IDENTITY",
                    "message": "Connect your LINE identity first",
                },
            )
        result = integration.preview(db, identity, draft_id)
        db.commit()
        return result


@router.post("/line/webhook")
async def webhook(request: Request, db: DB):
    with domain_errors():
        integration.enabled(db)
        events = integration.validate_signature(
            await request.body(), request.headers.get("x-line-signature", "")
        )
        try:
            for event in events:
                try:
                    with db.begin_nested():
                        integration.accept_event(db, event)
                except IntegrityError:
                    # A concurrent redelivery may win the unique intake key.
                    # Any other constraint failure remains retryable, not success.
                    event_id = (
                        event.get("webhookEventId") if isinstance(event, dict) else None
                    )
                    exists = (
                        db.query(FinanceInbox)
                        .filter_by(
                            channel_id=get_settings().line_finance_channel_id,
                            event_id=event_id,
                        )
                        .first()
                    )
                    if not exists:
                        raise
                except MoneyError as exc:
                    with db.begin_nested():
                        integration.reject_event(db, event, exc.code)
            db.commit()
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                503,
                {
                    "code": "INTAKE_UNAVAILABLE",
                    "message": "Durable intake unavailable",
                    "retryable": True,
                },
            ) from exc
    return {"accepted": True}


@router.post("/jobs/claim")
def claim(body: Claim, request: Request, db: DB):
    service_authorized(request)
    with domain_errors():
        result = integration.claim(db, body.kinds)
        db.commit()
        return {"job": result}


@router.get("/operations")
def operations(request: Request, db: DB):
    """Scoped operational counters without owners, amounts or message bodies."""
    from ..models.finance_reconciliation import StatementLine

    service_authorized(request)
    with domain_errors():
        integration.enabled(db)
        now = integration.utcnow()
        job_counts = dict(
            db.query(FinanceIntegrationJob.state, func.count())
            .group_by(FinanceIntegrationJob.state)
            .all()
        )
        delivery_counts = dict(
            db.query(FinanceNotificationOutbox.state, func.count())
            .group_by(FinanceNotificationOutbox.state)
            .all()
        )
        oldest_job = (
            db.query(func.min(FinanceIntegrationJob.created_at))
            .filter(FinanceIntegrationJob.state.in_(["queued", "leased"]))
            .scalar()
        )
        oldest_delivery = (
            db.query(func.min(FinanceNotificationOutbox.created_at))
            .filter(FinanceNotificationOutbox.state.in_(["pending", "leased"]))
            .scalar()
        )
        safe_failures = dict(
            db.query(FinanceIntegrationJob.safe_code, func.count())
            .filter(FinanceIntegrationJob.safe_code.isnot(None))
            .group_by(FinanceIntegrationJob.safe_code)
            .all()
        )
        return {
            "jobs": job_counts,
            "delivery": delivery_counts,
            "oldest_job_age_seconds": max(0, int((now - oldest_job).total_seconds()))
            if oldest_job
            else None,
            "oldest_delivery_age_seconds": max(
                0, int((now - oldest_delivery).total_seconds())
            )
            if oldest_delivery
            else None,
            "failure_codes": safe_failures,
            "reconciliation": dict(
                db.query(StatementLine.status, func.count())
                .group_by(StatementLine.status)
                .all()
            ),
            "delivery_enabled": get_settings().finance_integration_delivery_enabled,
        }


@router.post("/jobs/{job_id}/complete")
def complete(job_id: str, body: Complete, request: Request, db: DB):
    token = lease_token(request)
    with domain_errors():
        result = integration.complete(db, job_id, token, body.generation, body.result)
        db.commit()
        return result


@router.post("/jobs/{job_id}/process")
def process(job_id: str, body: Generation, request: Request, db: DB):
    """Run the configured adapter without revealing provider credentials to n8n."""
    from ..services.finance_integration_worker import extract_openai

    token = lease_token(request)
    with domain_errors():
        job, event, _ = integration.fenced_job(
            db, job_id, token, body.generation, allow_done=True
        )
        if job.state == "done":
            return job.result
        if job.kind == "text":
            result = integration.complete(db, job_id, token, body.generation, {})
            db.commit()
            return result
        if job.kind != "extract":
            raise HTTPException(
                403, "Only extraction and text leases can invoke this adapter"
            )
        evidence = (
            db.query(FinanceEvidence)
            .filter_by(event_id=event.id, owner_id=job.owner_id)
            .one()
        )
        content, mime = integration.evidence_path(evidence).read_bytes(), evidence.mime
        # Snapshot the source and release ALL database locks before provider I/O.
        # complete() rechecks the current generation before mutating evidence.
        db.rollback()
        try:
            with httpx.Client(timeout=45, follow_redirects=False) as client:
                fields = extract_openai(client, content, mime, get_settings())
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                502,
                {
                    "code": "PROVIDER_UNAVAILABLE",
                    "message": "Extraction provider unavailable",
                    "retryable": True,
                },
            ) from exc
        result = integration.complete(db, job_id, token, body.generation, fields)
        db.commit()
        return result


@router.post("/jobs/{job_id}/fail")
def fail(job_id: str, body: Fail, request: Request, db: DB):
    token = lease_token(request)
    with domain_errors():
        result = integration.fail(
            db, job_id, token, body.generation, retryable=body.retryable, code=body.code
        )
        db.commit()
        return result


@router.post("/delivery/claim")
def claim_delivery(request: Request, db: DB):
    service_authorized(request, delivery=True)
    with domain_errors():
        result = integration.claim_delivery(db)
        db.commit()
        return {"delivery": result}


@router.post("/delivery/{delivery_id}/complete")
def complete_delivery(delivery_id: str, body: DeliveryResult, request: Request, db: DB):
    with domain_errors():
        result = integration.finish_delivery(
            db,
            delivery_id,
            lease_token(request),
            body.generation,
            provider_status=body.provider_status,
            provider_ack=body.provider_ack,
        )
        db.commit()
        return result


@router.post("/delivery/{delivery_id}/fail")
def fail_delivery(delivery_id: str, body: Generation, request: Request, db: DB):
    with domain_errors():
        result = integration.finish_delivery(
            db, delivery_id, lease_token(request), body.generation
        )
        db.commit()
        return result


def evidence_response(evidence):
    return FileResponse(
        integration.evidence_path(evidence),
        media_type=evidence.mime,
        filename="receipt"
        + {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}[
            evidence.mime
        ],
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/evidence/{evidence_id}")
def owner_evidence(evidence_id: str, db: DB, user: Owner):
    with domain_errors():
        integration.enabled(db)
        evidence = (
            db.query(FinanceEvidence)
            .filter_by(id=evidence_id, owner_id=user.id)
            .first()
        )
        if not evidence:
            raise HTTPException(404, "Evidence not found")
        return evidence_response(evidence)


@router.get("/jobs/{job_id}/evidence/{evidence_id}")
def job_evidence(
    job_id: str, evidence_id: str, generation: int, request: Request, db: DB
):
    with domain_errors():
        evidence = integration.leased_evidence(
            db, job_id, lease_token(request), generation, evidence_id
        )
        return evidence_response(evidence)
