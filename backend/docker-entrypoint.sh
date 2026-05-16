#!/usr/bin/env bash
set -e

# Wait for the configured DB to accept connections before running
# migrations. Postgres + MySQL/MariaDB are handled here; SQLite needs no
# wait (the file is local) and other dialects fall through with a
# warning so the deploy can still proceed and hit a more informative
# error from alembic if the URL is misconfigured.
python - <<'PY'
import os, sys, time
from urllib.parse import urlparse

url = os.environ.get("DATABASE_URL", "")
if not url:
    print("DATABASE_URL is empty — alembic will fail loudly", file=sys.stderr)
    sys.exit(0)

# SQLite: no wait. Just sanity-check the parent directory is writable.
if url.startswith("sqlite"):
    sys.exit(0)

is_postgres = url.startswith("postgres") or url.startswith("cockroachdb")
is_mysql = url.startswith(("mysql", "mariadb"))

if not (is_postgres or is_mysql):
    print(f"Unknown DB dialect in URL {url.split('://', 1)[0]}; skipping wait", file=sys.stderr)
    sys.exit(0)

parsed = urlparse(
    url.replace("+psycopg2", "").replace("+psycopg", "").replace("+pymysql", "")
)
host = parsed.hostname or "localhost"
port = parsed.port or (3306 if is_mysql else 5432)
user = parsed.username
password = parsed.password
dbname = (parsed.path or "/").lstrip("/").split("?", 1)[0]

if is_postgres:
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed; skipping DB wait", file=sys.stderr)
        sys.exit(0)

    def attempt() -> None:
        conn = psycopg2.connect(
            host=host, port=port, user=user, password=password,
            dbname=dbname, connect_timeout=2,
        )
        conn.close()
else:  # MySQL / MariaDB / TiDB
    try:
        import pymysql
    except ImportError:
        print("pymysql not installed; skipping DB wait", file=sys.stderr)
        sys.exit(0)

    def attempt() -> None:
        conn = pymysql.connect(
            host=host, port=port, user=user, password=password,
            database=dbname, connect_timeout=2,
        )
        conn.close()

for i in range(30):
    try:
        attempt()
        print(f"DB reachable at {host}:{port} (after {i}s)")
        sys.exit(0)
    except Exception as e:
        if i == 0:
            print(f"Waiting for DB at {host}:{port}: {e}")
        time.sleep(1)

print(f"DB never became reachable at {host}:{port}", file=sys.stderr)
sys.exit(1)
PY

# NOTE on concurrent rollouts: two pods that both run `alembic upgrade
# head` at the same instant can race and leave the schema half-migrated.
# Alembic locks its own version table once a migration starts, but the
# gap between "connect" and "first DDL" is exposed. Options:
#   1. Run migrations as a one-shot Kubernetes Job / init container
#      before the rollout (recommended).
#   2. Set deploy maxSurge=0 so old pods drain before new pods start.
# We don't try to grab a Postgres advisory lock here because subprocess
# session lifetime makes it pointless. See docs/deployment/ for the
# safer patterns.
echo "Running alembic upgrade head..."
alembic upgrade head

exec "$@"
