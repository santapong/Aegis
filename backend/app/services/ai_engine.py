import json
from datetime import date, timedelta

import anthropic
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models.plan import Plan
from ..models.transaction import Transaction, TransactionType
from ..models.ai_recommendation import AIRecommendation, ActionType


# Tool definitions for structured output via Claude tool_use

ANALYZE_TOOL = {
    "name": "provide_recommendations",
    "description": "Provide structured financial recommendations based on the user's data",
    "input_schema": {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "recommendation": {
                            "type": "string",
                            "description": "Clear, actionable financial advice",
                        },
                        "confidence": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                            "description": "Confidence level from 0 to 1",
                        },
                        "category": {
                            "type": "string",
                            "description": "Spending category or 'general'",
                        },
                        "action_type": {
                            "type": "string",
                            "enum": ["reduce", "increase", "reallocate", "alert"],
                            "description": "Type of recommended action",
                        },
                    },
                    "required": ["recommendation", "confidence", "category", "action_type"],
                },
                "minItems": 3,
                "maxItems": 5,
                "description": "List of 3-5 financial recommendations",
            }
        },
        "required": ["recommendations"],
    },
}

FORECAST_TOOL = {
    "name": "provide_forecast",
    "description": "Provide a structured financial forecast based on historical data",
    "input_schema": {
        "type": "object",
        "properties": {
            "projected_balance": {
                "type": "number",
                "description": "Estimated balance after the forecast period",
            },
            "projected_income": {
                "type": "number",
                "description": "Estimated total income over the forecast period",
            },
            "projected_expenses": {
                "type": "number",
                "description": "Estimated total expenses over the forecast period",
            },
            "insights": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 3,
                "maxItems": 5,
                "description": "3-5 key insights about the financial forecast",
            },
        },
        "required": ["projected_balance", "projected_income", "projected_expenses", "insights"],
    },
}


def _extract_tool_input(response, tool_name: str) -> dict | None:
    """Extract structured input from a tool_use content block."""
    for block in response.content:
        if block.type == "tool_use" and block.name == tool_name:
            return block.input
    return None


class AIEngine:
    def __init__(self, db: Session, user_id: str | None = None):
        settings = get_settings()
        self.db = db
        self.user_id = user_id
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.ai_model

    def _gather_context(self, days: int = 90) -> dict:
        cutoff = date.today() - timedelta(days=days)

        plans_q = self.db.query(Plan)
        txns_q = self.db.query(Transaction).filter(Transaction.date >= cutoff)
        if self.user_id:
            plans_q = plans_q.filter(Plan.user_id == self.user_id)
            txns_q = txns_q.filter(Transaction.user_id == self.user_id)
        plans = plans_q.all()
        transactions = txns_q.all()

        total_income = sum(float(t.amount) for t in transactions if t.type == TransactionType.income)
        total_expenses = sum(float(t.amount) for t in transactions if t.type == TransactionType.expense)

        category_spending: dict[str, float] = {}
        for t in transactions:
            if t.type == TransactionType.expense:
                category_spending[t.category] = category_spending.get(t.category, 0) + float(t.amount)

        return {
            "period_days": days,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_savings": total_income - total_expenses,
            "savings_rate": round((total_income - total_expenses) / total_income * 100, 1) if total_income > 0 else 0,
            "spending_by_category": category_spending,
            "active_plans": [
                {"title": p.title, "amount": float(p.amount), "category": p.category.value, "status": p.status.value, "progress": p.progress}
                for p in plans
                if p.status.value in ("planned", "in_progress")
            ],
            "transaction_count": len(transactions),
        }

    def analyze(self, question: str | None = None, days: int = 90) -> list[dict]:
        context = self._gather_context(days)

        system_prompt = """You are a financial advisor AI. Analyze the user's financial data and provide actionable recommendations.
Be specific with numbers and percentages. Provide 3-5 recommendations."""

        user_message = f"""Here is my financial data for the last {days} days:

{json.dumps(context, indent=2)}

{"Question: " + question if question else "Please analyze my finances and give recommendations."}"""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                tools=[ANALYZE_TOOL],
                tool_choice={"type": "tool", "name": "provide_recommendations"},
            )

            result = _extract_tool_input(response, "provide_recommendations")
            recommendations = result["recommendations"] if result else []
        except anthropic.APIError:
            recommendations = [
                {"recommendation": "Unable to generate AI recommendations at this time.", "confidence": 0.5, "category": "general", "action_type": "alert"}
            ]

        if not recommendations:
            recommendations = [
                {"recommendation": "No recommendations could be generated.", "confidence": 0.5, "category": "general", "action_type": "alert"}
            ]

        # Store recommendations
        stored = []
        for rec in recommendations:
            action_type = rec.get("action_type", "alert")
            if action_type not in [e.value for e in ActionType]:
                action_type = "alert"

            db_rec = AIRecommendation(
                recommendation=rec["recommendation"],
                confidence=rec.get("confidence", 0.5),
                category=rec.get("category", "general"),
                action_type=ActionType(action_type),
                user_id=self.user_id,
            )
            self.db.add(db_rec)
            stored.append(db_rec)

        self.db.commit()
        for r in stored:
            self.db.refresh(r)

        return stored

    def forecast(self, months_ahead: int = 3) -> dict:
        context = self._gather_context(days=180)

        monthly_income = context["total_income"] / (context["period_days"] / 30) if context["period_days"] > 0 else 0
        monthly_expenses = context["total_expenses"] / (context["period_days"] / 30) if context["period_days"] > 0 else 0

        system_prompt = """You are a financial forecasting AI. Based on the user's financial history, provide a forecast."""

        user_message = f"""Financial data (last {context['period_days']} days):
{json.dumps(context, indent=2)}

Monthly averages: income={monthly_income:.2f}, expenses={monthly_expenses:.2f}
Please forecast my finances for the next {months_ahead} months."""

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
                tools=[FORECAST_TOOL],
                tool_choice={"type": "tool", "name": "provide_forecast"},
            )

            forecast = _extract_tool_input(response, "provide_forecast")
        except anthropic.APIError:
            forecast = None

        if not forecast:
            forecast = {
                "projected_balance": (monthly_income - monthly_expenses) * months_ahead,
                "projected_income": monthly_income * months_ahead,
                "projected_expenses": monthly_expenses * months_ahead,
                "insights": ["Unable to generate AI insights. Using simple projection."],
            }

        forecast["months_ahead"] = months_ahead
        return forecast
