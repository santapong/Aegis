import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..schemas.auth import (
    GoogleSignInRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)
from ..auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_google_id_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


_USERNAME_INVALID_CHARS = re.compile(r"[^a-zA-Z0-9._-]")


def _suggest_username(db: Session, email: str, hint: str | None = None) -> str:
    """Generate a unique username from an email or display-name hint.

    Used when Google sign-in creates a fresh account — the Google
    profile has no username, so we derive one from `email.split("@")[0]`
    or the user's display name, then append digits until it's unique.
    """
    base = (hint or email.split("@", 1)[0]).strip().lower()
    base = _USERNAME_INVALID_CHARS.sub("", base)[:80] or "user"
    candidate = base
    suffix = 0
    while db.query(User).filter(User.username == candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/google", response_model=TokenResponse)
def google_sign_in(data: GoogleSignInRequest, db: Session = Depends(get_db)):
    """Sign in (or register) via a Google ID token.

    Accepts the credential JWT issued by Google Identity Services in the
    browser, verifies it server-side, then:

    1. If a user already has this ``google_subject`` linked → log them in.
    2. Else if a user with the matching ``email`` exists →
       **auto-link**: attach the Google ``sub`` to their account and log
       them in. The original email/password (if any) keeps working.
    3. Else → create a new user with no password set, ``google_subject``
       attached, and a derived unique username.

    Returns the standard JWT just like /login does, so the frontend can
    use the same auth store.
    """
    claims = verify_google_id_token(data.credential)
    google_sub: str = claims["sub"]
    email: str = claims["email"].lower()

    user = db.query(User).filter(User.google_subject == google_sub).first()
    if user is None:
        # Auto-link by email if an email/password account already exists.
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.google_subject = google_sub
        else:
            username = _suggest_username(db, email=email, hint=claims.get("name"))
            user = User(
                email=email,
                username=username,
                hashed_password=None,
                google_subject=google_sub,
            )
            db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/onboarded", response_model=UserResponse)
def mark_onboarded(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stamp ``onboarded_at`` once the user completes (or dismisses) the onboarding tour."""
    if current_user.onboarded_at is None:
        current_user.onboarded_at = datetime.utcnow()
        db.commit()
        db.refresh(current_user)
    return current_user
