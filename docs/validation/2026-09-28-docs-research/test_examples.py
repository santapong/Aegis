"""Check published docs examples with disposable in-memory data, never a user DB.
Run from repo root: backend/.venv/bin/python -m pytest -q docs/validation/2026-09-28-docs-research/test_examples.py
"""
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
os.environ.update(DATABASE_URL="sqlite:///:memory:", DEBUG="true", ANTHROPIC_API_KEY="", JWT_SECRET_KEY="documentation-test-only-not-a-production-secret-00000000000000000")
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "backend/tests"))
from conftest import client, _register  # noqa: E402,F401


def test_documented_api_requests(client):
    assert client.get("/api/transactions/").status_code == 401
    headers, _ = _register(client, email="docs@example.com", username="docs")
    client.cookies.clear()  # Prove bearer authentication independently of the login cookie.
    assert client.get("/api/transactions/?limit=1&offset=0", headers=headers).json() == []
    record = {"amount": 18000, "type": "expense", "category": "Housing", "date": "2026-09-28", "description": "Rent"}
    response = client.post("/api/transactions/", headers=headers, json=record)
    assert response.status_code == 201
    saved = response.json()
    assert all(saved[key] == value for key, value in record.items())
    response = client.get("/api/transactions/?type=expense&category=Housing&start_date=2026-09-01&end_date=2026-09-30&limit=100&offset=0", headers=headers)
    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == [saved["id"]]
    assert client.get("/api/transactions/?limit=1&offset=1", headers=headers).json() == []
    assert client.post("/api/transactions/", headers=headers, json={**record, "amount": 0}).status_code == 422
    assert client.get("/api/transactions/?limit=501", headers=headers).status_code == 422
    assert client.post("/api/auth/login", json={"email": "docs@example.com", "password": "incorrect"}).status_code == 401


def test_downloadable_csv_import(client):
    headers, _ = _register(client, email="csv@example.com", username="csv")
    example = ROOT / "frontend/public/docs/example-transactions.csv"
    response = client.post("/api/transactions/import/preview", headers=headers, files={"file": (example.name, example.read_bytes(), "text/csv")})
    assert response.status_code == 200
    preview = response.json()
    assert preview["total_rows"] == preview["valid_rows"] == 2
    assert [(row["amount"], row["type"], row["category"]) for row in preview["rows"]] == [(18000, "expense", "Housing"), (65000, "income", "Salary")]
    response = client.post("/api/transactions/import/confirm", headers=headers, json={"rows": preview["rows"]})
    assert response.status_code == 200
    assert response.json() == {"imported": 2, "skipped": 0, "errors": []}
    assert len(client.get("/api/transactions/", headers=headers).json()) == 2
