"""Debts resource for the Aegis SDK."""

from __future__ import annotations

from typing import Any

import httpx

from aegis_sdk.models import (
    Debt,
    DebtCreate,
    DebtStrategy,
    DebtSummary,
    DebtUpdate,
    PayoffPlan,
)


class DebtsResource:
    """Provides access to debt endpoints (``/api/debts``)."""

    _path = "/api/debts"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    # -- CRUD ---------------------------------------------------------------

    def list(self) -> list[Debt]:
        """List all debts."""
        resp = self._client.get(self._path)
        resp.raise_for_status()
        return [Debt.model_validate(item) for item in resp.json()]

    def create(self, debt: DebtCreate) -> Debt:
        """Create a new debt."""
        resp = self._client.post(
            self._path,
            json=debt.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return Debt.model_validate(resp.json())

    def update(self, debt_id: int, debt: DebtUpdate) -> Debt:
        """Update an existing debt."""
        resp = self._client.put(
            f"{self._path}/{debt_id}",
            json=debt.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return Debt.model_validate(resp.json())

    def delete(self, debt_id: int) -> None:
        """Delete a debt."""
        resp = self._client.delete(f"{self._path}/{debt_id}")
        resp.raise_for_status()

    # -- Aggregations -------------------------------------------------------

    def summary(self) -> DebtSummary:
        """Get a summary of all debts."""
        resp = self._client.get(f"{self._path}/summary")
        resp.raise_for_status()
        return DebtSummary.model_validate(resp.json())

    def payoff_plan(
        self,
        *,
        strategy: DebtStrategy = DebtStrategy.SNOWBALL,
        extra_payment: float | None = None,
    ) -> PayoffPlan:
        """Generate a debt payoff plan.

        Args:
            strategy: Payoff strategy — ``snowball`` (smallest balance first)
                or ``avalanche`` (highest interest first).
            extra_payment: Optional additional monthly payment beyond minimums.
        """
        params: dict[str, Any] = {"strategy": strategy.value}
        if extra_payment is not None:
            params["extra_payment"] = extra_payment
        resp = self._client.get(f"{self._path}/payoff-plan", params=params)
        resp.raise_for_status()
        return PayoffPlan.model_validate(resp.json())
