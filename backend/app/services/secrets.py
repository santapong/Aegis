"""Encryption for operator-supplied secrets.

Backs the `user_secrets` table (see docs/design/006, Decision 4): a general
store whose first consumer is the AI provider key and whose designed-for second
is the LINE Messaging token already on the roadmap.

**Key material.** Uses `SECRETS_ENCRYPTION_KEY` when set. When it isn't — the
common case for a self-hosted deploy that just ran `make setup` — the key is
derived deterministically from `JWT_SECRET_KEY` via HKDF. That choice is
deliberate: requiring a new env var would break every existing deploy on
upgrade, and this app's whole posture is single-operator self-host.

The coupling has a real consequence, stated plainly because it will bite
someone otherwise: **rotating `JWT_SECRET_KEY` without setting
`SECRETS_ENCRYPTION_KEY` makes stored secrets undecryptable.** That is
survivable rather than catastrophic — resolution falls back to the `.env`
value and the operator re-enters the key in Settings — which is why the
trade-off is acceptable here. An operator who wants the two lifecycles
separated sets `SECRETS_ENCRYPTION_KEY` explicitly.
"""
from __future__ import annotations

import base64
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from loguru import logger

from ..config import get_settings

# Fixed, non-secret domain separator. Changing it rotates every derived key,
# so it must stay stable across releases.
_HKDF_INFO = b"aegis-user-secrets-v1"


@lru_cache(maxsize=2)
def _fernet_for(key_material: str) -> Fernet:
    """Build (and cache) a Fernet from raw key material.

    Cached on the material itself rather than on nothing, so a settings change
    that alters the key yields a different cache entry instead of silently
    reusing the old cipher.
    """
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=_HKDF_INFO,
    ).derive(key_material.encode("utf-8"))
    return Fernet(base64.urlsafe_b64encode(derived))


def _cipher() -> Fernet:
    settings = get_settings()
    material = settings.secrets_encryption_key or settings.jwt_secret_key
    if not material:
        # Unreachable in practice — config validation requires a JWT secret —
        # but encrypting under an empty key would be worse than failing.
        raise RuntimeError(
            "No key material for secret encryption: set SECRETS_ENCRYPTION_KEY "
            "or JWT_SECRET_KEY."
        )
    return _fernet_for(material)


def encrypt(plaintext: str) -> str:
    return _cipher().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str) -> str | None:
    """Plaintext, or None when the value cannot be decrypted.

    Returns None rather than raising so a key rotation degrades to "the stored
    secret is unreadable, fall back to env" instead of taking down every AI
    route. The specific value is never logged.
    """
    try:
        return _cipher().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        logger.warning(
            "stored secret could not be decrypted — has JWT_SECRET_KEY or "
            "SECRETS_ENCRYPTION_KEY changed? Falling back to env."
        )
        return None


def mask(plaintext: str) -> str:
    """A display form that identifies a secret without revealing it.

    `gsk_abc...` -> `gsk_…4f2a`. Short values are fully masked rather than
    partially shown, since a handful of characters from a short secret is a
    meaningful fraction of it.
    """
    if len(plaintext) <= 8:
        return "…"
    prefix = plaintext[:4]
    return f"{prefix}…{plaintext[-4:]}"


def reset_cipher_cache_for_tests() -> None:
    """Drop the derived-cipher cache. Used by tests that rotate key material."""
    _fernet_for.cache_clear()


def invalidate_ai_clients() -> None:
    """Drop caches that would otherwise pin a stale credential.

    Two independent caches hold onto the old key after a secret changes:

    * `get_settings()` is `lru_cache`d, so anything reading config keeps the
      previous values.
    * `_cached_anthropic_client` / `_cached_openai_client` are keyed on the API
      key, so a *changed* key produces a new entry — but the stale entry stays
      resident and `maxsize=4` means it can still be serving.

    Clearing both is what makes a key change take effect without a restart.
    Imported lazily to avoid a circular import: ai_engine imports config, and
    this module is imported by routers that ai_engine does not know about.
    """
    from ..config import get_settings as _get_settings
    from .ai_engine import _cached_anthropic_client, _cached_openai_client

    _get_settings.cache_clear()
    _cached_anthropic_client.cache_clear()
    _cached_openai_client.cache_clear()
