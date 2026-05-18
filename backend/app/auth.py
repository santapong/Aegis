from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import JWTError, jwt
from loguru import logger
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False so the dependency falls through to the cookie when
# no Authorization header is present, rather than 401-ing immediately.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Name of the httpOnly cookie that carries the JWT for browser clients.
# Native API clients (CLI, mobile, scripts) keep using
# ``Authorization: Bearer ...``. The auth dependency accepts either —
# header takes precedence so a deliberate Authorization value can
# override the cookie (useful for impersonation in admin tools).
AUTH_COOKIE_NAME = "aegis_session"


def _cookie_attrs() -> dict:
    """Centralise cookie attribute selection so set + clear can't drift.

    SameSite is configurable (lax / strict / none). "none" is required
    when the frontend reaches the backend cross-origin (see
    ``auth_cookie_samesite`` in config) and forces Secure=True even in
    debug, because browsers reject ``SameSite=None`` without it.
    """
    settings = get_settings()
    samesite_raw = (settings.auth_cookie_samesite or "lax").lower()
    if samesite_raw not in ("lax", "strict", "none"):
        # Belt-and-braces: never accidentally emit a non-spec value.
        samesite_raw = "lax"
    # SameSite=None demands Secure regardless of debug.
    secure = (not settings.debug) or samesite_raw == "none"
    return {
        "httponly": True,
        "secure": secure,
        "samesite": samesite_raw,
        "path": "/",
    }


def set_auth_cookie(response: Response, token: str) -> None:
    """Attach the JWT as an httpOnly cookie on the response.

    Why httpOnly: JavaScript can't read it, so an XSS payload can't
    exfiltrate the session — meaningfully smaller blast radius than
    JWT-in-localStorage (any injected script can scrape that).

    Why SameSite=Lax by default: blocks the cookie on cross-site POST
    navigation (CSRF). Lax (not Strict) so external links — Stripe
    checkout return URLs, password-reset emails when they ship — still
    carry the session. Operators with a cross-origin frontend
    (``NEXT_PUBLIC_API_URL`` set) should switch to
    ``AUTH_COOKIE_SAMESITE=none`` and rely on Secure+HTTPS for
    transport safety.

    Why Secure: cookie only over HTTPS. In dev (``debug=true``) we drop
    Secure so localhost works, UNLESS SameSite=None — that combination
    is required by browsers regardless of dev mode.
    """
    settings = get_settings()
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        max_age=settings.jwt_expire_minutes * 60,
        **_cookie_attrs(),
    )


def clear_auth_cookie(response: Response) -> None:
    """Drop the session cookie on logout.

    Attributes must mirror ``set_auth_cookie`` exactly (httpOnly,
    secure, samesite, path). Older Safari builds silently ignore the
    delete when ``Secure`` is set on the original and absent on the
    clear, so the cookie sticks around and "logout" does nothing
    visible.
    """
    response.delete_cookie(key=AUTH_COOKIE_NAME, **_cookie_attrs())


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Verify a password against its bcrypt hash.

    ``hashed_password`` is ``None`` for users who registered via Google
    and never set a password — those users cannot log in via the
    email/password endpoint, so we short-circuit to False.
    """
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)


def verify_google_id_token(credential: str) -> dict:
    """Verify a Google ID token against the configured client ID.

    Returns the decoded token claims on success. Raises ``HTTPException``
    on any failure (invalid signature, wrong audience, expired token,
    unverified email, OAuth disabled). The Google library handles the
    JWKS fetch + signature check + ``aud`` / ``iss`` / ``exp`` validation
    internally — we then enforce ``email_verified`` ourselves so a user
    can't sign in via a Google email they haven't proven they own.
    """
    settings = get_settings()
    if not settings.google_oauth_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured on this server.",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.google_oauth_client_id,
        )
    except ValueError as exc:
        # Library raises ValueError on signature failure / wrong audience
        # / expired token. Log the underlying reason but only surface a
        # generic message to the client to avoid leaking validation
        # internals.
        logger.warning("Google ID token rejected: {}", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google sign-in credential.",
        )

    if claims.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google sign-in credential.",
        )

    if not claims.get("email_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Google account email is not verified.",
        )

    return claims


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def get_current_user(
    request: Request,
    header_token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the active user from either an Authorization header OR
    the ``aegis_session`` httpOnly cookie.

    Header is checked first so that scripts and impersonating admins
    can override the cookie deliberately. Browser clients should not
    set the header — the cookie is auto-attached by the browser and the
    JWT never reaches JavaScript.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = header_token or request.cookies.get(AUTH_COOKIE_NAME)
    if not token:
        raise credentials_exception

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user
