import os

# Env must be set before importing the app so Pydantic BaseSettings picks it up.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-secret-not-for-production-0000000000000000000000000000000000",
)
os.environ.setdefault("ANTHROPIC_API_KEY", "")
os.environ.setdefault("DEBUG", "true")
# Tests fire many requests in quick succession; the default 100/min throttle
# would otherwise return 429s once the suite grows past ~50 requests.
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "10000")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

# Import all models so Base.metadata knows about them before create_all.
from app.models import (  # noqa: F401
    user, plan, transaction, budget, savings_goal, debt, payment,
    ai_recommendation, notification, trip, tag,
)


def _register(client, email="user@example.com", username="user", password="pw-at-least-8"):
    """Helper: register a fresh user and return their auth headers + id."""
    r = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert r.status_code == 201, r.text
    user_id = r.json()["id"]
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
