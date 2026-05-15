"""Session resolution for the Aegis MCP server.

The stdio MCP server runs locally on the user's machine, so the trust boundary
is "anyone who can spawn this binary already has DB access". We resolve a user
once at startup via the ``AEGIS_USER_EMAIL`` env var (UUIDs are painful to
paste; emails are the natural choice) and reuse that user for every tool call.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.user import User


class MCPSessionError(RuntimeError):
    """Raised when the MCP server cannot resolve its user identity."""


_cached_user_id: str | None = None


def resolve_user_id() -> str:
    """Resolve the configured user via ``AEGIS_USER_EMAIL``.

    The lookup is cached for the lifetime of the process; subsequent calls
    return the cached value without touching the DB.
    """
    global _cached_user_id
    if _cached_user_id is not None:
        return _cached_user_id

    email = os.environ.get("AEGIS_USER_EMAIL", "").strip().lower()
    if not email:
        raise MCPSessionError(
            "AEGIS_USER_EMAIL is not set. Add it to the MCP client config "
            "(see README) and restart."
        )

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            raise MCPSessionError(
                f"No Aegis user found for AEGIS_USER_EMAIL={email!r}. "
                f"Register the account on the Aegis web app first."
            )
        if not user.is_active:
            raise MCPSessionError(f"User {email!r} is inactive.")
        _cached_user_id = user.id
        return _cached_user_id


@contextmanager
def session_scope() -> Iterator[Session]:
    """Yield a SQLAlchemy session, closing it on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
