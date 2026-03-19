"""Goals and milestones resources for the Aegis SDK."""

from __future__ import annotations

from typing import Any

import httpx

from aegis_sdk.models import (
    Goal,
    GoalCreate,
    GoalUpdate,
    Milestone,
    MilestoneCreate,
    MilestoneUpdate,
)


class GoalsResource:
    """Provides access to goal endpoints (``/api/goals``)."""

    _path = "/api/goals"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client
        self.milestones = MilestonesResource(client)

    # -- CRUD ---------------------------------------------------------------

    def list(self) -> list[Goal]:
        """List all goals."""
        resp = self._client.get(self._path)
        resp.raise_for_status()
        return [Goal.model_validate(item) for item in resp.json()]

    def get(self, goal_id: int) -> Goal:
        """Get a single goal by ID."""
        resp = self._client.get(f"{self._path}/{goal_id}")
        resp.raise_for_status()
        return Goal.model_validate(resp.json())

    def create(self, goal: GoalCreate) -> Goal:
        """Create a new goal."""
        resp = self._client.post(
            self._path,
            json=goal.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return Goal.model_validate(resp.json())

    def update(self, goal_id: int, goal: GoalUpdate) -> Goal:
        """Update an existing goal."""
        resp = self._client.put(
            f"{self._path}/{goal_id}",
            json=goal.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return Goal.model_validate(resp.json())

    def delete(self, goal_id: int) -> None:
        """Delete a goal."""
        resp = self._client.delete(f"{self._path}/{goal_id}")
        resp.raise_for_status()


class MilestonesResource:
    """Provides access to milestone endpoints (``/api/milestones``)."""

    _path = "/api/milestones"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def list(self, *, goal_id: int | None = None) -> list[Milestone]:
        """List milestones, optionally filtered by goal."""
        params: dict[str, Any] = {}
        if goal_id is not None:
            params["goal_id"] = goal_id
        resp = self._client.get(self._path, params=params)
        resp.raise_for_status()
        return [Milestone.model_validate(item) for item in resp.json()]

    def create(self, milestone: MilestoneCreate) -> Milestone:
        """Create a new milestone."""
        resp = self._client.post(
            self._path,
            json=milestone.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return Milestone.model_validate(resp.json())

    def update(self, milestone_id: int, milestone: MilestoneUpdate) -> Milestone:
        """Update an existing milestone."""
        resp = self._client.put(
            f"{self._path}/{milestone_id}",
            json=milestone.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return Milestone.model_validate(resp.json())

    def delete(self, milestone_id: int) -> None:
        """Delete a milestone."""
        resp = self._client.delete(f"{self._path}/{milestone_id}")
        resp.raise_for_status()
