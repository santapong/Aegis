"""Reports resource for the Aegis SDK."""

from __future__ import annotations

from typing import Any

import httpx

from aegis_sdk.models import (
    CategoryBreakdown,
    MonthlyTrend,
    NetWorth,
    YearlySummary,
)


class ReportsResource:
    """Provides access to report endpoints (``/api/reports``)."""

    _path = "/api/reports"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def monthly_trend(self, *, months: int | None = None) -> list[MonthlyTrend]:
        """Get monthly income/expense trends.

        Args:
            months: Number of months to include in the trend.
        """
        params: dict[str, Any] = {}
        if months is not None:
            params["months"] = months
        resp = self._client.get(f"{self._path}/monthly-trend", params=params)
        resp.raise_for_status()
        return [MonthlyTrend.model_validate(item) for item in resp.json()]

    def category_breakdown(
        self, *, month: str | None = None
    ) -> list[CategoryBreakdown]:
        """Get spending breakdown by category.

        Args:
            month: Month to filter by (e.g. ``"2026-03"``).
        """
        params: dict[str, Any] = {}
        if month is not None:
            params["month"] = month
        resp = self._client.get(f"{self._path}/category-breakdown", params=params)
        resp.raise_for_status()
        return [CategoryBreakdown.model_validate(item) for item in resp.json()]

    def yearly_summary(self, *, year: int | None = None) -> YearlySummary:
        """Get a yearly financial summary.

        Args:
            year: Calendar year (defaults to current year on the server).
        """
        params: dict[str, Any] = {}
        if year is not None:
            params["year"] = year
        resp = self._client.get(f"{self._path}/yearly-summary", params=params)
        resp.raise_for_status()
        return YearlySummary.model_validate(resp.json())

    def net_worth(self) -> NetWorth:
        """Get the current net-worth calculation."""
        resp = self._client.get(f"{self._path}/net-worth")
        resp.raise_for_status()
        return NetWorth.model_validate(resp.json())
