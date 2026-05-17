# 6 · Deploying Aegis to production

A deploy-day runbook for taking Aegis from a working local stack to an environment you'd let real users into. This is opinionated — it picks specific defaults rather than enumerating every option. For per-platform details (Vercel + Neon, AWS, GCP, self-hosted Docker) see [`../deployment/`](../deployment/).

## 0 · Prerequisites checklist

Before you push the deploy button, verify:

- [ ] You have a domain (or a `.vercel.app` / `.fly.dev` subdomain is acceptable for early users).
- [ ] You have a managed Postgres provisioned (Neon free tier or RDS / Cloud SQL). **SQLite is fine for one user on one machine; it is not fine for a production deploy.**
- [ ] You have a long-lived secret manager — at minimum, a place to keep `JWT_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` that isn't a `.env` file in git.
- [ ] You ran `make setup` (or equivalent) at least once locally so you know what the dev experience looks like.

## 1 · Generate production secrets

```sh
# JWT signing key. 32+ bytes hex.
openssl rand -hex 32

# Stripe webhook secret comes from the Stripe dashboard, not from openssl.
```

Aegis refuses to boot when `JWT_SECRET_KEY` is the placeholder OR shorter than 32 chars (see `backend/app/config.py:_validate_production_secrets`). It also refuses when `DEBUG=true` paired with a placeholder secret on anything not localhost.

## 2 · Provision the database

Create a fresh Postgres database. Apply migrations:

```sh
DATABASE_URL=postgresql://user:pass@host:5432/aegis alembic upgrade head
```

The container entrypoint (`backend/docker-entrypoint.sh`) waits for the DB to be reachable and runs `alembic upgrade head` automatically before starting Uvicorn — so on most deploys you don't have to do this manually, you just have to be sure the DB URL is right when the container boots.

**Connection pool sizing.** Aegis defaults to `pool_size=10, max_overflow=20` per worker. With Uvicorn's default `--workers 2`, that's 60 connections per backend instance. Check your DB's `max_connections`; Neon free tier is 100, so one backend instance fits. Two instances will need a connection pooler (PgBouncer on transaction mode).

## 3 · Required environment variables

The minimum production env:

```sh
# Application
DEBUG=false                                  # rejects placeholder JWT secret + opens hardened mode
LOG_FORMAT=json                              # structured logs for ingest tools

# Database — REQUIRED. SQLite default will silently boot, then break.
DATABASE_URL=postgresql://user:pass@host/db

# Auth — REQUIRED. App refuses to boot with the placeholder or < 32 chars.
JWT_SECRET_KEY=<32-byte hex>

# Public URLs — REQUIRED. Used to build Stripe redirects and CORS allowlist.
FRONTEND_URL=https://app.example.com
CORS_ORIGINS=["https://app.example.com"]
```

Optional but recommended:

```sh
# Google sign-in. Leave blank to hide the button.
GOOGLE_OAUTH_CLIENT_ID=<from Google Cloud Console>

# AI. Leave blank to disable the AI panel.
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=<from console.anthropic.com>

# Stripe — leave blank to disable /api/payments/*.
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MODE=live
```

The frontend separately needs:

```sh
# Match the backend's GOOGLE_OAUTH_CLIENT_ID exactly.
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same value>

# Only set this if the browser will hit the backend directly. When unset,
# the frontend uses relative /api/* URLs — recommended (no CORS, no
# auth-cookie cross-domain concerns).
# NEXT_PUBLIC_API_URL=
```

## 4 · First-boot health checks

After your deploy goes live, hit these in order:

```sh
# Health endpoint — must return 200 with db: "ok".
curl https://api.example.com/api/health

# Should look like:
# {"status":"ok","version":"1.0.0","db":"ok",
#  "features":{"ai":"configured","ai_provider":"anthropic","stripe":"configured"},
#  "stripe_mode":"live"}
```

If `db: "error"`: the DB URL is wrong, the DB isn't reachable, or migrations haven't run. The endpoint includes a truncated error message in `db_error`.

If `ai: "not_configured"` and you set `ANTHROPIC_API_KEY`: it's empty in the env actually injected at runtime (check your platform's secret-rendering settings).

```sh
# Register a test user.
curl -X POST https://api.example.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com","username":"smoke","password":"test-only-for-smoke"}'

# Should return 201 with the user object. Delete this user when done.
```

