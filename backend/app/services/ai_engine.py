import json
from datetime import date, timedelta
from functools import lru_cache
from typing import TypedDict

import anthropic
from fastapi import HTTPException
from loguru import logger
from openai import OpenAI
from sqlalchemy import case, func as sa_func
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models.plan import Plan, PlanStatus
from ..models.transaction import Transaction, TransactionType
from ..models.ai_recommendation import AIRecommendation, ActionType
from ..models.ai_usage import AIUsage
from ..models.user_preferences import UserPreferences


# SDK clients hold an httpx connection pool; constructing one per request
# costs a TLS handshake on every AI call. Cache per credential set so the
# pool is reused across requests (and across AIEngine instances).
@lru_cache(maxsize=4)
def _cached_anthropic_client(api_key: str, timeout: float) -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=api_key, timeout=timeout)


@lru_cache(maxsize=4)
def _cached_openai_client(api_key: str, base_url: str, timeout: float) -> OpenAI:
    return OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)


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


def configured_provider_and_model() -> tuple[str, str]:
    """(provider, env-default model) for the current configuration.

    Read by the settings surface so it can show what a deploy falls back to
    when no model override is stored.
    """
    settings = get_settings()
    provider = settings.ai_provider
    default_model = {
        "anthropic": settings.ai_model,
        "typhoon": settings.typhoon_model,
        "groq": settings.groq_model,
    }.get(provider, "")
    return provider, default_model


class ProviderModel(TypedDict):
    """One entry from a provider's model list, normalised across providers.

    `supports_tools` is tri-state on purpose: True/False when the provider
    tells us, None when it doesn't. Only an explicit False is filtered out —
    absence of metadata must not silently hide usable models.

    `prompt_price` / `completion_price` are USD per *token* (not per million)
    when the provider publishes them, else None.
    """

    id: str
    supports_tools: bool | None
    is_text_to_text: bool | None
    prompt_price: float | None
    completion_price: float | None


def _to_float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalise_openai_model(m) -> ProviderModel:
    """Map an OpenAI-compatible model object to our shape.

    Groq returns considerably more than the OpenAI spec requires —
    `supported_features` and a per-token `pricing` block. Typhoon may return
    neither. Everything here is therefore optional-with-fallback rather than
    assumed present.
    """
    raw = m.model_dump() if hasattr(m, "model_dump") else dict(m)

    features = raw.get("supported_features")
    supports_tools = "tools" in features if isinstance(features, list) else None

    # Modality is a *separate* signal from features, and both are needed.
    # Groq's speech models (whisper: audio->transcription, orpheus:
    # text->speech) publish no `supported_features` at all, so a
    # features-only filter lets them through; conversely groq/compound is
    # text->text but lists no `tools`, so a modality-only filter lets *it*
    # through. Verified against the live catalog.
    ins, outs = raw.get("input_modalities"), raw.get("output_modalities")
    if isinstance(ins, list) and isinstance(outs, list):
        is_text_to_text = "text" in ins and "text" in outs
    else:
        is_text_to_text = None

    pricing = raw.get("pricing")
    prompt_price = completion_price = None
    if isinstance(pricing, dict):
        prompt_price = _to_float(pricing.get("prompt"))
        completion_price = _to_float(pricing.get("completion"))

    return ProviderModel(
        id=raw.get("id", ""),
        supports_tools=supports_tools,
        is_text_to_text=is_text_to_text,
        prompt_price=prompt_price,
        completion_price=completion_price,
    )


def list_provider_models() -> list[ProviderModel]:
    """Models the configured provider currently offers, with capability and
    pricing metadata where the provider publishes it.

    All three providers expose a model-list endpoint — Anthropic natively,
    Typhoon and Groq through the OpenAI-compatible route already wired above.
    Fetching rather than hard-coding is the point: a retired model disappears
    from the picker instead of 404-ing at request time, which is the failure
    mode that put a dated snapshot in `config.py` in the first place.

    Raises on transport/auth failure. The caller decides how to degrade —
    see `GET /api/ai/models`.
    """
    settings = get_settings()
    provider = settings.ai_provider
    timeout_s = 10.0  # a dropdown must not hang the settings page

    if provider == "anthropic":
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        client = _cached_anthropic_client(settings.anthropic_api_key, timeout_s)
        # Every Claude model on the Messages API supports tool use, and the
        # models endpoint publishes no pricing.
        return [
            ProviderModel(
                id=m.id,
                supports_tools=True,
                prompt_price=None,
                completion_price=None,
            )
            for m in client.models.list(limit=100).data
        ]

    if provider == "typhoon":
        key, base = settings.typhoon_api_key, settings.typhoon_base_url
        env_var = "TYPHOON_API_KEY"
    elif provider == "groq":
        key, base = settings.groq_api_key, settings.groq_base_url
        env_var = "GROQ_API_KEY"
    else:
        raise RuntimeError(f"Unknown AI_PROVIDER {provider!r}")

    if not key:
        raise RuntimeError(f"{env_var} is not set")
    client = _cached_openai_client(key, base, timeout_s)
    return [_normalise_openai_model(m) for m in client.models.list().data]


