"""User preferences router.

Auto-provisions a row with sensible defaults on first GET so the frontend
never has to deal with a 404 — preferences are conceptually "always present"
for an authenticated user.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models.user import User
from ..models.user_preferences import UserPreferences
from ..schemas.user_preferences import UserPreferencesResponse, UserPreferencesUpdate

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


def _get_or_create(db: Session, user_id: str) -> UserPreferences:
    """Return the row for this user, creating it with column defaults if
    absent. Used by both GET and PUT so either endpoint is safe to call
    first."""
    prefs = (
        db.query(UserPreferences)
        .filter(UserPreferences.user_id == user_id)
        .first()
    )
    if prefs is None:
        prefs = UserPreferences(user_id=user_id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


@router.get("", response_model=UserPreferencesResponse)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_or_create(db, current_user.id)


@router.put("", response_model=UserPreferencesResponse)
def update_preferences(
    data: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = _get_or_create(db, current_user.id)
    # exclude_unset so a partial PUT doesn't clobber fields the client
    # didn't include in the payload.
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(prefs, key, val)
    db.commit()
    db.refresh(prefs)
    return prefs
