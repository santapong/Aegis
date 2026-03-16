from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()


class Account(Base):
    __tablename__ = "accounts"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # Asset, Liability, Equity, Revenue, Expense


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    date = Column(DateTime, default=datetime.utcnow)
    description = Column(String)


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    account_id = Column(Integer, ForeignKey("accounts.id"))
    amount = Column(Float, nullable=False)  # Positive for Debit, Negative for Credit

    transaction = relationship("Transaction")
    account = relationship("Account")


class Goal(Base):
    __tablename__ = "goals"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    target_amount = Column(Float, nullable=True)
    current_amount = Column(Float, default=0.0)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    color = Column(String, default="#3b82f6")
    status = Column(String, default="active")  # active, completed, paused
    created_at = Column(DateTime, default=datetime.utcnow)

    milestones = relationship("Milestone", back_populates="goal", cascade="all, delete-orphan")


class Milestone(Base):
    __tablename__ = "milestones"
    id = Column(Integer, primary_key=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String, default="pending")  # pending, in_progress, completed
    progress = Column(Float, default=0.0)  # 0-100

    goal = relationship("Goal", back_populates="milestones")


class BudgetEntry(Base):
    __tablename__ = "budget_entries"
    id = Column(Integer, primary_key=True)
    entry_type = Column(String, nullable=False)  # "income" or "expense"
    amount = Column(Float, nullable=False)  # always positive
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date = Column(Date, nullable=False)
    is_recurring = Column(String, nullable=True)  # null, "monthly", "weekly", "yearly"
    created_at = Column(DateTime, default=datetime.utcnow)


class Debt(Base):
    __tablename__ = "debts"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    creditor = Column(String, nullable=True)
    principal = Column(Float, nullable=False)
    interest_rate = Column(Float, default=0.0)  # annual percentage
    minimum_payment = Column(Float, default=0.0)
    current_balance = Column(Float, nullable=False)
    due_day = Column(Integer, nullable=True)  # 1-31
    start_date = Column(Date, nullable=False)
    status = Column(String, default="active")  # active, paid_off, deferred
    color = Column(String, default="#ef4444")
    created_at = Column(DateTime, default=datetime.utcnow)


class SavingsJar(Base):
    __tablename__ = "savings_jars"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0)
    icon = Column(String, default="jar")
    color = Column(String, default="#10b981")
    deadline = Column(Date, nullable=True)
    auto_save_amount = Column(Float, default=0.0)
    auto_save_frequency = Column(String, nullable=True)  # weekly, monthly, null
    created_at = Column(DateTime, default=datetime.utcnow)


class BillReminder(Base):
    __tablename__ = "bill_reminders"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=True)
    due_day = Column(Integer, nullable=False)  # 1-31
    frequency = Column(String, default="monthly")  # monthly, quarterly, yearly
    is_active = Column(String, default="true")
    last_paid_date = Column(Date, nullable=True)
    next_due_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
