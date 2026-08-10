"""Tests for AI usage metering and the cost estimate.

Design contract (docs/design/006, Decision 3):
  * token counts are *measured* and always accurate,
  * cost is *derived* and may be absent,
  * metering must never break the feature it meters.
"""
from datetime import datetime, timedelta

import pytest

from app.models.ai_usage import AIUsage
from app.services.ai_pricing import PRICES_AS_OF, estimate_cost

from .conftest import _register


# --- pricing unit tests --------------------------------------------------------


def test_provider_price_preferred_over_static_table():
    """Live provider pricing wins — it can't go stale."""
    live = {"llama-3.3-70b-versatile": (0.59 / 1e6, 0.79 / 1e6)}
    cost, source = estimate_cost("llama-3.3-70b-versatile", 1_000_000, 1_000_000, live)
    assert source == "provider"
    assert cost == pytest.approx(0.59 + 0.79)


def test_static_table_used_when_provider_publishes_nothing():
    """Anthropic's models endpoint returns no pricing, so the table covers it."""
    cost, source = estimate_cost("claude-haiku-4-5", 1_000_000, 1_000_000, live_prices={})
    assert source == "table"
    assert cost == pytest.approx(1.00 + 5.00)


def test_dated_snapshot_resolves_to_its_alias():
    """A dated id must not fall off the table just because of its suffix."""
    result = estimate_cost("claude-sonnet-4-6-20251114", 1_000_000, 0, live_prices={})
    assert result is not None
    cost, source = result
    assert source == "table"
    assert cost == pytest.approx(3.00)


def test_unknown_model_yields_no_cost():
    """Never invent a number for a model neither source prices."""
    assert estimate_cost("some-model-nobody-knows", 1000, 1000, live_prices={}) is None


# --- endpoint ------------------------------------------------------------------


def _seed_usage(client, user_id, **kw):
    """Insert a usage row through the app's own session."""
    from app.database import get_db
    from app.main import app

    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        db.add(AIUsage(user_id=user_id, **kw))
        db.commit()
    finally:
        gen.close()


def test_usage_reports_measured_tokens(client, monkeypatch):
    monkeypatch.setattr("app.routers.ai._cached_provider_models", lambda: [])
    headers, user_id = _register(client, email="u1@example.com", username="usage1")

    _seed_usage(
        client, user_id, provider="groq", model="claude-haiku-4-5",
        operation="analyze", input_tokens=1000, output_tokens=500,
    )
    _seed_usage(
        client, user_id, provider="groq", model="claude-haiku-4-5",
        operation="forecast", input_tokens=200, output_tokens=100,
    )

    body = client.get("/api/ai/usage", headers=headers).json()
    assert body["total_calls"] == 2
    assert body["total_input_tokens"] == 1200
    assert body["total_output_tokens"] == 600
    assert body["prices_as_of"] == PRICES_AS_OF
    assert len(body["by_model"]) == 1
    assert body["by_model"][0]["calls"] == 2


def test_usage_omits_cost_for_unpriced_model(client, monkeypatch):
    """Usage is still reported; the model is named so the short total is visible."""
    monkeypatch.setattr("app.routers.ai._cached_provider_models", lambda: [])
    headers, user_id = _register(client, email="u2@example.com", username="usage2")

    _seed_usage(
        client, user_id, provider="groq", model="mystery-model-9000",
        operation="analyze", input_tokens=100, output_tokens=50,
    )

    body = client.get("/api/ai/usage", headers=headers).json()
    assert body["total_input_tokens"] == 100
    assert body["by_model"][0]["estimated_cost_usd"] is None
    assert body["models_missing_price"] == ["mystery-model-9000"]
    assert body["estimated_cost_usd"] is None


def test_usage_uses_live_provider_pricing(client, monkeypatch):
    monkeypatch.setattr(
        "app.routers.ai._cached_provider_models",
        lambda: [
            {
                "id": "llama-3.3-70b-versatile",
                "supports_tools": True,
                "is_text_to_text": True,
                "prompt_price": 0.59 / 1e6,
                "completion_price": 0.79 / 1e6,
            }
        ],
    )
    headers, user_id = _register(client, email="u3@example.com", username="usage3")
    _seed_usage(
        client, user_id, provider="groq", model="llama-3.3-70b-versatile",
        operation="analyze", input_tokens=1_000_000, output_tokens=1_000_000,
    )

    row = client.get("/api/ai/usage", headers=headers).json()["by_model"][0]
    assert row["cost_source"] == "provider"
    assert row["estimated_cost_usd"] == pytest.approx(1.38, abs=1e-4)


