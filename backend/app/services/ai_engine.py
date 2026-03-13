import json
from datetime import date, timedelta

import anthropic
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models.plan import Plan
from ..models.transaction import Transaction, TransactionType
from ..models.ai_recommendation import AIRecommendation, ActionType


class AIEngine:
    def __init__(self, db: Session):
        settings = get_settings()
        self.db = db
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.ai_model

    def _gather_context(self, days: int = 90) -> dict:
        cutoff = date.today() - timedelta(days=days)

        plans = self.db.query(Plan).all()
        transactions = self.db.query(Transaction).filter(Transaction.date >= cutoff).all()

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
Always respond with a JSON array of recommendations, each with:
- "recommendation": string (clear actionable advice)
- "confidence": float 0-1 (how confident you are)
- "category": string (spending category or "general")
- "action_type": one of "reduce", "increase", "reallocate", "alert"

Provide 3-5 recommendations. Be specific with numbers and percentages."""

        user_message = f"""Here is my financial data for the last {days} days:

{json.dumps(context, indent=2)}

{"Question: " + question if question else "Please analyze my finances and give recommendations."}"""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        try:
            text = response.content[0].text
            # Extract JSON from response
            start = text.find("[")
            end = text.rfind("]") + 1
            if start >= 0 and end > start:
                recommendations = json.loads(text[start:end])
            else:
                recommendations = [{"recommendation": text, "confidence": 0.5, "category": "general", "action_type": "alert"}]
        except (json.JSONDecodeError, IndexError):
            recommendations = [{"recommendation": response.content[0].text, "confidence": 0.5, "category": "general", "action_type": "alert"}]

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

        system_prompt = """You are a financial forecasting AI. Based on the user's financial history, provide a forecast.
Respond with a JSON object:
- "projected_balance": float (estimated balance after the forecast period)
- "projected_income": float (estimated total income)
- "projected_expenses": float (estimated total expenses)
- "insights": list of strings (3-5 key insights about the forecast)"""

        user_message = f"""Financial data (last {context['period_days']} days):
{json.dumps(context, indent=2)}

Monthly averages: income={monthly_income:.2f}, expenses={monthly_expenses:.2f}
Please forecast my finances for the next {months_ahead} months."""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        try:
            text = response.content[0].text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                forecast = json.loads(text[start:end])
            else:
                forecast = {
                    "projected_balance": (monthly_income - monthly_expenses) * months_ahead,
                    "projected_income": monthly_income * months_ahead,
                    "projected_expenses": monthly_expenses * months_ahead,
                    "insights": [text],
                }
        except (json.JSONDecodeError, IndexError):
            forecast = {
                "projected_balance": (monthly_income - monthly_expenses) * months_ahead,
                "projected_income": monthly_income * months_ahead,
                "projected_expenses": monthly_expenses * months_ahead,
                "insights": ["Unable to generate AI insights. Using simple projection."],
            }

        forecast["months_ahead"] = months_ahead
        return forecast
