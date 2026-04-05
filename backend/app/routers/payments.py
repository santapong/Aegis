from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from loguru import logger

from ..config import get_settings
from ..database import get_db
from ..models.payment import Payment, PaymentStatus
from ..schemas.payment import (
    CheckoutSessionCreate,
    CheckoutSessionResponse,
    PaymentResponse,
    StripeConfigResponse,
)

router = APIRouter(prefix="/api/payments", tags=["payments"])
settings = get_settings()


def _get_stripe():
    """Lazily import and configure Stripe."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    try:
        import stripe
        stripe.api_key = settings.stripe_secret_key
        return stripe
    except ImportError:
        raise HTTPException(status_code=503, detail="Stripe SDK not installed")


@router.get("/config", response_model=StripeConfigResponse)
def get_stripe_config():
    return StripeConfigResponse(
        publishable_key=settings.stripe_publishable_key,
        mode=settings.stripe_mode,
        configured=bool(settings.stripe_secret_key and settings.stripe_publishable_key),
    )


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
def create_checkout_session(
    data: CheckoutSessionCreate,
    db: Session = Depends(get_db),
):
    stripe = _get_stripe()

    # Convert dollars to cents
    amount_cents = int(data.amount * 100)

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": data.currency,
                    "unit_amount": amount_cents,
                    "product_data": {
                        "name": data.description or "Aegis Payment",
                    },
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=data.success_url or "http://localhost:3000/payments?status=success",
            cancel_url=data.cancel_url or "http://localhost:3000/payments?status=cancelled",
        )
    except Exception as e:
        logger.error("Stripe checkout session creation failed: {err}", err=str(e))
        raise HTTPException(status_code=400, detail=str(e))

    # Record the payment locally
    payment = Payment(
        stripe_session_id=session.id,
        amount=data.amount,
        currency=data.currency,
        status=PaymentStatus.pending,
        description=data.description,
    )
    db.add(payment)
    db.commit()

    return CheckoutSessionResponse(
        session_id=session.id,
        checkout_url=session.url,
    )


@router.get("/", response_model=list[PaymentResponse])
def list_payments(
    limit: int = Query(default=50, le=200),
    status: PaymentStatus | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Payment)
    if status:
        query = query.filter(Payment.status == status)
    return query.order_by(Payment.created_at.desc()).limit(limit).all()


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    stripe = _get_stripe()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error("Stripe webhook error: {err}", err=str(e))
        raise HTTPException(status_code=400, detail=str(e))

    # Handle events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        payment = (
            db.query(Payment)
            .filter(Payment.stripe_session_id == session["id"])
            .first()
        )
        if payment:
            payment.status = PaymentStatus.succeeded
            payment.stripe_payment_id = session.get("payment_intent")
            payment.stripe_customer_id = session.get("customer")
            db.commit()
            logger.info("Payment {id} succeeded", id=payment.id)

    elif event["type"] == "checkout.session.expired":
        session = event["data"]["object"]
        payment = (
            db.query(Payment)
            .filter(Payment.stripe_session_id == session["id"])
            .first()
        )
        if payment:
            payment.status = PaymentStatus.cancelled
            db.commit()

    elif event["type"] == "charge.refunded":
        charge = event["data"]["object"]
        payment = (
            db.query(Payment)
            .filter(Payment.stripe_payment_id == charge.get("payment_intent"))
            .first()
        )
        if payment:
            payment.status = PaymentStatus.refunded
            db.commit()

    return {"received": True}
