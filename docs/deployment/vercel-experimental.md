# Deploy: Vercel multi-service (experimentalServices) + Neon

Run **both** the Next.js frontend AND the FastAPI backend on Vercel itself, using their `experimentalServices` multi-service mode. Same-origin from the browser's POV; no separate Render service to manage.

```mermaid
flowchart LR
    Browser([browser])

    subgraph Vercel["Vercel (experimentalServices)"]
        FE["frontend<br/>(Next.js)"]
        BE["backend<br/>(Python serverless)"]
    end

    Neon[("Neon Postgres<br/>pooler endpoint")]

    Browser --> FE
    Browser -- /api/* --> BE
    FE --> BE
    BE --> Neon
```

**Read [vercel-neon.md](./vercel-neon.md) first** if you don't have a specific reason to use experimentalServices. That recipe (Vercel + Render + Neon) is the path the entire codebase is designed against; this doc covers an alternative for operators who want everything on Vercel.

## Hard limitations of this path

`experimentalServices` runs the backend on Vercel's serverless Python runtime. Three Aegis features don't work on that platform:

```mermaid
flowchart TD
    Start{Feature}
    Start --> PDF["PDF export<br/>/api/reports/export.pdf"]
    Start --> Jobs["Background worker<br/>/api/jobs/*"]
    Start --> AI["AI calls > 10s"]
    Start --> Rest[Everything else]

    PDF -- WeasyPrint needs Cairo/Pango --> X1[("503 with JSON error")]
    Jobs -- No long-lived processes --> X2[("Falls back to inline")]
    AI -- 10s Hobby timeout --> X3{Tier?}
    X3 -- Hobby --> X3a[("504 timeout")]
    X3 -- Pro 60s --> OK1((Works))
    Rest --> OK2((Works on either tier))

    style X1 fill:#fee
    style X2 fill:#fee
    style X3a fill:#fee
    style OK1 fill:#efe
    style OK2 fill:#efe
```

| Feature | Why it breaks | What happens |
|---|---|---|
| **PDF export** (`/api/reports/export.pdf`) | WeasyPrint needs Cairo + Pango + GDK-Pixbuf shared libs not in Vercel's runtime | Endpoint returns 503 cleanly with a JSON error |
| **Background worker queue** (`/api/jobs/*` + arq) | Vercel has no long-lived processes | Endpoints still mounted; calling `?background=true` falls back to inline rendering |
| **AI calls > Hobby tier timeout** | Vercel Hobby: 10 s function timeout. Aegis AI clients wait up to 30 s. | `POST /api/ai/*` may 504 on Hobby. Pro tier (60 s) fits comfortably. |

Everything else works: dashboard, transactions, plans, budgets, savings, payments (Stripe), Google sign-in, CSV exports, NDJSON exports, AI on Pro tier, cookie auth, cache (in-memory), rate limiter (in-memory).

If any of the three above is essential, **use [vercel-neon.md](./vercel-neon.md) instead**. Render's $7 Starter runs the full backend including PDF + worker.

## Step 1 — Provision Postgres (Neon)

