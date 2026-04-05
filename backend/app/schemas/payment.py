from datetime import datetime
from pydantic import BaseModel, Field

from ..models.payment import PaymentStatus


class CheckoutSessionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in dollars")
    currency: str = Field(default="usd", max_length=3)
    description: str | None = Field(default=None, max_length=500)
    success_url: str | None = None
    cancel_url: str | None = None


class CheckoutSessionResponse(BaseModel):
    session_id: str
    checkout_url: str


class PaymentResponse(BaseModel):
    id: str
    stripe_payment_id: str | None
    stripe_customer_id: str | None
    stripe_session_id: str | None
    amount: float
    currency: str
    status: PaymentStatus
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StripeConfigResponse(BaseModel):
    publishable_key: str
    mode: str
    configured: bool
