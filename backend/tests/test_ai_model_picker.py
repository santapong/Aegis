"""Tests for the AI model picker — GET /api/ai/models and the stored override.

Covers the two behaviours the design doc leans on
(docs/design/006-ai-provider-configuration.md, Decision 2):

1. the model list is *fetched* from the provider, not hard-coded, and
2. an upstream failure degrades to a usable single-entry response rather
   than a 500 or an empty dropdown.
"""
import pytest

from app.cache import get_cache
from app.models.user_preferences import UserPreferences
from app.services import ai_engine as ai_engine_module

from .conftest import _register


@pytest.fixture(autouse=True)
def _clear_models_cache():
    """Drop the cached model list around every test.

    Must delete the *keys*, not just call `reset_cache_for_tests()`. That
    helper only drops the process-local singleton, which is enough for the
    in-memory backend but a no-op against a shared store — and CI runs the
    suite with CACHE_BACKEND=redis. Without this, the first test to populate
    the cache leaks its stubbed list into every later test, and the
    provider-unreachable cases silently get a cache hit instead of exercising
    the failure path.
    """
    get_cache().delete_prefix("ai:models:")
    yield
    get_cache().delete_prefix("ai:models:")


def _pm(model_id, supports_tools=None, is_text_to_text=None):
    """Build a ProviderModel entry the way list_provider_models() would."""
    return {
        "id": model_id,
        "supports_tools": supports_tools,
        "is_text_to_text": is_text_to_text,
        "prompt_price": None,
        "completion_price": None,
    }


def _stub_models(monkeypatch, models):
    """`models` may be plain ids or full ProviderModel dicts."""
    entries = [m if isinstance(m, dict) else _pm(m) for m in models]
    monkeypatch.setattr(
        ai_engine_module, "list_provider_models", lambda: list(entries)
    )
    # The router imports the symbol directly, so patching the module alone
    # would leave the router's reference bound to the original function.
    monkeypatch.setattr(
        "app.routers.ai.list_provider_models", lambda: list(entries)
    )


def _stub_models_failing(monkeypatch, exc):
    def _boom():
        raise exc

    monkeypatch.setattr("app.routers.ai.list_provider_models", _boom)


