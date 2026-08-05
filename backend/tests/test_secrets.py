"""Tests for operator secret storage (design 006, step 4).

The properties that matter are all negative ones — what must *not* happen:
a plaintext secret must never come back from an endpoint, ride out in an
export, or land in a log line.
"""
import pytest

from app.models.user_secret import SECRET_AI_PROVIDER_KEY, UserSecret
from app.services.secrets import decrypt, encrypt, mask, reset_cipher_cache_for_tests

from .conftest import _register

FAKE_KEY = "gsk_TESTONLYnotarealcredential1234567890"


# --- encryption ----------------------------------------------------------------


def test_round_trip():
    assert decrypt(encrypt(FAKE_KEY)) == FAKE_KEY


def test_ciphertext_does_not_contain_plaintext():
    assert FAKE_KEY not in encrypt(FAKE_KEY)


def test_ciphertext_is_non_deterministic():
    """Fernet includes a random IV, so equal plaintexts must not produce equal
    ciphertexts — otherwise the store leaks 'these two users share a key'."""
    assert encrypt(FAKE_KEY) != encrypt(FAKE_KEY)


def test_decrypt_returns_none_when_key_material_changed(monkeypatch):
    """Rotating JWT_SECRET_KEY without SECRETS_ENCRYPTION_KEY must degrade to
    'unreadable, fall back to env', not raise."""
    from app.config import get_settings

    token = encrypt(FAKE_KEY)

    settings = get_settings()
    reset_cipher_cache_for_tests()
    monkeypatch.setattr(settings, "secrets_encryption_key", "a-different-key-entirely", raising=False)
    try:
        assert decrypt(token) is None
    finally:
        reset_cipher_cache_for_tests()


def test_mask_reveals_only_the_edges():
    m = mask(FAKE_KEY)
    assert m.startswith("gsk_")
    assert m.endswith(FAKE_KEY[-4:])
    assert FAKE_KEY not in m


def test_short_secrets_are_fully_masked():
    """A few characters of a short secret is a meaningful fraction of it."""
    assert mask("abc123") == "…"


# --- endpoint ------------------------------------------------------------------


def test_secret_is_never_returned_in_plaintext(client):
    headers, _ = _register(client, email="s1@example.com", username="secret1")

    r = client.put(
        f"/api/secrets/{SECRET_AI_PROVIDER_KEY}", json={"value": FAKE_KEY}, headers=headers
    )
    assert r.status_code == 200, r.text
    assert FAKE_KEY not in r.text

    r = client.get("/api/secrets", headers=headers)
    assert r.status_code == 200
    assert FAKE_KEY not in r.text

    row = next(x for x in r.json() if x["key_name"] == SECRET_AI_PROVIDER_KEY)
    assert row["configured"] is True
    assert row["masked"].startswith("gsk_")


def test_unset_secret_reports_not_configured(client):
    headers, _ = _register(client, email="s2@example.com", username="secret2")
    row = next(
        x
        for x in client.get("/api/secrets", headers=headers).json()
        if x["key_name"] == SECRET_AI_PROVIDER_KEY
    )
    assert row["configured"] is False
    assert row["masked"] is None


def test_put_replaces_and_delete_clears(client):
    headers, _ = _register(client, email="s3@example.com", username="secret3")
    path = f"/api/secrets/{SECRET_AI_PROVIDER_KEY}"

    client.put(path, json={"value": FAKE_KEY}, headers=headers)
    client.put(path, json={"value": "gsk_SECONDvaluenotrealeither0000000"}, headers=headers)

    row = next(
        x for x in client.get("/api/secrets", headers=headers).json()
        if x["key_name"] == SECRET_AI_PROVIDER_KEY
    )
    assert row["masked"].endswith("0000")

    assert client.delete(path, headers=headers).json()["configured"] is False
    row = next(
        x for x in client.get("/api/secrets", headers=headers).json()
        if x["key_name"] == SECRET_AI_PROVIDER_KEY
    )
    assert row["configured"] is False


def test_unknown_secret_name_rejected(client):
    """Storing a secret nothing reads is worse than a 404 — it looks like it
    worked."""
    headers, _ = _register(client, email="s4@example.com", username="secret4")
    r = client.put("/api/secrets/not_a_real_secret", json={"value": "x"}, headers=headers)
    assert r.status_code == 404


def test_empty_value_rejected(client):
    headers, _ = _register(client, email="s5@example.com", username="secret5")
    r = client.put(
        f"/api/secrets/{SECRET_AI_PROVIDER_KEY}", json={"value": "   "}, headers=headers
    )
    assert r.status_code == 422


def test_secrets_are_per_user(client):
    h1, _ = _register(client, email="s6a@example.com", username="secret6a")
    h2, _ = _register(client, email="s6b@example.com", username="secret6b")

    client.put(
        f"/api/secrets/{SECRET_AI_PROVIDER_KEY}", json={"value": FAKE_KEY}, headers=h1
    )
    row = next(
        x for x in client.get("/api/secrets", headers=h2).json()
        if x["key_name"] == SECRET_AI_PROVIDER_KEY
    )
    assert row["configured"] is False


def test_secrets_require_auth(client):
    assert client.get("/api/secrets").status_code in (401, 403)
    assert client.put(
        f"/api/secrets/{SECRET_AI_PROVIDER_KEY}", json={"value": "x"}
    ).status_code in (401, 403)


# --- guardrails ----------------------------------------------------------------


def test_export_serializer_drops_secret_columns():
    """Asserted against the serializer's denylist, not the current endpoint
    list, so the guarantee still holds when someone adds /users.ndjson."""
    from app.routers.export import _NEVER_EXPORT

    assert "encrypted_value" in _NEVER_EXPORT
    assert "hashed_password" in _NEVER_EXPORT


def test_log_redaction_strips_provider_keys():
    """Provider SDKs put the failing request into exception messages, and
    _call_tool logs those verbatim."""
    from app.services.ai_engine import _redact

    msg = f"401 Unauthorized: Bearer {FAKE_KEY} rejected by provider"
    out = _redact(msg)
    assert FAKE_KEY not in out
    assert "REDACTED" in out
    # Still diagnosable.
    assert "401 Unauthorized" in out


def test_log_redaction_covers_anthropic_style_keys():
    from app.services.ai_engine import _redact

    key = "sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAA"
    assert key not in _redact(f"error with {key} here")


# --- resolution order ----------------------------------------------------------


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
def _groq_env(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "ai_provider", "groq", raising=False)
    monkeypatch.setattr(settings, "groq_api_key", "gsk_ENVvaluenotreal000000000", raising=False)


def test_stored_key_overrides_env(engine_db):
    from app.services.ai_engine import AIEngine

    engine_db.add(
        UserSecret(
            user_id="has-secret",
            key_name=SECRET_AI_PROVIDER_KEY,
            encrypted_value=encrypt(FAKE_KEY),
        )
    )
    engine_db.commit()

    e = AIEngine(engine_db, user_id="has-secret")
    assert e._stored_provider_key() == FAKE_KEY


def test_env_used_when_no_stored_key(engine_db):
    """An operator who never opens Settings keeps .env behaviour untouched."""
    from app.services.ai_engine import AIEngine

    e = AIEngine(engine_db, user_id="no-secret")
    assert e._stored_provider_key() is None


def test_secret_lookup_failure_degrades_to_env(engine_db, monkeypatch):
    from app.services.ai_engine import AIEngine

    e = AIEngine(engine_db, user_id="anyone")

    def _boom(*_a, **_k):
        raise RuntimeError("db down")

    monkeypatch.setattr(engine_db, "query", _boom)
    assert e._stored_provider_key() is None
