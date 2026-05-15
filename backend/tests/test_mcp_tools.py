"""Tests for the MCP tool handlers.

We drive the handlers directly (rather than through the stdio transport) so
the tests stay fast and provide line-level coverage of the wiring between
MCP arg shape, Pydantic validation, and the DB.
"""
import asyncio
import json
import os

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (  # noqa: F401 — register on metadata
    user, plan, transaction, budget, savings_goal, debt, payment,
    ai_recommendation, notification, trip, tag,
)
from app.models.user import User


@pytest.fixture
def mcp_env(monkeypatch):
    """In-process MCP fixture: rebinds SessionLocal to a fresh in-memory DB and
    sets AEGIS_USER_EMAIL to a freshly created user."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Rebind SessionLocal so MCP tools use this engine.
    import app.database as database_mod
    import app.mcp.session as mcp_session

    monkeypatch.setattr(database_mod, "SessionLocal", TestingSession)
    monkeypatch.setattr(mcp_session, "SessionLocal", TestingSession)
    monkeypatch.setattr(mcp_session, "_cached_user_id", None)

    # Seed a user
    with TestingSession() as db:
        u = User(
            email="mcp@example.com",
            username="mcp",
            hashed_password="x",
            is_active=True,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        user_id = u.id

    monkeypatch.setenv("AEGIS_USER_EMAIL", "mcp@example.com")
    yield {"user_id": user_id, "Session": TestingSession}
    Base.metadata.drop_all(engine)


def _run(coro):
    return asyncio.run(coro)


def test_list_tools_count():
    from app.mcp.tools import all_tools, all_handlers
    tools = all_tools()
    handlers = all_handlers()
    assert {t.name for t in tools} == set(handlers.keys())
    assert len(tools) >= 15  # Sanity floor; we register 18 today.


def test_create_and_list_transaction(mcp_env):
    from app.mcp.tools.transactions import create_transaction, list_transactions

    result = _run(create_transaction({
        "amount": 12.5,
        "type": "expense",
        "category": "food",
        "date": "2026-05-10",
    }))
    txn = json.loads(result)
    assert txn["amount"] == 12.5
    assert txn["category"] == "food"

    result = _run(list_transactions({}))
    rows = json.loads(result)
    assert len(rows) == 1
    assert rows[0]["id"] == txn["id"]


def test_create_budget_and_compare(mcp_env):
    from app.mcp.tools.budgets import create_budget, get_budget_comparison
    from app.mcp.tools.transactions import create_transaction

    _run(create_budget({
        "name": "Food",
        "amount": 100,
        "category": "food",
        "period_start": "2026-05-01",
        "period_end": "2026-05-31",
    }))
    _run(create_transaction({
        "amount": 40,
        "type": "expense",
        "category": "food",
        "date": "2026-05-10",
    }))

    comparison = json.loads(_run(get_budget_comparison({
        "period_start": "2026-05-01",
        "period_end": "2026-05-31",
    })))
    assert comparison["total_budgeted"] == 100.0
    assert comparison["total_spent"] == 40.0


def test_trip_create_and_summary(mcp_env):
    from app.mcp.tools.trips import create_trip, get_trip_summary
    from app.mcp.tools.budgets import create_budget
    from app.mcp.tools.transactions import create_transaction

    trip = json.loads(_run(create_trip({
        "title": "Phuket",
        "start_date": "2026-07-01",
        "end_date": "2026-07-05",
    })))
    trip_id = trip["id"]

    _run(create_budget({
        "name": "Flights", "amount": 500, "category": "flights",
        "period_start": "2026-07-01", "period_end": "2026-07-05",
        "trip_id": trip_id,
    }))
    _run(create_transaction({
        "amount": 450, "type": "expense", "category": "flights",
        "date": "2026-07-01", "trip_id": trip_id,
    }))

    summary = json.loads(_run(get_trip_summary({"trip_id": trip_id})))
    assert summary["total_budgeted"] == 500.0
    assert summary["total_spent"] == 450.0
    assert summary["transaction_count"] == 1


def test_update_transaction_via_mcp(mcp_env):
    from app.mcp.tools.transactions import create_transaction, update_transaction

    created = json.loads(_run(create_transaction({
        "amount": 10, "type": "expense", "category": "food", "date": "2026-05-01",
    })))
    updated = json.loads(_run(update_transaction({
        "transaction_id": created["id"],
        "amount": 20,
        "category": "groceries",
    })))
    assert updated["amount"] == 20.0
    assert updated["category"] == "groceries"


def test_update_transaction_unknown_id_raises(mcp_env):
    from app.mcp.tools.transactions import update_transaction

    with pytest.raises(ValueError, match="not found"):
        _run(update_transaction({"transaction_id": "no-such-id", "amount": 5}))