def usable_models(models: list[ProviderModel]) -> list[ProviderModel]:
    """Drop models that cannot serve /api/ai/*.

    Two independent disqualifiers, because neither alone is sufficient
    (verified against Groq's live catalog):

    * **Not text-to-text.** `whisper-*` is audio->transcription and
      `orpheus-*` is text->speech. Neither publishes `supported_features`, so
      a features-only filter would let both through.
    * **No tool support.** `groq/compound` and `allam-2-7b` are text-to-text
      but list only `json_mode`. Aegis pins `tool_choice` to a single tool, so
      these fail silently into the placeholder recommendation.

    Each check is tri-state and only an explicit False disqualifies: a
    provider that publishes no metadata at all (Typhoon) keeps its whole
    catalog. Hiding a usable model is the worse failure.
    """
    return [
        m
        for m in models
        if m["supports_tools"] is not False and m["is_text_to_text"] is not False
    ]


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

        # 30 s is plenty for a single completion under normal load; the
        # SDK default (10 min) lets a hung upstream pin a uvicorn worker
        # for the whole request lifetime.
        ai_timeout_s = 30.0

        if self.provider == "anthropic":
            if not settings.anthropic_api_key:
                self._raise_unconfigured("ANTHROPIC_API_KEY")
            self._anthropic = _cached_anthropic_client(
                settings.anthropic_api_key, ai_timeout_s
            )
            self._openai = None
            self.model = settings.ai_model
        elif self.provider == "typhoon":
            if not settings.typhoon_api_key:
                self._raise_unconfigured("TYPHOON_API_KEY")
            self._anthropic = None
            self._openai = _cached_openai_client(
                settings.typhoon_api_key, settings.typhoon_base_url, ai_timeout_s
            )
            self.model = settings.typhoon_model
        elif self.provider == "groq":
            if not settings.groq_api_key:
                self._raise_unconfigured("GROQ_API_KEY")
            self._anthropic = None
            self._openai = _cached_openai_client(
                settings.groq_api_key, settings.groq_base_url, ai_timeout_s
            )
            self.model = settings.groq_model
        else:
            raise HTTPException(
                status_code=500,
                detail={"error": "ai_provider_invalid", "message": f"Unknown AI_PROVIDER {self.provider!r}."},
            )

        # A stored preference overrides the env default. Resolved here, after
        # the per-provider branch has set the env-derived fallback, so an
        # unset preference leaves `self.model` exactly as it was before the
        # picker existed.
        #
        # Note this reads the DB on every AIEngine construction — one indexed
        # lookup on a one-row-per-user table, against an AI call that takes
        # seconds. Caching it would need invalidation on every preferences
        # PUT for no measurable gain.
        override = self._stored_model_override()
        if override:
            self.model = override

    def _stored_model_override(self) -> str | None:
        """The user's chosen model, or None to follow the env default.

        Never raises: a preferences lookup failure must not take down the AI
        feature, so a broken read degrades to the env default rather than a
        500. Same contract as `_call_tool`'s exception handling.
        """
        if not self.user_id:
            return None
        try:
            model = (
                self.db.query(UserPreferences.ai_model)
                .filter(UserPreferences.user_id == self.user_id)
                .scalar()
            )
        except Exception as e:  # pragma: no cover - defensive
            logger.warning("preferences lookup failed, using env model: {}", e)
            return None
        return model or None

    @staticmethod
    def _raise_unconfigured(env_var: str) -> None:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "ai_not_configured",
                "message": f"{env_var} is not set. Add it to .env to enable AI routes.",
            },
        )

    def _record_usage(self, operation: str, input_tokens: int, output_tokens: int) -> None:
        """Persist one AIUsage row. Never raises.

        Metering exists to observe the AI feature, so it must not be able to
        break it: a failed write is logged and dropped. A missing row is a far
        better outcome than a 500 on a call the provider already answered (and
        already billed).

        Rolls back on failure so a poisoned session can't take the caller's
        own commit down with it — `analyze()` commits recommendations on the
        same Session immediately after this runs.
        """
        try:
            self.db.add(
                AIUsage(
                    user_id=self.user_id,
                    provider=self.provider,
                    model=self.model,
                    operation=operation,
                    input_tokens=int(input_tokens or 0),
                    output_tokens=int(output_tokens or 0),
                )
            )
            self.db.commit()
        except Exception as e:
            logger.warning("ai usage metering failed: {}", e)
            try:
                self.db.rollback()
            except Exception:  # pragma: no cover - defensive
                pass

    def _call_tool(
        self,
        system_prompt: str,
        user_message: str,
        tool: dict,
        operation: str = "unknown",
    ) -> dict | None:
        """Force a single tool call and return its parsed input dict, or None on failure.

        Also meters the call. `operation` names the entry point so usage can be
        attributed; it is metadata only and never reaches the provider.
        """
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
                usage = getattr(response, "usage", None)
                self._record_usage(
                    operation,
                    getattr(usage, "input_tokens", 0),
                    getattr(usage, "output_tokens", 0),
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
            usage = getattr(response, "usage", None)
            self._record_usage(
                operation,
                getattr(usage, "prompt_tokens", 0),
                getattr(usage, "completion_tokens", 0),
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

        txn_filters = [Transaction.date >= cutoff]
        plans_q = self.db.query(Plan).filter(
            Plan.status.in_([PlanStatus.planned, PlanStatus.in_progress])
        )
        if self.user_id:
            txn_filters.append(Transaction.user_id == self.user_id)
            plans_q = plans_q.filter(Plan.user_id == self.user_id)

        total_income, total_expenses, txn_count = self.db.query(
            sa_func.coalesce(
                sa_func.sum(
                    case((Transaction.type == TransactionType.income, Transaction.amount), else_=0)
                ),
                0,
            ),
            sa_func.coalesce(
                sa_func.sum(
                    case((Transaction.type == TransactionType.expense, Transaction.amount), else_=0)
                ),
                0,
            ),
            sa_func.count(Transaction.id),
        ).filter(*txn_filters).one()
        total_income = float(total_income)
        total_expenses = float(total_expenses)

        category_spending = {
            category: float(total)
            for category, total in self.db.query(
                Transaction.category, sa_func.sum(Transaction.amount)
            )
            .filter(*txn_filters, Transaction.type == TransactionType.expense)
            .group_by(Transaction.category)
            .all()
        }

        return {
            "period_days": days,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_savings": total_income - total_expenses,
            "savings_rate": round((total_income - total_expenses) / total_income * 100, 1) if total_income > 0 else 0,
            "spending_by_category": category_spending,
            "active_plans": [
                {"title": p.title, "amount": float(p.amount), "category": p.category.value, "status": p.status.value, "progress": p.progress}
                for p in plans_q.all()
            ],
            "transaction_count": int(txn_count),
        }

    def analyze(self, question: str | None = None, days: int = 90) -> list[dict]:
        context = self._gather_context(days)

        system_prompt = """You are a financial advisor AI. Analyze the user's financial data and provide actionable recommendations.
Be specific with numbers and percentages. Provide 3-5 recommendations."""

        user_message = f"""Here is my financial data for the last {days} days:

{json.dumps(context, indent=2)}

{"Question: " + question if question else "Please analyze my finances and give recommendations."}"""

        result = self._call_tool(
            system_prompt, user_message, ANALYZE_TOOL, operation="analyze"
        )
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

        forecast = self._call_tool(
            system_prompt, user_message, FORECAST_TOOL, operation="forecast"
        )
        if not forecast:
            forecast = {
                "projected_balance": (monthly_income - monthly_expenses) * months_ahead,
                "projected_income": monthly_income * months_ahead,
                "projected_expenses": monthly_expenses * months_ahead,
                "insights": ["Unable to generate AI insights. Using simple projection."],
            }

        forecast["months_ahead"] = months_ahead
        return forecast
