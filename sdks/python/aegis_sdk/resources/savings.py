"""Savings resource for the Aegis SDK."""

from __future__ import annotations

import httpx

from aegis_sdk.models import (
    SavingsAccount,
    SavingsAccountCreate,
    SavingsAccountUpdate,
    SavingsSummary,
)


class SavingsResource:
    """Provides access to savings endpoints (``/api/savings``)."""

    _path = "/api/savings"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    # -- CRUD ---------------------------------------------------------------

    def list(self) -> list[SavingsAccount]:
        """List all savings accounts."""
        resp = self._client.get(self._path)
        resp.raise_for_status()
        return [SavingsAccount.model_validate(item) for item in resp.json()]

    def create(self, account: SavingsAccountCreate) -> SavingsAccount:
        """Create a new savings account."""
        resp = self._client.post(
            self._path,
            json=account.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return SavingsAccount.model_validate(resp.json())

    def update(self, account_id: int, account: SavingsAccountUpdate) -> SavingsAccount:
        """Update an existing savings account."""
        resp = self._client.put(
            f"{self._path}/{account_id}",
            json=account.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return SavingsAccount.model_validate(resp.json())

    def delete(self, account_id: int) -> None:
        """Delete a savings account."""
        resp = self._client.delete(f"{self._path}/{account_id}")
        resp.raise_for_status()

    # -- Transactions -------------------------------------------------------

    def deposit(self, account_id: int, amount: float) -> SavingsAccount:
        """Deposit funds into a savings account."""
        resp = self._client.post(
            f"{self._path}/{account_id}/deposit",
            json={"amount": amount},
        )
        resp.raise_for_status()
        return SavingsAccount.model_validate(resp.json())

    def withdraw(self, account_id: int, amount: float) -> SavingsAccount:
        """Withdraw funds from a savings account."""
        resp = self._client.post(
            f"{self._path}/{account_id}/withdraw",
            json={"amount": amount},
        )
        resp.raise_for_status()
        return SavingsAccount.model_validate(resp.json())

    # -- Aggregations -------------------------------------------------------

    def summary(self) -> SavingsSummary:
        """Get a summary of all savings accounts."""
        resp = self._client.get(f"{self._path}/summary")
        resp.raise_for_status()
        return SavingsSummary.model_validate(resp.json())
