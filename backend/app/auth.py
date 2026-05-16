from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
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