## 5 · Day-1 monitoring

The bare minimum:

- **Uptime check** on `/api/health` every 60 s. Page on three consecutive failures. UptimeRobot's free tier or your platform's built-in equivalent.
- **Log retention** — at least 14 days. Aegis logs at INFO by default; in production `LOG_FORMAT=json` produces lines you can pipe into Datadog / Logtail / Cloud Logging.
- **Error tracking** — Sentry isn't wired in yet; until it is, set log alerting on level=`ERROR` to catch 500s.
- **DB metrics** — connection count, query duration, replication lag if you have a replica. Most managed Postgres providers give you this for free.

What's missing (track yourself for now):

- No per-user request metrics.
- No business metrics (signup count, MAU).
- No alerting on slow queries; `statement_timeout=15s` will kill them, but you won't know about it unless you tail logs.

## 6 · Backups

Aegis has no built-in backup. Your managed Postgres provider almost certainly does — turn it on:

- **Neon** — auto-snapshots every day, 7-day retention on free tier.
- **RDS** — enable automated backups, set retention to 14 days.
- **Cloud SQL** — same; enable point-in-time recovery.

Test the restore at least once. A backup you've never restored is a wish.

User-uploaded files (CSV imports, generated PDF reports): currently held only in transient memory and immediately discarded. The DB row is the source of truth. So a DB backup is sufficient — there are no separate file artifacts to back up. **Don't** treat that as forever-true; if a future version persists uploads to S3, this plan changes.

## 7 · Scaling targets (the rough math)

These are conservative estimates for current-version Aegis on a single small backend instance (1 vCPU, 1 GB RAM):

| Concurrent users | Latency p50 | Latency p99 | Bottleneck |
|---|---|---|---|
| 10 | 80 ms | 250 ms | none |
| 100 | 110 ms | 600 ms | DB connection pool |
| 500 | 200 ms | 2 s | uvicorn workers + AI rate limits |
| 1 000+ | needs horizontal scaling | — | rate-limiter is in-memory; add Redis |

When you cross ~100 simultaneous users, the immediate priorities are:

1. **Externalize the rate limiter to Redis** — currently it's per-worker in-memory.
2. **Connection pooler in front of Postgres** — PgBouncer in transaction mode lets you run 4+ backend replicas without exhausting Neon connections.
3. **CDN in front of the frontend** — Next.js static output cache + Vercel's edge handles this automatically; if self-hosting, put CloudFront / Cloudflare in front.

## 8 · The "I just deployed and something is broken" decision tree

| Symptom | Most likely cause |
|---|---|
| 500 on every endpoint | DATABASE_URL wrong, or DB unreachable, or migrations not applied |
| 403 on login | `JWT_SECRET_KEY` differs between the instance that minted the token and the one validating it |
| CORS errors in browser | `CORS_ORIGINS` doesn't include the exact protocol + host + port the browser sees |
| Stripe checkout redirects to `localhost:3000` | `FRONTEND_URL` not set on the backend |
| Google sign-in button missing | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` not set at build time on the frontend (must be present *during* the Next.js build, not just at runtime) |
| AI panel says "503 Service Unavailable" | `ANTHROPIC_API_KEY` (or equivalent) is empty in runtime env |
| Health endpoint returns `db_error: "SSL connection has been closed"` | Neon scale-to-zero idled the DB; first request after idle takes ~3 s to wake it. Subsequent requests are fast. Not a bug. |

## 9 · Known limitations

These are documented gaps you should plan around — none of them are deal-breakers for a first-100-users deploy, but you should know they exist:

- **No email verification** on register. Anyone can claim any email address.
- **No password reset flow.** Lost-password users need a manual DB intervention right now.
- **JWT logout is client-side only.** A stolen token is valid for its full 24-hour lifetime; rotating `JWT_SECRET_KEY` is the only kill-switch (it invalidates every active session).
- **Rate limiter is per-process and in-memory.** With 2 Uvicorn workers, users get 2× the documented limit; behind multiple replicas, much more.
- **No background scheduler.** Budget rollover happens lazily on first read each month. Subscription-renewal reminders fire when the page that uses them is opened, not when the renewal is imminent.

The deploy audit at `docs/deployment/` calls these out in more detail; each is on the post-launch fix list.