Same as [vercel-neon.md Step 1](./vercel-neon.md#step-1--provision-postgres-neon). Copy the connection string from Neon — **use the `-pooler.neon.tech` URL**, not the direct one. Vercel's serverless Python opens a new connection per function invocation; the pooler endpoint is what makes that scale.

## Step 2 — Set up the Vercel project

1. `vercel.com` → **Add New → Project** → import your fork
2. Vercel detects the `vercel.json` at repo root and shows the two services (frontend + backend) — that's the screen you're looking at right now
3. **Confirm** the service config:
   - `frontend` → route `/`
   - `backend` → route `/api`
4. **Environment Variables** — set these once at the project level; both services see them. Required minimum:

   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   JWT_SECRET_KEY=<openssl rand -hex 32>
   FRONTEND_URL=https://<your-app>.vercel.app
   CORS_ORIGINS=["https://<your-app>.vercel.app"]
   LOG_FORMAT=json
   DEBUG=false
   CACHE_BACKEND=memory
   AUTH_COOKIE_SAMESITE=lax
   ```

   Optional add-ons (set if you want them):

   ```
   ANTHROPIC_API_KEY=...                   # AI assistant (Pro tier recommended)
   STRIPE_SECRET_KEY=sk_test_...           # Stripe checkout
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   GOOGLE_OAUTH_CLIENT_ID=...              # Google sign-in (BACKEND side)
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=...        # Same value (FRONTEND side, build-time)
   ```

   Do **not** set `BACKEND_INTERNAL_URL`. Leaving it unset tells `next.config.ts` to skip the `/api/*` rewrite — Vercel's experimentalServices routing takes over.

5. Click **Deploy**. First build takes ~3-5 minutes (frontend + backend both build).

## Step 3 — First-time DB migration

Vercel's serverless runtime can't run a one-shot migration script during deploy (that's a Render/Docker convenience). Two options:

**Option A — local migration (recommended)**

```sh
# From your dev machine, point at the Neon DB:
export DATABASE_URL='postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require'
cd backend
alembic upgrade head
```

You run this once at first deploy, then again whenever a migration ships. Bookmark the command.

**Option B — Neon CLI**

```sh
neon connection-string --pooled --db neondb | xargs -I{} env DATABASE_URL={} alembic upgrade head
```

Same shape, no PSQL credentials in shell history.

## Step 4 — Smoke test

```sh
# Health endpoint
curl https://<your-app>.vercel.app/api/health
# {"status":"ok","version":"1.0.0","db":"ok",...}

# Frontend (HTML)
curl https://<your-app>.vercel.app
```

If `/api/health` returns 500 with `db_error`: `DATABASE_URL` is wrong, OR Neon hasn't woken up yet (free tier scale-to-zero). Wait 5 s and retry — Neon takes a moment on cold start.

Then open the app in a browser and run the [UAT acceptance checklist](./vercel-neon.md#uat-acceptance-checklist) from `vercel-neon.md`. Same 20 checks apply.

**Endpoints that will return 503 on this deploy (expected)**:
- `GET /api/reports/export.pdf` → "PDF export is disabled on this deployment"
- `GET /api/jobs/*` → "Job queue is not configured on this server"

These should NOT count as smoke-test failures — they're documented limitations.

## Step 5 — Tier choice

| Tier | When |
|---|---|
| **Hobby (free)** | Tests + private UAT. AI disabled or you're OK with timeouts. Function bundle size capped at 50 MB unzipped; Aegis backend fits since we excluded WeasyPrint + matplotlib + numpy. |
| **Pro ($20/user/mo)** | First real production traffic. 60s function timeout (AI calls fit), 250 MB function size, no cold-start surcharge. |

You can start on Hobby and upgrade once you need AI or hit the function-size cap.

## Step 6 — Custom domain

Same as [vercel-neon.md Step 5](./vercel-neon.md#step-5--custom-domain-optional) — Vercel dashboard → Domains → add. After it propagates, update both `FRONTEND_URL` and `CORS_ORIGINS` in the env panel and redeploy.

## What's different from `vercel-neon.md`

| Concern | vercel-neon.md (Vercel + Render) | This recipe (experimentalServices) |
|---|---|---|
| **Where backend runs** | Render container | Vercel serverless Python |
| **PDF export** | ✅ Works | ❌ Returns 503 |
| **Background worker** | ✅ Works | ❌ Returns 503 |
| **AI calls > 30 s** | ✅ Works | ❌ Times out on Hobby; works on Pro |
| **Cookie auth** | Works (same-origin via rewrite) | Works (same-origin natively) |
| **Cold start** | ~30 s on Render Free / instant on Starter | ~3-8 s Python cold start, every idle period |
| **Migration step** | Auto (entrypoint runs alembic) | Manual (local `alembic upgrade head`) |
| **Monthly cost** | $7 (Render) + Neon | $0 (Vercel Hobby) — or $20/user (Pro) |
| **Operational complexity** | 3 services (Vercel + Render + Neon) | 2 services (Vercel + Neon) |

## When to switch back

If you find any of these biting in production, switch to `vercel-neon.md`:
- Users complain about cold starts
- PDF export becomes user-facing essential
- AI usage scales past Hobby tier limits
- You need scheduled jobs / background processing

The codebase supports both topologies — switching back is just changing `BACKEND_INTERNAL_URL` in the env, removing `vercel.json`, and spinning up the Render service.

## Troubleshooting

**"Module 'app.main' not found" at deploy**
Vercel can't find the FastAPI app. `backend/main.py` should be present (re-exports `app` from `app/main.py`); if it's missing, the experimentalServices Python runtime falls back to looking for `index.py` or fails. Check `backend/main.py` exists.

**"Cannot find module 'asyncpg'" on `/api/export/*.ndjson`**
`backend/requirements.txt` is missing `asyncpg`. Check the file — it should be in the list under the `sqlalchemy` line.

**"413 Request Entity Too Large" on CSV import**
Vercel's serverless functions cap request body at 4.5 MB on Hobby (default), or 100 MB on Pro. Aegis caps at 5 MB. Either upgrade to Pro or bump down the Aegis cap in `backend/app/config.py` (`max_request_body_bytes`).

**Cookie shows `aegis_session` but `/api/auth/me` returns 401**
The cookie was set on `<vercel-url>.vercel.app` but you're now hitting a custom domain. `AUTH_COOKIE_SAMESITE` is `lax` — should work cross-subdomain. Inspect the cookie's `Domain` attribute in devtools; if it's pinned to `.vercel.app`, you need to log out + back in after switching to the custom domain.

**Build fails with "could not find weasyprint"**
You're using `backend/pyproject.toml` instead of `backend/requirements.txt`. Vercel should prefer `requirements.txt` automatically, but if it doesn't, add a `vercel.json` build override or temporarily rename `pyproject.toml` to `pyproject.toml.docker` for the Vercel deploy.