def test_usage_is_scoped_to_the_caller(client, monkeypatch):
    monkeypatch.setattr("app.routers.ai._cached_provider_models", lambda: [])
    h1, id1 = _register(client, email="u4a@example.com", username="usage4a")
    h2, _ = _register(client, email="u4b@example.com", username="usage4b")

    _seed_usage(
        client, id1, provider="groq", model="claude-haiku-4-5",
        operation="analyze", input_tokens=999, output_tokens=1,
    )

    assert client.get("/api/ai/usage", headers=h2).json()["total_calls"] == 0
    assert client.get("/api/ai/usage", headers=h1).json()["total_calls"] == 1


def test_usage_respects_the_period_window(client, monkeypatch):
    monkeypatch.setattr("app.routers.ai._cached_provider_models", lambda: [])
    headers, user_id = _register(client, email="u5@example.com", username="usage5")

    _seed_usage(
        client, user_id, provider="groq", model="claude-haiku-4-5",
        operation="analyze", input_tokens=10, output_tokens=10,
        created_at=datetime.utcnow() - timedelta(days=60),
    )

    assert client.get("/api/ai/usage?days=30", headers=headers).json()["total_calls"] == 0
    assert client.get("/api/ai/usage?days=90", headers=headers).json()["total_calls"] == 1


def test_usage_requires_auth(client):
    assert client.get("/api/ai/usage").status_code in (401, 403)


# --- metering contract ---------------------------------------------------------


@pytest.fixture
def engine_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.database import Base

    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    session = sessionmaker(bind=eng)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(eng)


@pytest.fixture(autouse=True)
def _groq_provider(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "ai_provider", "groq", raising=False)
    monkeypatch.setattr(settings, "groq_api_key", "gsk-test-not-real", raising=False)


def _engine(db):
    from app.services.ai_engine import AIEngine

    return AIEngine(db, user_id=None)


def test_successful_call_writes_exactly_one_row(engine_db, monkeypatch):
    from app.services.ai_engine import ANALYZE_TOOL

    e = _engine(engine_db)

    class _Usage:
        prompt_tokens, completion_tokens = 1234, 567

    class _Resp:
        usage = _Usage()
        choices = [type("C", (), {"message": type("M", (), {"tool_calls": []})()})()]

    monkeypatch.setattr(
        e._openai.chat.completions, "create", lambda **kw: _Resp()
    )
    e._call_tool("sys", "user", ANALYZE_TOOL, operation="analyze")

    rows = engine_db.query(AIUsage).all()
    assert len(rows) == 1
    assert (rows[0].input_tokens, rows[0].output_tokens) == (1234, 567)
    assert rows[0].operation == "analyze"


def test_provider_failure_writes_no_row(engine_db, monkeypatch):
    """Nothing was spent, so nothing is metered."""
    from app.services.ai_engine import ANALYZE_TOOL

    e = _engine(engine_db)

    def _boom(**kw):
        raise RuntimeError("upstream down")

    monkeypatch.setattr(e._openai.chat.completions, "create", _boom)
    assert e._call_tool("sys", "user", ANALYZE_TOOL, operation="analyze") is None
    assert engine_db.query(AIUsage).count() == 0


def test_metering_failure_does_not_break_the_call(engine_db, monkeypatch):
    """A metering write that breaks the feature it meters is strictly worse
    than a missing row — the provider already answered and already billed."""
    from app.services.ai_engine import ANALYZE_TOOL

    e = _engine(engine_db)

    class _Usage:
        prompt_tokens, completion_tokens = 10, 5

    class _Tc:
        function = type(
            "F", (), {"name": "provide_recommendations", "arguments": '{"recommendations": []}'}
        )()

    class _Resp:
        usage = _Usage()
        choices = [type("C", (), {"message": type("M", (), {"tool_calls": [_Tc()]})()})()]

    monkeypatch.setattr(e._openai.chat.completions, "create", lambda **kw: _Resp())
    monkeypatch.setattr(
        engine_db, "add", lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("db down"))
    )

    # The tool result still comes back despite metering blowing up.
    assert e._call_tool("sys", "user", ANALYZE_TOOL, operation="analyze") == {
        "recommendations": []
    }
