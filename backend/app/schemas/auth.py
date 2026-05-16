from datetime import datetime
from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    email: str = Field(..., max_length=255)
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: str
    password: str


class GoogleSignInRequest(BaseModel):
    """Body of POST /api/auth/google.

    ``credential`` is the JWT ID token Google Identity Services hands back
    in the browser callback. The backend verifies its signature against
    Google's public certs, then either signs the matching user in or
    creates a new account.
    """

    credential: str = Field(..., min_length=10)


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    is_active: bool
    onboarded_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
