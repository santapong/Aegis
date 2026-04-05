from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from .config import get_settings
from .database import engine, Base
from .middleware import SecurityHeadersMiddleware, RateLimitMiddleware
from .routers import plans, calendar, gantt, transactions, dashboard, ai, budgets, reports, savings_goals, debts, payments

settings = get_settings()

# Conditionally expose API docs (hidden in production)
app = FastAPI(
    title=settings.app_name,
    version="0.5.0",
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
)

# Middleware stack (order matters — outermost first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.rate_limit_per_minute)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

# Register routers
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


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    logger.info("Aegis v0.5.0 started (mode={mode})", mode="debug" if settings.debug else "production")


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": "0.5.0",
        "stripe_mode": settings.stripe_mode if settings.stripe_secret_key else "not_configured",
    }
