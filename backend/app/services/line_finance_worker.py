"""Run as a supervised worker: python -m app.services.line_finance_worker.

Use the finance channel's own access token. Accepted replies are scrubbed.
Uncertain retries stop before LINE's 24-hour retry-key retention expires.
"""

import time
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy.exc import SQLAlchemyError

from ..config import get_settings
from ..database import SessionLocal
from ..models.line_finance import LineFinanceReply


def deliver_batch(db, token, client, limit=10):
    now = datetime.now(UTC).replace(tzinfo=None)
    rows = (
        db.query(LineFinanceReply)
        .filter(LineFinanceReply.state == "pending", LineFinanceReply.next_at <= now)
        .order_by(LineFinanceReply.created_at)
        .with_for_update(skip_locked=True)
        .limit(limit)
        .all()
    )
    for row in rows:
        if now - row.created_at >= timedelta(hours=23):
            row.state = "needs-review"
            continue
        try:
            response = client.post(
                "https://api.line.me/v2/bot/message/push",
                headers={
                    "Authorization": "Bearer " + token,
                    "X-Line-Retry-Key": row.id,
                },
                json={
                    "to": row.line_id,
                    "messages": [{"type": "text", "text": row.text}],
                },
            )
            if response.status_code == 200 or (
                response.status_code == 409
                and response.headers.get("x-line-accepted-request-id")
            ):
                row.state, row.text = "delivered", ""
            elif 400 <= response.status_code < 500 and response.status_code != 429:
                row.state = "needs-review"
            else:
                raise RuntimeError("retryable delivery failure")
        except (httpx.HTTPError, RuntimeError):
            row.attempts += 1
            row.next_at = now + timedelta(
                seconds=min(3600, 5 * 2 ** min(row.attempts, 10))
            )
    db.commit()


def main():
    token = get_settings().line_finance_access_token
    if not token:
        raise SystemExit(
            "Configure the finance channel access token before starting the worker"
        )
    with httpx.Client(timeout=15) as client:
        while True:
            try:
                with SessionLocal() as db:
                    deliver_batch(db, token, client)
            except (SQLAlchemyError, OSError):
                # Avoid financial payloads, destination IDs, or credentials in logs.
                print(
                    "Finance reply worker needs attention; pending records retained",
                    flush=True,
                )
            time.sleep(5)


if __name__ == "__main__":
    main()
