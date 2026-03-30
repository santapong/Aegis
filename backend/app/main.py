from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import engine, Base
from .routers import plans, calendar, gantt, transactions, dashboard, ai, budgets, reports, savings_goals, debts

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.4.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.4.0"}
