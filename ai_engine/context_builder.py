"""
Financial context builder — gathers all financial data from DB for AI analysis.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import extract

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "src"))

from database.models import BudgetEntry, Debt, SavingsJar, Goal, BillReminder


def build_financial_context(db: Session) -> dict:
    """Gather all financial data and return as a structured dict for AI consumption."""
    today = date.today()
    current_month = today.strftime("%Y-%m")
    year, month = today.year, today.month

    context = {}

    # Budget summary for current month
    budget_entries = (
        db.query(BudgetEntry)
        .filter(
            extract("year", BudgetEntry.date) == year,
            extract("month", BudgetEntry.date) == month,
        )
        .all()
    )

    total_income = sum(e.amount for e in budget_entries if e.entry_type == "income")
    total_expenses = sum(e.amount for e in budget_entries if e.entry_type == "expense")
    net_savings = total_income - total_expenses
    savings_rate = (net_savings / total_income * 100) if total_income > 0 else 0.0

    expense_by_category = {}
    income_by_category = {}
    for e in budget_entries:
        target = expense_by_category if e.entry_type == "expense" else income_by_category
        target[e.category] = target.get(e.category, 0) + e.amount

    context["budget_summary"] = {
        "month": current_month,
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_savings": net_savings,
        "savings_rate": round(savings_rate, 1),
        "income_by_category": income_by_category,
        "expense_by_category": expense_by_category,
        "entry_count": len(budget_entries),
    }

    # Active debts
    debts = db.query(Debt).filter(Debt.status == "active").all()
    context["debts"] = [
        {
            "name": d.name,
            "creditor": d.creditor,
            "principal": d.principal,
            "interest_rate": d.interest_rate,
            "minimum_payment": d.minimum_payment,
            "current_balance": d.current_balance,
        }
        for d in debts
    ]

    # Savings jars
    jars = db.query(SavingsJar).all()
    context["savings"] = [
        {
            "name": j.name,
            "target_amount": j.target_amount,
            "current_amount": j.current_amount,
            "deadline": j.deadline.isoformat() if j.deadline else None,
        }
        for j in jars
    ]

    # Goals
    goals = db.query(Goal).filter(Goal.status == "active").all()
    context["goals"] = [
        {
            "name": g.name,
            "target_amount": g.target_amount,
            "current_amount": g.current_amount,
            "start_date": g.start_date.isoformat() if g.start_date else None,
            "end_date": g.end_date.isoformat() if g.end_date else None,
            "status": g.status,
        }
        for g in goals
    ]

    # Active bills
    bills = db.query(BillReminder).filter(BillReminder.is_active == "true").all()
    context["bills"] = [
        {
            "name": b.name,
            "amount": b.amount,
            "category": b.category,
            "frequency": b.frequency,
            "next_due_date": b.next_due_date.isoformat() if b.next_due_date else None,
        }
        for b in bills
    ]

    # Net worth calculation
    total_savings_amount = sum(j.current_amount for j in jars)
    total_goals_amount = sum(g.current_amount for g in goals if g.current_amount)
    total_assets = total_savings_amount + total_goals_amount
    total_liabilities = sum(d.current_balance for d in debts)

    context["net_worth"] = {
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "net_worth": total_assets - total_liabilities,
    }

    return context


def build_snapshot_data(db: Session) -> dict:
    """Build data for a financial snapshot."""
    ctx = build_financial_context(db)
    bs = ctx["budget_summary"]

    return {
        "total_income": bs["total_income"],
        "total_expenses": bs["total_expenses"],
        "net_savings": bs["net_savings"],
        "savings_rate": bs["savings_rate"],
        "total_debt": ctx["net_worth"]["total_liabilities"],
        "total_savings": ctx["net_worth"]["total_assets"],
        "net_worth": ctx["net_worth"]["net_worth"],
        "details": json.dumps(ctx),
    }
