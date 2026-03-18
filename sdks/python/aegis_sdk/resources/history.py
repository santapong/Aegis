"""History resource for the Aegis SDK."""

from __future__ import annotations

from typing import Any

import httpx

from aegis_sdk.models import Snapshot, TimelineEntry


class HistoryResource:
    """Provides access to history endpoints (``/api/history``)."""

    _path = "/api/history"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    # -- Snapshots ----------------------------------------------------------

    def list_snapshots(self) -> list[Snapshot]:
        """List all financial snapshots."""
        resp = self._client.get(f"{self._path}/snapshots")
        resp.raise_for_status()
        return [Snapshot.model_validate(item) for item in resp.json()]

    def create_snapshot(self) -> Snapshot:
        """Create a new financial snapshot of the current state."""
        resp = self._client.post(f"{self._path}/snapshots")
        resp.raise_for_status()
        return Snapshot.model_validate(resp.json())

    def get_snapshot(self, snapshot_id: int) -> Snapshot:
        """Retrieve a specific snapshot by ID.

        Args:
            snapshot_id: The snapshot ID.
        """
        resp = self._client.get(f"{self._path}/snapshots/{snapshot_id}")
        resp.raise_for_status()
        return Snapshot.model_validate(resp.json())

    # -- Timeline -----------------------------------------------------------

    def timeline(self, *, limit: int | None = None) -> list[TimelineEntry]:
        """Get a timeline of financial events.

        Args:
            limit: Maximum number of entries to return.
        """
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        resp = self._client.get(f"{self._path}/timeline", params=params)
        resp.raise_for_status()
        return [TimelineEntry.model_validate(item) for item in resp.json()]
