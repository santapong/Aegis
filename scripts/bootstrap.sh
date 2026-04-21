#!/usr/bin/env bash
set -euo pipefail

# Aegis bootstrap — generates a production-grade .env for local use.
# Idempotent: if .env already exists, it is left alone.

cd "$(dirname "$0")/.."

if [ -f .env ]; then
    echo ".env already exists — leaving as-is."
    echo "Delete it first if you want a fresh one."
    exit 0
fi

if [ ! -f .env.example ]; then
    echo "error: .env.example not found in $(pwd)" >&2
    exit 1
fi

if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 32)"
elif command -v python3 >/dev/null 2>&1; then
    SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
elif command -v python >/dev/null 2>&1; then
    SECRET="$(python -c 'import secrets; print(secrets.token_hex(32))')"
else
    echo "error: need openssl or python to generate a secret" >&2
    exit 1
fi

cp .env.example .env

# Replace the placeholder JWT secret and the default SQLite URL with Docker defaults.
# Use a | delimiter so the secret's hex chars don't collide with sed syntax.
python3 - "$SECRET" <<'PY'
import sys, pathlib, re
secret = sys.argv[1]
p = pathlib.Path(".env")
text = p.read_text()
text = re.sub(r"^JWT_SECRET_KEY=.*$", f"JWT_SECRET_KEY={secret}", text, flags=re.MULTILINE)
text = re.sub(
    r"^DATABASE_URL=sqlite:///\./money_management\.db$",
    "DATABASE_URL=postgresql://postgres:postgres@db:5432/money_management",
    text,
    flags=re.MULTILINE,
)
p.write_text(text)
PY

chmod 600 .env

cat <<EOF
.env created (mode 600) with a freshly generated JWT_SECRET_KEY.
DATABASE_URL is set for Docker (host "db"). If you are running natively
without Docker, edit .env and switch to the localhost/SQLite example.

Optional keys you may want to fill in:
  ANTHROPIC_API_KEY   — unlocks /api/ai/* (analyze, recommend, forecast)
  STRIPE_SECRET_KEY   — unlocks /api/payments/*
Without them, those routes return 503 and the rest of the app works.

Next steps:
  make up        # prod-mode docker compose (detached)
  make up-prod   # prod + Caddy on https://localhost
  make dev       # hot-reload docker compose
EOF
