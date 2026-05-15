from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import text

from .config import get_settings
from .database import SessionLocal
from .logging_config import configure_logging
from .middleware import (
    RateLimitMiddleware,
    RequestIDMiddleware,
    SecurityHeadersMiddleware,
)
from .routers import (
    auth,
    plans,
    calendar,
    gantt,
    transactions,
    dashboard,
    ai,
    budgets,
    reports,
    savings_goals,
    debts,
    payments,
    notifications,
    trips,
    preferences,
    investments,
)

settings = get_settings()
configure_logging(settings.log_format, settings.debug)

APP_VERSION = "1.0.0"

app = FastAPI(
    title=settings.app_name,
    version=APP_VERSION,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
)

# add_middleware prepends, so the last call wraps outermost.
# RequestIDMiddleware must be outermost so its logger.contextualize() covers
# every downstream log line (including SecurityHeadersMiddleware's request log).
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.rate_limit_per_minute)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(RequestIDMiddleware)

app.include_router(auth.router)
app.include_router(plans.router)
app.include_router(calendar.router)
app.include_router(gantt.router)
app.include_router(transactions.router)
app.include_router(transactions.tags_router)
app.include_router(dashboard.router)
app.include_router(ai.router)
app.include_router(budgets.router)
app.include_router(reports.router)
app.include_router(savings_goals.router)
app.include_router(debts.router)
app.include_router(payments.router)
app.include_router(notifications.router)
app.include_router(trips.router)
app.include_router(preferences.router)
app.include_router(investments.router)


def _db_backend(url: str) -> str:
    scheme = urlparse(url).scheme.split("+", 1)[0]
    return scheme or "unknown"


def _ai_configured(s) -> bool:
    if s.ai_provider == "anthropic":
        return bool(s.anthropic_api_key)
    if s.ai_provider == "typhoon":
        return bool(s.typhoon_api_key)
    if s.ai_provider == "groq":
        return bool(s.groq_api_key)
    return False


@app.on_event("startup")
def on_startup():
    logger.info(
        "Aegis v{version} started",
        version=APP_VERSION,
    )
    logger.info(
        "config: debug={debug} db={db} ai_provider={prov} ai={ai} stripe={stripe} log_format={fmt}",
        debug=settings.debug,
        db=_db_backend(settings.database_url),
        prov=settings.ai_provider,
        ai="configured" if _ai_configured(settings) else "not_configured",
        stripe="configured" if settings.stripe_secret_key else "not_configured",
        fmt=settings.log_format,
    )


@app.get("/api/health")
def health():
    db_ok = True
    db_error: str | None = None
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 — health probe catches everything
        db_ok = False
        db_error = str(exc)[:200]

    body = {
        "status": "ok" if db_ok else "degraded",
        "version": APP_VERSION,
        "db": "ok" if db_ok else "error",
        "features": {
            "ai": "configured" if _ai_configured(settings) else "not_configured",
            "ai_provider": settings.ai_provider,
            "stripe": "configured" if settings.stripe_secret_key else "not_configured",
        },
        "stripe_mode": settings.stripe_mode if settings.stripe_secret_key else "not_configured",
    }
    if not db_ok:
        body["db_error"] = db_error
        return JSONResponse(body, status_code=503)
    return body
