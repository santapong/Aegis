"""Schemas for /api/secrets.

Note what is absent: there is no response field carrying a plaintext secret.
That is the point — the endpoint is write-only, and the schema is where that
guarantee is easiest to verify.
"""
from pydantic import BaseModel, Field


class SecretStatus(BaseModel):
    key_name: str
    configured: bool
    # `gsk_…4f2a`, or None when unset or undecryptable.
    masked: str | None = None
    # False when a row exists but the key material changed underneath it.
    # Distinguishes "not set" from "set but unreadable", which is the
    # difference between two very different fixes.
    decryptable: bool = True


class SecretUpdate(BaseModel):
    value: str = Field(min_length=1, max_length=4096)
