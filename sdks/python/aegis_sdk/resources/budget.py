"""Budget resource for the Aegis SDK."""

from __future__ import annotations

from typing import Any

import httpx

from aegis_sdk.models import (
    BudgetEntry,
    BudgetEntryCreate,
    BudgetEntryUpdate,
    BudgetSummary,
)


class BudgetResource:
    """Provides access to budget endpoints (``/api/budget``)."""

    _path = "/api/budget"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    # -- CRUD ---------------------------------------------------------------

    def list(
        self,
        *,
        month: str | None = None,
        entry_type: str | None = None,
        category: str | None = None,
    ) -> list[BudgetEntry]:
        """List budget entries with optional filters."""
        params: dict[str, Any] = {}
        if month is not None:
            params["month"] = month
        if entry_type is not None:
            params["entry_type"] = entry_type
        if category is not None:
            params["category"] = category

        resp = self._client.get(self._path, params=params)
        resp.raise_for_status()
        return [BudgetEntry.model_validate(item) for item in resp.json()]

    def create(self, entry: BudgetEntryCreate) -> BudgetEntry:
        """Create a new budget entry."""
        resp = self._client.post(
            self._path,
            json=entry.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return BudgetEntry.model_validate(resp.json())

    def update(self, entry_id: int, entry: BudgetEntryUpdate) -> BudgetEntry:
        """Update an existing budget entry."""
        resp = self._client.put(
            f"{self._path}/{entry_id}",
            json=entry.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return BudgetEntry.model_validate(resp.json())

    def delete(self, entry_id: int) -> None:
        """Delete a budget entry."""
        resp = self._client.delete(f"{self._path}/{entry_id}")
        resp.raise_for_status()

    # -- Aggregations -------------------------------------------------------

    def summary(self, *, month: str | None = None) -> BudgetSummary:
        """Get a budget summary, optionally filtered by month."""
        params: dict[str, Any] = {}
        if month is not None:
            params["month"] = month
        resp = self._client.get(f"{self._path}/summary", params=params)
        resp.raise_for_status()
        return BudgetSummary.model_validate(resp.json())

    def categories(self) -> list[str]:
        """List available budget categories."""
        resp = self._client.get(f"{self._path}/categories")
        resp.raise_for_status()
        return resp.json()
