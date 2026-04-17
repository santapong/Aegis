"""Populate a database with realistic demo data for launch/demos.

Usage (module):
    python -m backend.app.seeds.demo

Or via Makefile: ``make seed``. The script is idempotent on username
(``demo@aegis.local``) — re-running wipes only the demo user's rows,
not any other user.
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from ..auth import hash_password
from ..database import SessionLocal
from ..models.budget import Budget
from ..models.debt import Debt
from ..models.notification import Notification, NotificationType
from ..models.plan import Plan
from ..models.savings_goal import SavingsGoal
from ..models.tag import Tag
from ..models.transaction import Transaction, TransactionType
from ..models.user import User

DEMO_EMAIL = "demo@aegis.local"
DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo-password-123"

EXPENSE_CATEGORIES = [
    ("groceries", 40, 220),
    ("rent", 1800, 1800),
    ("utilities", 80, 180),
    ("dining", 15, 95),
    ("transport", 8, 45),
    ("subscriptions", 12, 40),
    ("entertainment", 20, 120),
    ("health", 25, 300),
    ("shopping", 30, 220),
]

INCOME_SOURCES = [
    ("salary", 5800, 6200),
    ("freelance", 400, 1400),
]


def _wipe_existing(db: Session, user: User) -> None:
    db.query(Transaction).filter(Transaction.user_id == user.id).delete(synchronize_session=False)
    db.query(Budget).filter(Budget.user_id == user.id).delete(synchronize_session=False)
    db.query(SavingsGoal).filter(SavingsGoal.user_id == user.id).delete(synchronize_session=False)
    db.query(Debt).filter(Debt.user_id == user.id).delete(synchronize_session=False)
    db.query(Plan).filter(Plan.user_id == user.id).delete(synchronize_session=False)
    db.query(Tag).filter(Tag.user_id == user.id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    db.commit()


def seed(db: Session) -> User:
    random.seed(17)

    user = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if user is None:
        user = User(
            email=DEMO_EMAIL,
            username=DEMO_USERNAME,
            hashed_password=hash_password(DEMO_PASSWORD),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        _wipe_existing(db, user)

    today = date.today()
    start = today - timedelta(days=120)

    # Tags
    tag_names = ["essential", "recurring", "work", "fun"]
    tags = [Tag(user_id=user.id, name=n, color="#6366f1") for n in tag_names]
    db.add_all(tags)
    db.commit()

    # Transactions — 120 days of mixed income/expense
    txns: list[Transaction] = []
    cursor = start
    while cursor <= today:
        # Daily expenses
        for _ in range(random.randint(0, 3)):
            cat, lo, hi = random.choice(EXPENSE_CATEGORIES)
            amt = round(random.uniform(lo, hi), 2)
            txns.append(
                Transaction(
                    user_id=user.id,
                    amount=Decimal(str(amt)),
                    type=TransactionType.expense,
                    category=cat,
                    date=cursor,
                    description=f"{cat.capitalize()} — auto-generated",
                    is_recurring=False,
                )
            )
        # Monthly salary on the 1st
        if cursor.day == 1:
            src, lo, hi = INCOME_SOURCES[0]
            txns.append(
                Transaction(
                    user_id=user.id,
                    amount=Decimal(str(round(random.uniform(lo, hi), 2))),
                    type=TransactionType.income,
                    category=src,
                    date=cursor,
                    description="Monthly salary",
                    is_recurring=False,
                )
            )
        # Random freelance
        if random.random() < 0.04:
            src, lo, hi = INCOME_SOURCES[1]
            txns.append(
                Transaction(
                    user_id=user.id,
                    amount=Decimal(str(round(random.uniform(lo, hi), 2))),
                    type=TransactionType.income,
                    category=src,
                    date=cursor,
                    description="Freelance project",
                    is_recurring=False,
                )
            )
        cursor += timedelta(days=1)
    db.add_all(txns)

    # Budgets — one per core category, current month
    month_start = today.replace(day=1)
    next_month = (month_start + timedelta(days=32)).replace(day=1)
    month_end = next_month - timedelta(days=1)
    budgets = [
        Budget(user_id=user.id, name="Groceries", amount=Decimal("600"), spent=Decimal("0"),
               period_start=month_start, period_end=month_end, category="groceries"),
        Budget(user_id=user.id, name="Dining out", amount=Decimal("250"), spent=Decimal("0"),
               period_start=month_start, period_end=month_end, category="dining"),
        Budget(user_id=user.id, name="Entertainment", amount=Decimal("150"), spent=Decimal("0"),
               period_start=month_start, period_end=month_end, category="entertainment"),
    ]
    db.add_all(budgets)

    # Savings goals
    goals = [
        SavingsGoal(
            user_id=user.id, name="Emergency fund", description="3 months runway",
            target_amount=Decimal("10000"), current_amount=Decimal("4250"),
            deadline=today + timedelta(days=220), category="emergency",
            color="#10b981", icon="shield",
        ),
        SavingsGoal(
            user_id=user.id, name="Vacation", description="Japan trip",
            target_amount=Decimal("4500"), current_amount=Decimal("1100"),
            deadline=today + timedelta(days=150), category="travel",
            color="#6366f1", icon="plane",
        ),
    ]
    db.add_all(goals)

    # Debts
    debts = [
        Debt(
            user_id=user.id, name="Credit card",
            description="Primary card",
            balance=Decimal("3200"), original_balance=Decimal("5000"),
            interest_rate=21.9, minimum_payment=Decimal("100"),
            due_date=today + timedelta(days=10),
            debt_type="credit_card", color="#ef4444",
        ),
    ]
    db.add_all(debts)

    # Seed a couple of notifications so the bell isn't empty on first boot
    db.add_all([
        Notification(
            user_id=user.id, type=NotificationType.milestone,
            title="Welcome to Aegis!",
            message="Your demo workspace is pre-loaded with 120 days of sample data.",
            dedupe_key="seed:welcome",
        ),
        Notification(
            user_id=user.id, type=NotificationType.budget_alert,
            title="Groceries budget at 75%",
            message="You've spent $450 of your $600 groceries cap this month.",
            link="/budgets",
            dedupe_key="seed:budget-groceries",
        ),
    ])

    db.commit()
    return user


def main() -> None:
    db = SessionLocal()
    try:
        user = seed(db)
        print(f"Seeded demo user: {user.email} (password: {DEMO_PASSWORD})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
