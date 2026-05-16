# Aegis Deployment Guide

Aegis is a two-service application:

- **Frontend** — Next.js 15 / React 19 / Tailwind v4. Single Docker image, also deployable on Vercel without a container.
- **Backend** — FastAPI / SQLAlchemy / Alembic / WeasyPrint. Containerized; expects a Postgres database.

Four recipes are documented, in recommended order:

| Recipe | Frontend | Backend | DB | Monthly cost |
|--------|----------|---------|----|--------------|
| [Vercel + Neon](./vercel-neon.md) **(primary)** | Vercel | Render / Fly.io / Railway | Neon | **~$7** |
| [AWS](./aws.md) | Vercel *(or)* Amplify *(or)* docker-compose | App Runner *(or)* ECS Fargate | RDS Postgres | ~$25–60 |
| [GCP](./gcp.md) | Vercel *(or)* Firebase Hosting *(or)* Cloud Run | Cloud Run | Cloud SQL | ~$0–25 |
| [Self-hosted](./self-hosted.md) | Same VPS | Same VPS | Same VPS | ~$5–20 |

Pick **Vercel + Neon** if you have no preference — it's the cheapest, fastest to ship, and the path that the rest of the documentation is written against. The other recipes assume you have a specific reason to be on AWS or GCP (existing infrastructure, compliance, cost-at-scale).

## Architecture (all recipes)

```
                browser
                   │
                   ▼
       ┌──────────────────────┐
       │  Frontend  (Next.js) │  serves the SPA, proxies /api/*
       └──────────┬───────────┘     server-side to the backend
                  │ /api/*
                  ▼
       ┌──────────────────────┐
       │  Backend  (FastAPI)  │  JWT auth, business logic, Stripe,
       └──────────┬───────────┘     Anthropic, WeasyPrint
                  │
                  ▼
       ┌──────────────────────┐
       │  Postgres            │
       └──────────────────────┘
```

The frontend never talks to the backend directly from the browser — every request goes through Next.js's `rewrites()` proxy (`frontend/next.config.ts`). This keeps auth same-origin (no CORS in the browser), lets you change backend URLs without rebuilding the frontend, and means you only need to set **one** env var (`BACKEND_INTERNAL_URL`) per environment.

## Common environment variables

These appear in every recipe; the deeper docs cover platform-specific details.

### Frontend

| Var | Required | Where to set | Notes |
|-----|----------|--------------|-------|
| `BACKEND_INTERNAL_URL` | **yes** | Vercel project env, ECS task def, Cloud Run env | Public HTTPS URL of the backend (e.g. `https://api.example.com`). In docker-compose it's `http://backend:8000`. |
| `NEXT_PUBLIC_API_URL` | no | Same | Set **only** if you intentionally want the browser to bypass the rewrite proxy and talk to the backend directly (e.g. AI streaming on Vercel). Empty / unset = use the proxy (recommended). |

### Backend

| Var | Required | Notes |
|-----|----------|-------|
| `DATABASE_URL` | **yes** | Postgres connection string. SQLite works for dev only. |
| `JWT_SECRET_KEY` | **yes** | ≥ 32 chars in prod. Generate with `openssl rand -hex 32`. |
| `CORS_ORIGINS` | **yes** | JSON array of frontend origins. Include preview deploy URLs. |
| `ANTHROPIC_API_KEY` | conditional | Required for `/api/ai/*`. |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | conditional | Required for `/api/payments/*`. |
| `LOG_FORMAT` | no | `json` in prod (CloudWatch/Cloud Logging friendly), `text` in dev. |
| `RATE_LIMIT_PER_MINUTE` | no | Default 100. |

Full list with defaults: [`backend/.env.example`](../../backend/.env.example).

## Google sign-in (optional)

Aegis supports Google ID-token sign-in alongside email/password. To enable it on any of the recipes:

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create credentials → OAuth client ID → Web application**.
3. **Authorized JavaScript origins**: every URL the frontend loads from. For a Vercel deploy this means `https://your-app.vercel.app`, your custom domain, *and* `http://localhost:3000` for local dev. Vercel preview-deploy URLs change per-PR, so add a wildcard pattern if you need them.
4. **Authorized redirect URIs**: leave blank — Aegis uses the ID-token flow (Google Identity Services), not the redirect flow. The button issues a credential client-side and POSTs it to `/api/auth/google`.
5. Copy the **Client ID** (looks like `XXXX.apps.googleusercontent.com`).
6. Set `GOOGLE_OAUTH_CLIENT_ID` on the backend and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on the frontend to the same value. Both are required.
7. Redeploy. The Google button appears on `/login` and `/register` automatically; if either env var is missing, the button hides gracefully and the email/password form remains usable.

Auto-link behavior: if a Google account's email matches an existing email/password user, the next Google sign-in attaches the Google `sub` claim to that user. The original password keeps working — there are now two ways to log in.

## Health check

The backend exposes `GET /api/health` returning `{ ok, db, error }`. Wire this into every load balancer / probe — ALB target group, App Runner health check, Cloud Run liveness probe, docker-compose healthcheck. The check verifies a real `SELECT 1` against the database so a healthy response means the app can actually serve traffic.

## Database migrations

The backend image runs `alembic upgrade head` on boot via `docker-entrypoint.sh`. **Don't run migrations as a separate step** — the entrypoint is idempotent and waits for the DB to be reachable before applying. Every recipe below relies on this behavior.

## Glossary

- **ECS Fargate** — AWS managed container service, serverful (charged per running task hour).
- **App Runner** — AWS managed container service, scales to zero.
- **Cloud Run** — GCP managed container service, scales to zero, generous free tier.
- **Vercel functions** — serverless runtime for Next.js API routes. Aegis doesn't use these; the FastAPI backend runs elsewhere.
- **Vercel rewrites** — runtime URL proxying, not a redirect. The browser sees `/api/...`; Vercel forwards server-side to the configured destination. Adds ~50–150 ms.