def test_models_returns_fetched_list(client, monkeypatch):
    headers, _ = _register(client, email="m1@example.com", username="picker1")
    _stub_models(monkeypatch, ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"])

    r = client.get("/api/ai/models", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()

    assert body["stale"] is False
    assert body["error"] is None
    assert "llama-3.1-8b-instant" in body["models"]
    # No override stored yet, so the effective model is the env default.
    assert body["override"] is None
    assert body["current"] == body["default"]


def test_models_degrades_when_upstream_fails(client, monkeypatch):
    """An unreachable provider must not 500 the settings page."""
    headers, _ = _register(client, email="m2@example.com", username="picker2")
    _stub_models_failing(monkeypatch, RuntimeError("connection refused"))

    r = client.get("/api/ai/models", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()

    assert body["stale"] is True
    assert "connection refused" in body["error"]
    # Degraded, but still usable: the model in effect is offered back so the
    # dropdown renders a selection rather than an empty list.
    assert body["models"] == [body["current"]]


def test_failed_fetch_is_not_cached(client, monkeypatch):
    """A transient outage must not pin a degraded list for the full TTL."""
    headers, _ = _register(client, email="m3@example.com", username="picker3")

    _stub_models_failing(monkeypatch, RuntimeError("temporary"))
    assert client.get("/api/ai/models", headers=headers).json()["stale"] is True

    # Provider recovers — the very next call must fetch again, not serve a
    # cached failure.
    _stub_models(monkeypatch, ["llama-3.3-70b-versatile"])
    body = client.get("/api/ai/models", headers=headers).json()
    assert body["stale"] is False
    assert body["models"] == ["llama-3.3-70b-versatile"]


def test_current_model_always_selectable(client, monkeypatch):
    """If the provider stops listing the model the user is on, the picker must
    still offer it — otherwise the UI looks like it silently reset itself."""
    headers, _ = _register(client, email="m4@example.com", username="picker4")

    client.put(
        "/api/preferences", json={"ai_model": "retired-model-v1"}, headers=headers
    )
    _stub_models(monkeypatch, ["llama-3.3-70b-versatile"])

    body = client.get("/api/ai/models", headers=headers).json()
    assert body["current"] == "retired-model-v1"
    assert body["override"] == "retired-model-v1"
    assert body["models"][0] == "retired-model-v1"
    assert "llama-3.3-70b-versatile" in body["models"]


def test_override_round_trips_through_preferences(client, monkeypatch):
    headers, _ = _register(client, email="m5@example.com", username="picker5")
    _stub_models(monkeypatch, ["a-model", "b-model"])

    r = client.put("/api/preferences", json={"ai_model": "b-model"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["ai_model"] == "b-model"

    body = client.get("/api/ai/models", headers=headers).json()
    assert body["current"] == "b-model"
    assert body["override"] == "b-model"


def test_empty_string_clears_override(client, monkeypatch):
    """The UI sends "" for "use the default" — that must clear the override,
    not pin the model to a blank string (which would 404 every AI call)."""
    headers, _ = _register(client, email="m6@example.com", username="picker6")
    _stub_models(monkeypatch, ["a-model"])

    client.put("/api/preferences", json={"ai_model": "a-model"}, headers=headers)
    r = client.put("/api/preferences", json={"ai_model": ""}, headers=headers)
    assert r.status_code == 200
    assert r.json()["ai_model"] is None

    body = client.get("/api/ai/models", headers=headers).json()
    assert body["override"] is None
    assert body["current"] == body["default"]


def test_override_is_per_user(client, monkeypatch):
    h1, _ = _register(client, email="m7a@example.com", username="picker7a")
    h2, _ = _register(client, email="m7b@example.com", username="picker7b")
    _stub_models(monkeypatch, ["a-model", "b-model"])

    client.put("/api/preferences", json={"ai_model": "b-model"}, headers=h1)

    assert client.get("/api/ai/models", headers=h2).json()["override"] is None
    assert client.get("/api/ai/models", headers=h1).json()["override"] == "b-model"


def test_models_requires_auth(client):
    r = client.get("/api/ai/models")
    assert r.status_code in (401, 403)


# --- AIEngine model resolution -------------------------------------------------


@pytest.fixture
def db_session():
    """A standalone session. The `client` fixture keeps its session private,
    and these tests exercise AIEngine directly rather than over HTTP."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.database import Base

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def _groq_provider(monkeypatch):
    """AIEngine's constructor requires a credential for the configured
    provider. Pin these tests to Groq with a dummy key so model resolution is
    what's under test, not credential plumbing."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "ai_provider", "groq", raising=False)
    monkeypatch.setattr(settings, "groq_api_key", "gsk-test-not-real", raising=False)


def test_engine_uses_env_model_when_no_override(db_session):
    """Baseline: an untouched deploy behaves exactly as it did before the
    picker existed."""
    from app.services.ai_engine import AIEngine, configured_provider_and_model

    _, default_model = configured_provider_and_model()
    engine = AIEngine(db_session, user_id="no-such-user")
    assert engine.model == default_model


def test_engine_prefers_stored_override(db_session):
    from app.services.ai_engine import AIEngine

    db_session.add(
        UserPreferences(user_id="user-with-override", ai_model="chosen-model")
    )
    db_session.commit()

    engine = AIEngine(db_session, user_id="user-with-override")
    assert engine.model == "chosen-model"


def test_engine_ignores_blank_override(db_session):
    """A blank stored value must read as "no override", not as a model named
    empty-string."""
    from app.services.ai_engine import AIEngine, configured_provider_and_model

    _, default_model = configured_provider_and_model()
    db_session.add(UserPreferences(user_id="blank-override", ai_model=""))
    db_session.commit()

    engine = AIEngine(db_session, user_id="blank-override")
    assert engine.model == default_model


def test_engine_falls_back_when_preferences_lookup_raises(db_session, monkeypatch):
    """A broken preferences read must degrade to the env model, not take down
    the AI feature — same contract as _call_tool's exception handling."""
    from app.services.ai_engine import AIEngine, configured_provider_and_model

    _, default_model = configured_provider_and_model()

    def _boom(*_args, **_kwargs):
        raise RuntimeError("db exploded")

    monkeypatch.setattr(db_session, "query", _boom)

    engine = AIEngine(db_session, user_id="anyone")
    assert engine.model == default_model


# --- capability filtering ------------------------------------------------------


def test_models_without_tool_support_are_hidden(client, monkeypatch):
    """Groq's catalog is mostly speech-to-text, TTS and safety classifiers.
    None of them can serve /api/ai/*, which pins tool_choice to one tool, so
    offering them would present more broken choices than working ones."""
    headers, _ = _register(client, email="cap1@example.com", username="capfilter1")
    _stub_models(
        monkeypatch,
        [
            _pm("llama-3.3-70b-versatile", supports_tools=True),
            _pm("whisper-large-v3", supports_tools=False),
            _pm("meta-llama/llama-prompt-guard-2-86m", supports_tools=False),
        ],
    )

    body = client.get("/api/ai/models", headers=headers).json()
    assert "llama-3.3-70b-versatile" in body["models"]
    assert "whisper-large-v3" not in body["models"]
    assert "meta-llama/llama-prompt-guard-2-86m" not in body["models"]


def test_models_with_unknown_capability_are_kept(client, monkeypatch):
    """Absence of metadata is not evidence of absence — a provider that
    publishes no capability info (Typhoon) must not have its whole catalog
    filtered away."""
    headers, _ = _register(client, email="cap2@example.com", username="capfilter2")
    _stub_models(monkeypatch, [_pm("typhoon-v2.1-12b-instruct", supports_tools=None)])

    body = client.get("/api/ai/models", headers=headers).json()
    assert "typhoon-v2.1-12b-instruct" in body["models"]


def test_speech_models_are_hidden(client, monkeypatch):
    """Groq's speech models publish no `supported_features` at all, so a
    features-only filter would let them through. They are excluded on
    modality instead: whisper is audio->transcription, orpheus is
    text->speech."""
    headers, _ = _register(client, email="cap3@example.com", username="capfilter3")
    _stub_models(
        monkeypatch,
        [
            _pm("llama-3.3-70b-versatile", supports_tools=True, is_text_to_text=True),
            _pm("whisper-large-v3", supports_tools=None, is_text_to_text=False),
            _pm("canopylabs/orpheus-v1-english", supports_tools=None, is_text_to_text=False),
        ],
    )

    body = client.get("/api/ai/models", headers=headers).json()
    assert body["models"] == ["llama-3.3-70b-versatile"]


def test_usable_models_needs_both_signals():
    """Neither check alone is sufficient — mirrors the real Groq catalog."""
    from app.services.ai_engine import usable_models

    given = [
        # llama-3.3-70b-versatile — tools + text/text
        _pm("keep-both-true", supports_tools=True, is_text_to_text=True),
        # groq/compound — text/text but json_mode only, no tools
        _pm("drop-no-tools", supports_tools=False, is_text_to_text=True),
        # whisper — no features published, but audio in
        _pm("drop-not-text", supports_tools=None, is_text_to_text=False),
        # typhoon — publishes neither; must survive
        _pm("keep-unknown", supports_tools=None, is_text_to_text=None),
    ]
    assert [m["id"] for m in usable_models(given)] == ["keep-both-true", "keep-unknown"]
