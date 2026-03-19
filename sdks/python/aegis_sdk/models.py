"""Pydantic models for the Aegis Money Management API."""

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class EntryType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class DebtStrategy(str, Enum):
    SNOWBALL = "snowball"
    AVALANCHE = "avalanche"


# ---------------------------------------------------------------------------
# Budget
# ---------------------------------------------------------------------------

class BudgetEntry(BaseModel):
    id: Optional[int] = None
    entry_type: Optional[EntryType] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[date] = None
    is_recurring: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BudgetEntryCreate(BaseModel):
    entry_type: EntryType
    amount: float
    category: str
    description: Optional[str] = None
    date: Optional[date] = None
    is_recurring: bool = False


class BudgetEntryUpdate(BaseModel):
    entry_type: Optional[EntryType] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[date] = None
    is_recurring: Optional[bool] = None


class BudgetSummary(BaseModel):
    month: Optional[str] = None
    total_income: Optional[float] = None
    total_expenses: Optional[float] = None
    net: Optional[float] = None
    by_category: Optional[dict[str, float]] = None


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------

class Goal(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    color: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class GoalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_amount: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    color: Optional[str] = None


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    color: Optional[str] = None


# ---------------------------------------------------------------------------
# Milestones
# ---------------------------------------------------------------------------

class Milestone(BaseModel):
    id: Optional[int] = None
    goal_id: Optional[int] = None
    name: Optional[str] = None
    target_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_completed: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class MilestoneCreate(BaseModel):
    goal_id: int
    name: str
    target_amount: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_completed: Optional[bool] = None


# ---------------------------------------------------------------------------
# Debts
# ---------------------------------------------------------------------------

class Debt(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    creditor: Optional[str] = None
    principal: Optional[float] = None
    interest_rate: Optional[float] = None
    minimum_payment: Optional[float] = None
    current_balance: Optional[float] = None
    due_day: Optional[int] = None
    start_date: Optional[date] = None
    color: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class DebtCreate(BaseModel):
    name: str
    creditor: str
    principal: float
    interest_rate: float
    minimum_payment: float
    current_balance: Optional[float] = None
    due_day: Optional[int] = None
    start_date: Optional[date] = None
    color: Optional[str] = None


class DebtUpdate(BaseModel):
    name: Optional[str] = None
    creditor: Optional[str] = None
    principal: Optional[float] = None
    interest_rate: Optional[float] = None
    minimum_payment: Optional[float] = None
    current_balance: Optional[float] = None
    due_day: Optional[int] = None
    start_date: Optional[date] = None
    color: Optional[str] = None


class DebtSummary(BaseModel):
    total_debt: Optional[float] = None
    total_minimum_payments: Optional[float] = None
    debts: Optional[list[Debt]] = None


class PayoffPlan(BaseModel):
    strategy: Optional[DebtStrategy] = None
    extra_payment: Optional[float] = None
    total_months: Optional[int] = None
    total_interest: Optional[float] = None
    payoff_order: Optional[list[dict[str, Any]]] = None


# ---------------------------------------------------------------------------
# Savings
# ---------------------------------------------------------------------------

class SavingsAccount(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    current_balance: Optional[float] = None
    interest_rate: Optional[float] = None
    color: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SavingsAccountCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_amount: Optional[float] = None
    current_balance: float = 0.0
    interest_rate: Optional[float] = None
    color: Optional[str] = None


class SavingsAccountUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = None
    interest_rate: Optional[float] = None
    color: Optional[str] = None


class SavingsTransaction(BaseModel):
    amount: float


class SavingsSummary(BaseModel):
    total_savings: Optional[float] = None
    accounts: Optional[list[SavingsAccount]] = None


# ---------------------------------------------------------------------------
# Bills
# ---------------------------------------------------------------------------

class Bill(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[date] = None
    category: Optional[str] = None
    is_recurring: Optional[bool] = None
    frequency: Optional[str] = None
    is_paid: Optional[bool] = None
    auto_pay: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BillCreate(BaseModel):
    name: str
    amount: float
    due_date: date
    category: Optional[str] = None
    is_recurring: bool = False
    frequency: Optional[str] = None
    auto_pay: bool = False


class BillUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[date] = None
    category: Optional[str] = None
    is_recurring: Optional[bool] = None
    frequency: Optional[str] = None
    auto_pay: Optional[bool] = None


class BillSummary(BaseModel):
    total_due: Optional[float] = None
    total_paid: Optional[float] = None
    upcoming_count: Optional[int] = None


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class MonthlyTrend(BaseModel):
    month: Optional[str] = None
    income: Optional[float] = None
    expenses: Optional[float] = None
    net: Optional[float] = None


class CategoryBreakdown(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    percentage: Optional[float] = None


class YearlySummary(BaseModel):
    year: Optional[int] = None
    total_income: Optional[float] = None
    total_expenses: Optional[float] = None
    net: Optional[float] = None
    monthly_data: Optional[list[MonthlyTrend]] = None


class NetWorth(BaseModel):
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    net_worth: Optional[float] = None


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------

class CalendarEvent(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None
    date: Optional[date] = None
    event_type: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

class AnalysisResult(BaseModel):
    id: Optional[int] = None
    summary: Optional[str] = None
    recommendations: Optional[list[str]] = None
    created_at: Optional[datetime] = None
    custom_prompt: Optional[str] = None
    raw_response: Optional[str] = None


class ChatMessage(BaseModel):
    role: Optional[str] = None
    content: Optional[str] = None
    timestamp: Optional[datetime] = None


class ChatResponse(BaseModel):
    message: Optional[str] = None
    session_id: Optional[str] = None


class ChatSession(BaseModel):
    session_id: Optional[str] = None
    created_at: Optional[datetime] = None
    message_count: Optional[int] = None


class AIStatus(BaseModel):
    available: Optional[bool] = None
    model: Optional[str] = None
    provider: Optional[str] = None


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

class Snapshot(BaseModel):
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    data: Optional[dict[str, Any]] = None
    label: Optional[str] = None


class TimelineEntry(BaseModel):
    id: Optional[int] = None
    event_type: Optional[str] = None
    description: Optional[str] = None
    timestamp: Optional[datetime] = None
    data: Optional[dict[str, Any]] = None
