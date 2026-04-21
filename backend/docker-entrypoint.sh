#!/usr/bin/env bash
set -e

# Wait for Postgres to accept connections before running migrations.
# SQLite / MySQL URLs fall through — no wait needed.
python - <<'PY'
import os, sys, time
from urllib.parse import urlparse

url = os.environ.get("DATABASE_URL", "")
if not url.startswith("postgres"):
    sys.exit(0)

try:
    import psycopg2
except ImportError:
    print("psycopg2 not installed; skipping DB wait", file=sys.stderr)
    sys.exit(0)

parsed = urlparse(url.replace("+psycopg2", "").replace("+psycopg", ""))
host = parsed.hostname or "localhost"
port = parsed.port or 5432
user = parsed.username
password = parsed.password
dbname = (parsed.path or "/").lstrip("/")

for attempt in range(30):
    try:
        conn = psycopg2.connect(
            host=host, port=port, user=user, password=password,
            dbname=dbname, connect_timeout=2,
        )
        conn.close()
        print(f"DB reachable at {host}:{port} (after {attempt}s)")
        sys.exit(0)
    except Exception as e:
        if attempt == 0:
            print(f"Waiting for DB at {host}:{port}: {e}")
        time.sleep(1)

print(f"DB never became reachable at {host}:{port}", file=sys.stderr)
sys.exit(1)
PY

echo "Running alembic upgrade head..."
alembic upgrade head

exec "$@"
