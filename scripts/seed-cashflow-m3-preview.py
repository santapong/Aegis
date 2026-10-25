"""Set up a fictional business review through the isolated local API only."""

import os
import uuid

import httpx

if os.environ.get("AEGIS_ALLOW_DISPOSABLE_CASH_SEED") != "yes":
    raise SystemExit("Explicit disposable-preview seed opt-in required")

with httpx.Client(base_url="http://127.0.0.1:8000", timeout=30) as client:
    response = client.post(
        "/api/auth/login",
        json={
            "email": "release-preview@aegis.local",
            "password": "aegis-preview-local-2026",
        },
    )
    assert response.status_code == 200, "Fictional preview owner must exist"
    client.headers["Authorization"] = "Bearer " + response.json()["access_token"]
    name = "Business M3 review · fictional"
    response = client.get("/api/cash/workspaces")
    assert response.status_code == 200
    if any(workspace["name"] == name for workspace in response.json()):
        raise SystemExit("Fixture already exists; preserve the existing review")
    response = client.post(
        "/api/cash/workspaces",
        json={
            "name": name,
            "kind": "business",
            "currency": "THB",
            "buffer": "100",
            "week_start": 0,
            "request_key": "m3-local-review-2026-10-02",
        },
    )
    assert response.status_code == 201
    workspace = response.json()
    revision = workspace["revision"]

    def post(path, values):
        global revision
        response = client.post(
            f"/api/cash/workspaces/{workspace['id']}/{path}",
            json={**values, "revision": revision, "request_key": str(uuid.uuid4())},
        )
        assert response.status_code == 201, response.text
        revision = response.json()["revision"]
        return response.json()

    account = post("accounts", {"name": "Operating cash · fictional"})["id"]
    post(
        "anchors",
        {
            "account_id": account,
            "amount": "5000",
            "date": "2026-10-01",
            "source": "Fictional checked opening; no bank connection",
        },
    )
    post(
        "commitments",
        {
            "account_id": account,
            "title": "Supplier cost · fictional",
            "direction": "expense",
            "amount": "6000",
            "start_date": "2026-10-05",
            "due_date": "2026-10-05",
        },
    )
    print(
        "Fictional business review ready: opening THB 5,000; supplier plan THB 6,000 on October 5."
    )
