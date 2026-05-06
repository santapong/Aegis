import json
from datetime import date, timedelta

import anthropic
from fastapi import HTTPException
from loguru import logger
from openai import OpenAI
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models.plan import Plan
from ..models.transaction import Transaction, TransactionType
from ..models.ai_recommendation import AIRecommendation, ActionType


# Tool definitions — JSON Schema is identical across Anthropic and OpenAI.
# Each provider wraps the schema differently, but `_call_tool` handles that.

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


def _extract_anthropic_tool_input(response, tool_name: str) -> dict | None:
    for block in response.content:
        if block.type == "tool_use" and block.name == tool_name:
            return block.input
    return None


class AIEngine:
    """Provider-agnostic AI engine.

    Selects between `anthropic`, `typhoon`, and `groq` via settings.ai_provider.
    Typhoon and Groq both use the OpenAI-compatible chat-completions API; only
    the base_url, api key, and default model differ.
    """

    def __init__(self, db: Session, user_id: str | None = None):
        settings = get_settings()
        self.db = db
        self.user_id = user_id
        self.provider = settings.ai_provider

        if self.provider == "anthropic":
            if not settings.anthropic_api_key:
                self._raise_unconfigured("ANTHROPIC_API_KEY")
            self._anthropic = anthropic.Anthropic(api_key=settings.anthropic_api_key)
            self._openai = None
            self.model = settings.ai_model
        elif self.provider == "typhoon":
            if not settings.typhoon_api_key:
                self._raise_unconfigured("TYPHOON_API_KEY")
            self._anthropic = None
            self._openai = OpenAI(api_key=settings.typhoon_api_key, base_url=settings.typhoon_base_url)
            self.model = settings.typhoon_model
        elif self.provider == "groq":
            if not settings.groq_api_key:
                self._raise_unconfigured("GROQ_API_KEY")
            self._anthropic = None
            self._openai = OpenAI(api_key=settings.groq_api_key, base_url=settings.groq_base_url)
            self.model = settings.groq_model
        else:
            raise HTTPException(
                status_code=500,
                detail={"error": "ai_provider_invalid", "message": f"Unknown AI_PROVIDER {self.provider!r}."},
            )

    @staticmethod
    def _raise_unconfigured(env_var: str) -> None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "ai_not_configured",
                "message": f"{env_var} is not set. Add it to .env to enable AI routes.",
            },
        )

    def _call_tool(self, system_prompt: str, user_message: str, tool: dict) -> dict | None:
        """Force a single tool call and return its parsed input dict, or None on failure."""
        if self.provider == "anthropic":
            try:
                response = self._anthropic.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_message}],
                    tools=[tool],
                    tool_choice={"type": "tool", "name": tool["name"]},
                )
                return _extract_anthropic_tool_input(response, tool["name"])
            except Exception as e:
                logger.warning("anthropic tool call failed: {}", e)
                return None

        # OpenAI-compatible (typhoon, groq) — function calling
        openai_tool = {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": tool["input_schema"],
            },
        }
        try:
            response = self._openai.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                tools=[openai_tool],
                tool_choice={"type": "function", "function": {"name": tool["name"]}},
            )
            choice = response.choices[0]
            tool_calls = getattr(choice.message, "tool_calls", None) or []
            for tc in tool_calls:
                if tc.function.name == tool["name"]:
                    return json.loads(tc.function.arguments)
            return None
        except Exception as e:
            logger.warning("{} tool call failed: {}", self.provider, e)
            return None

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

        result = self._call_tool(system_prompt, user_message, ANALYZE_TOOL)
        recommendations = (result or {}).get("recommendations") or [
            {"recommendation": "Unable to generate AI recommendations at this time.", "confidence": 0.5, "category": "general", "action_type": "alert"}
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

        forecast = self._call_tool(system_prompt, user_message, FORECAST_TOOL)
        if not forecast:
            forecast = {
                "projected_balance": (monthly_income - monthly_expenses) * months_ahead,
                "projected_income": monthly_income * months_ahead,
                "projected_expenses": monthly_expenses * months_ahead,
                "insights": ["Unable to generate AI insights. Using simple projection."],
            }

        forecast["months_ahead"] = months_ahead
        return forecast
