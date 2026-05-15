"""Tests for the MCP user-resolution flow."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (  # noqa: F401
    user, plan, transaction, budget, savings_goal, debt, payment,
    ai_recommendation, notification, trip, tag,
)
from app.models.user import User


def _make_session(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    import app.mcp.session as mcp_session
    monkeypatch.setattr(mcp_session, "SessionLocal", Session)
    monkeypatch.setattr(mcp_session, "_cached_user_id", None)
    return Session


def test_missing_env_raises(monkeypatch):
    from app.mcp.session import resolve_user_id, MCPSessionError

    _make_session(monkeypatch)
    monkeypatch.delenv("AEGIS_USER_EMAIL", raising=False)
    with pytest.raises(MCPSessionError, match="AEGIS_USER_EMAIL"):
        resolve_user_id()


def test_unknown_email_raises(monkeypatch):
    from app.mcp.session import resolve_user_id, MCPSessionError

    _make_session(monkeypatch)
    monkeypatch.setenv("AEGIS_USER_EMAIL", "ghost@example.com")
    with pytest.raises(MCPSessionError, match="No Aegis user"):
        resolve_user_id()


def test_inactive_user_raises(monkeypatch):
    from app.mcp.session import resolve_user_id, MCPSessionError

    Session = _make_session(monkeypatch)
    with Session() as db:
        db.add(User(email="inactive@example.com", username="off", hashed_password="x", is_active=False))
        db.commit()
    monkeypatch.setenv("AEGIS_USER_EMAIL", "inactive@example.com")
    with pytest.raises(MCPSessionError, match="inactive"):
        resolve_user_id()


def test_valid_email_resolves(monkeypatch):
    from app.mcp.session import resolve_user_id

    Session = _make_session(monkeypatch)
    with Session() as db:
        u = User(email="ok@example.com", username="ok", hashed_password="x", is_active=True)
        db.add(u)
        db.commit()
        db.refresh(u)
        expected = u.id

    monkeypatch.setenv("AEGIS_USER_EMAIL", "ok@example.com")
    assert resolve_user_id() == expected
    # Cached on subsequent call
    assert resolve_user_id() == expected
