"""Main client for the Aegis Money Management API."""

from __future__ import annotations

import httpx

from aegis_sdk.resources.ai import AIResource
from aegis_sdk.resources.bills import BillsResource
from aegis_sdk.resources.budget import BudgetResource
from aegis_sdk.resources.calendar import CalendarResource
from aegis_sdk.resources.debts import DebtsResource
from aegis_sdk.resources.goals import GoalsResource
from aegis_sdk.resources.history import HistoryResource
from aegis_sdk.resources.reports import ReportsResource
from aegis_sdk.resources.savings import SavingsResource


class AegisClient:
    """Synchronous client for the Aegis Money Management REST API.

    Usage::

        from aegis_sdk import AegisClient

        client = AegisClient("http://localhost:8000")
        entries = client.budget.list(month="2026-03")
        client.close()

    The client can also be used as a context manager::

        with AegisClient("http://localhost:8000") as client:
            summary = client.budget.summary()
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        *,
        timeout: float = 30.0,
        headers: dict[str, str] | None = None,
    ) -> None:
        """Initialise the Aegis client.

        Args:
            base_url: Base URL of the Aegis API server.
            timeout: Default request timeout in seconds.
            headers: Optional extra headers to send with every request.
        """
        self._client = httpx.Client(
            base_url=base_url,
            timeout=timeout,
            headers=headers or {},
        )

        # Resource namespaces
        self.budget = BudgetResource(self._client)
        self.goals = GoalsResource(self._client)
        self.debts = DebtsResource(self._client)
        self.savings = SavingsResource(self._client)
        self.bills = BillsResource(self._client)
        self.reports = ReportsResource(self._client)
        self.calendar = CalendarResource(self._client)
        self.ai = AIResource(self._client)
        self.history = HistoryResource(self._client)

    # -- Context manager ----------------------------------------------------

    def __enter__(self) -> AegisClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    # -- Lifecycle ----------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP connection pool."""
        self._client.close()
