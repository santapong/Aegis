"""Test-only HTTP bootstrap; cannot run against an ordinary/production database."""

# Reject an unsafe target before importing the application and its DB engine.
# ruff: noqa: E402

import os
from datetime import UTC, datetime, timedelta

from sqlalchemy.engine import make_url

url = make_url(os.environ.get("DATABASE_URL", ""))
if os.environ.get("AEGIS_ROBOT_FIXTURE") != "1" or url.database != "aegis_robot_test" or url.host not in {"127.0.0.1", "localhost"}:
    raise RuntimeError("Robot bootstrap requires its isolated loopback test database")

from fastapi import HTTPException, Request
from app.main import app
from app.config import get_settings
from app.database import engine
from app.middleware.rate_limit import RateLimitMiddleware
from app.services import finance_integration

settings = get_settings()
assert settings.finance_ledger_enabled and not settings.finance_integration_delivery_enabled
assert not settings.line_finance_access_token and not settings.finance_integration_ocr_key
RateLimitMiddleware._strict_limit = 10000  # Test setup throughput, not a rate-limit qualification.
offset = 0
# Queue defaults use current UTC. An offset preserves that live baseline;
# freezing only this imported function in the past makes new jobs ineligible.
finance_integration.utcnow = lambda: datetime.now(UTC).replace(tzinfo=None) + timedelta(seconds=offset)


@app.post("/__robot__/clock", include_in_schema=False)
async def clock(request: Request):
    global offset
    if request.headers.get("x-robot-control") != "fictional-robot-control" or request.client.host != "127.0.0.1":
        raise HTTPException(403, "Test controller only")
    body = await request.json()
    value = body.get("seconds")
    if type(value) is not int or not 0 <= value <= 8 * 86400:
        raise HTTPException(422, "Bounded test clock required")
    offset = value
    return {"offset_seconds": offset}


@app.get("/__robot__/metadata", include_in_schema=False)
def metadata():
    with engine.connect() as connection:
        database = connection.exec_driver_sql("SELECT current_database()").scalar_one()
    return {"test_fixture": True, "database": database, "dialect": engine.dialect.name}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=1, access_log=False, log_level="warning")
