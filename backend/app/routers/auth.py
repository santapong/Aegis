import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
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
       **REFUSE** with 409. We do NOT auto-link, because Aegis does not
       verify email ownership at register time, so an attacker who
       registers a Google account with a victim's typo'd or recycled
       email could hijack the existing account. The user must log in
       normally and explicitly link Google from settings (POST
       /api/auth/google/link, which requires the existing password).
    3. Else → create a new user with no password set, ``google_subject``
       attached, and a derived unique username.

    Returns the standard JWT just like /login does, so the frontend can
    use the same auth store.
    """
    claims = verify_google_id_token(data.credential)
    google_sub: str = claims.get("sub")
    email_raw = claims.get("email")
    if not google_sub or not email_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential is missing required claims.",
        )
    email: str = email_raw.lower()

    user = db.query(User).filter(User.google_subject == google_sub).first()
    if user is None:
        # Block silent account linking. If an email/password account
        # exists with this address, force the user through the
        # authenticated /link endpoint instead — they prove ownership of
        # the Aegis account by entering its password.
        existing = db.query(User).filter(User.email == email).first()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An account with this email already exists. Please sign in "
                    "with your password, then link Google from your settings."
                ),
            )

        username = _suggest_username(db, email=email, hint=claims.get("name"))
        user = User(
            email=email,
            username=username,
            hashed_password=None,
            google_subject=google_sub,
        )
        db.add(user)
        # Retry once on IntegrityError — racing concurrent first-time
        # sign-ins for the same email base can both pick the same
        # derived username before either commits.
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user.username = _suggest_username(db, email=email, hint=claims.get("name"))
            db.add(user)
            db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/google/link", response_model=UserResponse)
def link_google_account(
    data: GoogleSignInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach a Google account to the currently-logged-in Aegis user.

    Authenticated counterpart to /google. The user proves ownership of
    their Aegis account by being logged in (i.e. having presented their
    JWT, which requires having known the password or a prior Google
    sub). Then this endpoint verifies the Google credential and attaches
    its ``sub`` to the current user.

    Refuses if:
    - The Google account is already linked to a *different* Aegis user.
    - The current user already has a different Google sub attached.
    - The Google email doesn't match the current user's email (prevents
      a user from linking someone else's Google to their own account,
      which would let that other person log in here).
    """
    claims = verify_google_id_token(data.credential)
    google_sub = claims.get("sub")
    google_email = (claims.get("email") or "").lower()
    if not google_sub or not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google credential is missing required claims.",
        )

    if google_email != current_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email does not match this Aegis account.",
        )

    other = db.query(User).filter(User.google_subject == google_sub).first()
    if other is not None and other.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This Google account is already linked to another user.",
        )

    if current_user.google_subject and current_user.google_subject != google_sub:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A different Google account is already linked. Unlink it first.",
        )

    current_user.google_subject = google_sub
    db.commit()
    db.refresh(current_user)
    return current_user


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
