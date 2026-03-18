"""Calendar resource for the Aegis SDK."""

from __future__ import annotations

from typing import Any

import httpx

from aegis_sdk.models import CalendarEvent


class CalendarResource:
    """Provides access to calendar endpoints (``/api/calendar``)."""

    _path = "/api/calendar"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def list(
        self,
        *,
        month: str | None = None,
        year: int | None = None,
    ) -> list[CalendarEvent]:
        """List calendar events with optional filters.

        Args:
            month: Month filter (e.g. ``"2026-03"``).
            year: Year filter.
        """
        params: dict[str, Any] = {}
        if month is not None:
            params["month"] = month
        if year is not None:
            params["year"] = year
        resp = self._client.get(self._path, params=params)
        resp.raise_for_status()
        return [CalendarEvent.model_validate(item) for item in resp.json()]
