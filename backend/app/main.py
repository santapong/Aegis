from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .config import get_settings
from .middleware import SecurityHeadersMiddleware, RateLimitMiddleware
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
)

settings = get_settings()

APP_VERSION = "0.9.0"

app = FastAPI(
    title=settings.app_name,
    version=APP_VERSION,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.rate_limit_per_minute)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

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


@app.on_event("startup")
def on_startup():
    logger.info(
        "Aegis v{version} started (mode={mode})",
        version=APP_VERSION,
        mode="debug" if settings.debug else "production",
    )


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": APP_VERSION,
        "stripe_mode": settings.stripe_mode if settings.stripe_secret_key else "not_configured",
    }
