"""Bills resource for the Aegis SDK."""

from __future__ import annotations

import httpx

from aegis_sdk.models import Bill, BillCreate, BillSummary, BillUpdate


class BillsResource:
    """Provides access to bill endpoints (``/api/bills``)."""

    _path = "/api/bills"

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    # -- CRUD ---------------------------------------------------------------

    def list(self) -> list[Bill]:
        """List all bills."""
        resp = self._client.get(self._path)
        resp.raise_for_status()
        return [Bill.model_validate(item) for item in resp.json()]

    def create(self, bill: BillCreate) -> Bill:
        """Create a new bill."""
        resp = self._client.post(
            self._path,
            json=bill.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return Bill.model_validate(resp.json())

    def update(self, bill_id: int, bill: BillUpdate) -> Bill:
        """Update an existing bill."""
        resp = self._client.put(
            f"{self._path}/{bill_id}",
            json=bill.model_dump(mode="json", exclude_none=True),
        )
        resp.raise_for_status()
        return Bill.model_validate(resp.json())

    def delete(self, bill_id: int) -> None:
        """Delete a bill."""
        resp = self._client.delete(f"{self._path}/{bill_id}")
        resp.raise_for_status()

    # -- Actions ------------------------------------------------------------

    def pay(self, bill_id: int) -> Bill:
        """Mark a bill as paid."""
        resp = self._client.post(f"{self._path}/{bill_id}/pay")
        resp.raise_for_status()
        return Bill.model_validate(resp.json())

    # -- Queries ------------------------------------------------------------

    def upcoming(self) -> list[Bill]:
        """List upcoming bills."""
        resp = self._client.get(f"{self._path}/upcoming")
        resp.raise_for_status()
        return [Bill.model_validate(item) for item in resp.json()]

    def summary(self) -> BillSummary:
        """Get a summary of bills."""
        resp = self._client.get(f"{self._path}/summary")
        resp.raise_for_status()
        return BillSummary.model_validate(resp.json())
