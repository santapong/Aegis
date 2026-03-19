"""
Aegis AI Advisor — Financial analysis and chat powered by Ollama (Qwen).

Uses a local Ollama instance to provide financial advice, spending analysis,
and interactive chat about the user's financial data.
"""

from __future__ import annotations

import os
import json
import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
AEGIS_AI_MODEL = os.getenv("AEGIS_AI_MODEL", "qwen2.5:7b")

SYSTEM_PROMPT = """You are Aegis AI Advisor, a personal financial advisor built into the Aegis Wealth OS.
You have access to the user's real financial data provided as context. Your role is to:

1. Analyze spending patterns and identify areas for improvement
2. Suggest actionable budget adjustments
3. Warn about overspending in specific categories
4. Recommend savings strategies based on their goals and current habits
5. Provide debt payoff advice (avalanche vs snowball, extra payments)
6. Track progress toward financial goals
7. Give clear, concise, and supportive advice

Always base your advice on the actual financial data provided. Be specific with numbers.
Use a friendly but professional tone. When suggesting changes, explain the expected impact.
Format your responses with clear sections and bullet points for readability.
If the user's data shows concerning patterns, flag them clearly but supportively."""


class AdvisorAgent:
    def __init__(self, base_url: str | None = None, model: str | None = None):
        self.base_url = base_url or OLLAMA_BASE_URL
        self.model = model or AEGIS_AI_MODEL
        self.client = httpx.Client(timeout=120.0)

    def analyze_finances(self, financial_data: dict) -> str:
        """Run a full financial analysis and return advice."""
        context = self._format_financial_context(financial_data)
        prompt = (
            f"Here is my current financial data:\n\n{context}\n\n"
            "Please provide a comprehensive financial analysis covering:\n"
            "1. Overall Financial Health Score (1-10)\n"
            "2. Spending Pattern Analysis\n"
            "3. Savings & Goals Progress\n"
            "4. Debt Management Assessment\n"
            "5. Top 3 Actionable Recommendations\n"
            "6. Potential Risks & Warnings"
        )
        return self._chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ]
        )

    def chat(self, messages: list[dict], financial_context: dict | None = None) -> str:
        """Send a conversational message with optional financial context."""
        system_content = SYSTEM_PROMPT
        if financial_context:
            context = self._format_financial_context(financial_context)
            system_content += f"\n\nCurrent financial data:\n{context}"

        full_messages = [{"role": "system", "content": system_content}] + messages
        return self._chat_completion(messages=full_messages)

    def _chat_completion(self, messages: list[dict]) -> str:
        """Call Ollama chat API."""
        response = self.client.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "messages": messages,
                "stream": False,
            },
        )
        response.raise_for_status()
        return response.json()["message"]["content"]

    def _format_financial_context(self, data: dict) -> str:
        """Format financial data dict into readable context string."""
        sections = []

        if "budget_summary" in data:
            bs = data["budget_summary"]
            sections.append(
                f"📊 Budget Summary (Current Month):\n"
                f"  Income: {bs.get('total_income', 0):,.2f}\n"
                f"  Expenses: {bs.get('total_expenses', 0):,.2f}\n"
                f"  Net Savings: {bs.get('net_savings', 0):,.2f}\n"
                f"  Savings Rate: {bs.get('savings_rate', 0):.1f}%"
            )
            if bs.get("expense_by_category"):
                cats = "\n".join(
                    f"    - {k}: {v:,.2f}" for k, v in bs["expense_by_category"].items()
                )
                sections.append(f"  Expense Breakdown:\n{cats}")

        if "debts" in data:
            debt_lines = []
            for d in data["debts"]:
                debt_lines.append(
                    f"    - {d['name']}: Balance {d['current_balance']:,.2f} "
                    f"@ {d.get('interest_rate', 0):.1f}% APR"
                )
            total_debt = sum(d["current_balance"] for d in data["debts"])
            sections.append(
                f"💳 Debts (Total: {total_debt:,.2f}):\n" + "\n".join(debt_lines)
            )

        if "savings" in data:
            jar_lines = []
            for s in data["savings"]:
                pct = (s["current_amount"] / s["target_amount"] * 100) if s["target_amount"] > 0 else 0
                jar_lines.append(
                    f"    - {s['name']}: {s['current_amount']:,.2f}/{s['target_amount']:,.2f} ({pct:.0f}%)"
                )
            total_saved = sum(s["current_amount"] for s in data["savings"])
            sections.append(
                f"🏦 Savings Jars (Total Saved: {total_saved:,.2f}):\n" + "\n".join(jar_lines)
            )

        if "goals" in data:
            goal_lines = []
            for g in data["goals"]:
                goal_lines.append(
                    f"    - {g['name']}: {g.get('current_amount', 0):,.2f}/{g.get('target_amount', 0):,.2f} "
                    f"(Status: {g.get('status', 'active')})"
                )
            sections.append(f"🎯 Goals:\n" + "\n".join(goal_lines))

        if "bills" in data:
            bill_lines = []
            for b in data["bills"]:
                bill_lines.append(f"    - {b['name']}: {b['amount']:,.2f} ({b.get('frequency', 'monthly')})")
            sections.append(f"📅 Recurring Bills:\n" + "\n".join(bill_lines))

        if "net_worth" in data:
            nw = data["net_worth"]
            sections.append(
                f"💰 Net Worth: {nw.get('net_worth', 0):,.2f}\n"
                f"  Assets: {nw.get('total_assets', 0):,.2f}\n"
                f"  Liabilities: {nw.get('total_liabilities', 0):,.2f}"
            )

        return "\n\n".join(sections) if sections else json.dumps(data, indent=2)

    def check_connection(self) -> bool:
        """Check if Ollama is reachable."""
        try:
            resp = self.client.get(f"{self.base_url}/api/tags")
            return resp.status_code == 200
        except Exception:
            return False

    def list_models(self) -> list[str]:
        """List available Ollama models."""
        try:
            resp = self.client.get(f"{self.base_url}/api/tags")
            resp.raise_for_status()
            return [m["name"] for m in resp.json().get("models", [])]
        except Exception:
            return []
