"""Operator secret management.

Write-only by design: a secret can be set, replaced, or deleted, but never read
back. `GET` returns a mask (`gsk_…4f2a`) and a `configured` flag — enough to
answer "is a key stored, and is it the one I think it is?" without the endpoint
ever becoming an exfiltration path.

Scoped to the caller. Aegis is single-operator self-host (docs/design/006,
Decision 1), so there is no admin/tenant boundary to enforce here — but when
household mode ships, every account with a login will be able to set its own
key, which is the point at which a `role` gate becomes necessary.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.user import User
from ..models.user_secret import KNOWN_SECRET_NAMES, UserSecret
from ..schemas.secret import SecretStatus, SecretUpdate
from ..services.secrets import decrypt, encrypt, invalidate_ai_clients, mask

router = APIRouter(prefix="/api/secrets", tags=["secrets"])


def _reject_unknown(key_name: str) -> None:
    if key_name not in KNOWN_SECRET_NAMES:
        # Storing a secret nothing will ever read is worse than a 404: it looks
        # like it worked.
        raise HTTPException(
            status_code=404,
            detail={
                "error": "unknown_secret",
                "message": f"Unknown secret {key_name!r}.",
            },
        )


@router.get("", response_model=list[SecretStatus])
def list_secrets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every known secret with whether it is set, and a mask if so.

    Returns a row per *known* name rather than per stored row, so the UI can
    render the full set of slots without knowing which exist.
    """
    stored = {
        s.key_name: s
        for s in db.query(UserSecret).filter(UserSecret.user_id == current_user.id)
    }

    out: list[SecretStatus] = []
    for name in sorted(KNOWN_SECRET_NAMES):
        row = stored.get(name)
        if row is None:
            out.append(SecretStatus(key_name=name, configured=False, masked=None))
            continue
        plaintext = decrypt(row.encrypted_value)
        # A row that won't decrypt (key rotated) is reported as configured but
        # unreadable, rather than as absent — the difference matters when
        # diagnosing "why is it still using the .env value?".
        out.append(
            SecretStatus(
                key_name=name,
                configured=True,
                masked=mask(plaintext) if plaintext else None,
                decryptable=plaintext is not None,
            )
        )
    return out


@router.put("/{key_name}", response_model=SecretStatus)
def set_secret(
    key_name: str,
    data: SecretUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Store or replace a secret. The value is never echoed back."""
    _reject_unknown(key_name)

    value = data.value.strip()
    if not value:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "empty_secret",
                "message": "Value is empty. Use DELETE to clear a secret.",
            },
        )

    row = (
        db.query(UserSecret)
        .filter(UserSecret.user_id == current_user.id, UserSecret.key_name == key_name)
        .first()
    )
    if row is None:
        row = UserSecret(user_id=current_user.id, key_name=key_name)
        db.add(row)
    row.encrypted_value = encrypt(value)
    db.commit()

    # The SDK clients are cached on the credential they were built with, so a
    # new key would otherwise keep hitting the provider with the old one until
    # the process restarted.
    invalidate_ai_clients()

    return SecretStatus(
        key_name=key_name, configured=True, masked=mask(value), decryptable=True
    )


@router.delete("/{key_name}", response_model=SecretStatus)
def delete_secret(
    key_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear a secret, falling resolution back to the env value."""
    _reject_unknown(key_name)

    db.query(UserSecret).filter(
        UserSecret.user_id == current_user.id, UserSecret.key_name == key_name
    ).delete()
    db.commit()
    invalidate_ai_clients()

    return SecretStatus(key_name=key_name, configured=False, masked=None)
