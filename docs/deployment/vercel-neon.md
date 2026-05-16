# Deploy: Vercel + Neon + Render (recommended)

The fastest, cheapest path to a production Aegis. **~$7 / month** at small scale.

```
┌─────────────────┐         ┌──────────────────┐        ┌────────────┐
│  Vercel         │ /api/*  │  Render          │        │  Neon      │
│  (Next.js)      ├────────►│  (Aegis backend) ├───────►│  Postgres  │
│  free Hobby     │         │  $7 Starter      │        │  free tier │
└────────┬────────┘         └──────────────────┘        └────────────┘
         │
         ▼
       browser
```

Why this combo:

- **Vercel** native Next.js — auto TLS, edge CDN, zero config. Free Hobby tier covers small launches.
- **Neon** serverless Postgres — free 0.5 GB, auto-suspends when idle, great DX.
- **Render** runs the FastAPI container straight from the Dockerfile, with GitHub auto-deploy and managed env vars. Starter is $7/mo and stays warm.

This document also covers Neon alternatives (Supabase / Vercel Postgres / Railway Postgres / Aiven), and two alternatives to Render for the backend (Fly.io and Railway).

## Prerequisites

- A GitHub fork of `santapong/aegis` (or your own).
- A custom domain (optional — Vercel gives you a `.vercel.app` subdomain).
- An Anthropic API key if you want `/api/ai/*` to work. (Optional.)
- Stripe test keys if you want `/api/payments/*` to work. (Optional.)

## Step 1 — Provision Postgres (Neon)

1. Sign up at [neon.tech](https://neon.tech).
2. Create a project. Name it `aegis` (or whatever). Region: pick the one closest to where you'll run the backend.
3. Once the project is created, copy the connection string from the **Dashboard → Connection string** panel. It looks like `postgresql://user:pass@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`.
4. Keep it handy — you'll paste it into Render in Step 2.

**Sizing**: the free tier is 0.5 GB storage, 191 compute hours/month, auto-suspends after 5 min idle. For a real production launch, upgrade to the $19/mo Launch plan.

### Neon alternatives

The backend reads `DATABASE_URL` and doesn't care which Postgres provider gives it. Pick any:

| Provider | Free tier | Notable |
|----------|-----------|---------|
| [Neon](https://neon.tech) | 0.5 GB / 191 compute-hrs | **Recommended** — branching, scale-to-zero |
| [Supabase](https://supabase.com) | 500 MB, 2-project pause-after-inactivity | Bundles auth + storage you won't use |
| [Vercel Postgres](https://vercel.com/storage/postgres) | 256 MB / 60 hrs compute | Same dashboard as Vercel; uses Neon under the hood |
| [Railway Postgres](https://railway.app) | $5/mo (no free tier) | Easiest if you also host backend on Railway |
| [Aiven](https://aiven.io) | $0 for 1 mo trial | Multi-cloud, regional choice |
| AWS RDS | 750 hrs/mo (12 mo) | See [aws.md](./aws.md) |
| GCP Cloud SQL | no permanent free tier | See [gcp.md](./gcp.md) |

For each, the only thing that matters is the resulting `postgres://…` URL.

## Step 2 — Deploy the backend (Render)

1. Sign in to [render.com](https://render.com).
2. **New → Web Service → Build and deploy from a Git repository**. Connect your GitHub fork.
3. Settings:
   - **Name**: `aegis-backend`
   - **Region**: same as your Neon DB
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: Starter ($7/mo). The free tier sleeps after 15 min idle (~30 s cold start) — fine for staging, painful for prod.
4. **Environment** tab:
   - `DATABASE_URL` = the Neon connection string from Step 1
   - `JWT_SECRET_KEY` = `openssl rand -hex 32` output (paste the hex)
   - `CORS_ORIGINS` = `["https://your-app.vercel.app"]` (you can edit this after Step 3 once you know the Vercel URL)
   - `LOG_FORMAT` = `json`
   - `DEBUG` = `false`
   - Optional: `ANTHROPIC_API_KEY`, `STRIPE_*` (see [`backend/.env.example`](../../backend/.env.example))
5. **Health check path**: `/api/health`.
6. Click **Create Web Service**. First build takes ~5 minutes (Docker image build + push + boot + Alembic migrations).
7. Once live, note the public URL: e.g. `https://aegis-backend.onrender.com`. Test with:

   ```bash
   curl https://aegis-backend.onrender.com/api/health
   # {"ok":true,"db":true,"error":null}
   ```

### Backend alternatives

If Render's $7 Starter doesn't fit, two equivalents:

- **Fly.io** — `fly launch --dockerfile backend/Dockerfile`. Cheap at idle thanks to scale-to-zero machines. Postgres can also live on Fly if you want everything in one place.
- **Railway** — One-click GitHub import. Pricing is usage-based ($5 minimum). Tight integration with Railway Postgres if you don't use Neon.

Both expose the same `/api/health` URL pattern — recipe is identical from Step 3 onward.

## Step 3 — Deploy the frontend (Vercel)

1. Sign in to [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project** → import your GitHub fork.
3. Settings:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend` (click **Edit** and select)
   - **Build Command**, **Install Command**, **Output Directory**: leave defaults — `frontend/vercel.json` already sets these explicitly
4. **Environment Variables** (for **Production**, **Preview**, and **Development** scopes):
   - `BACKEND_INTERNAL_URL` = `https://aegis-backend.onrender.com` (the Render URL from Step 2). Apply this to all three scopes.
   - Leave `NEXT_PUBLIC_API_URL` unset — the browser will use relative `/api/*` URLs via the rewrite proxy.
5. Click **Deploy**. First build ~2 minutes.
6. Vercel gives you a URL like `https://aegis-yourname.vercel.app`. Copy it.
7. **Go back to Render** → backend service → Environment → update `CORS_ORIGINS` to `["https://aegis-yourname.vercel.app"]`. Save → Render restarts the service.

   (Strictly speaking, since the browser only ever hits Vercel's origin and Vercel's server-side rewrite forwards to the backend, no preflight CORS request reaches the backend. But the backend still enforces `CORS_ORIGINS` as a defense-in-depth check on any direct calls. Set it correctly so you can change browser-direct calls later without surprises.)

## Step 4 — Stripe webhook (optional)

If you're using Stripe:

1. In Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. **URL**: `https://aegis-backend.onrender.com/api/payments/webhook`
3. Select events: `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copy the **Signing secret** (`whsec_…`) into Render's `STRIPE_WEBHOOK_SECRET` env var.

## Step 5 — Custom domain (optional)

1. **Vercel → Project → Settings → Domains** → add your domain. Vercel will give you DNS records to set.
2. Once verified, **update `CORS_ORIGINS`** in Render again to include the custom domain — e.g. `["https://app.example.com","https://aegis-yourname.vercel.app"]`.

TLS is automatic on both Vercel and Render — no manual cert work.

## Step 6 — Smoke test

Open `https://aegis-yourname.vercel.app` (or your custom domain) and:

1. **Register** a new account → land on dashboard
2. Open every cluster in the sidebar (Overview / Money / Plan / System — 15 routes) → all render without 404 or console errors
3. **Settings → Appearance** → switch through Observatory → Constellation → Supernova → reload, theme persists
4. **Create a transaction**, see it appear in the ledger
5. **Reports → Export PDF** → file downloads, opens correctly (this is the WeasyPrint check — if it fails with a 500, your backend image is missing Cairo/Pango — see [troubleshooting](#troubleshooting))
6. **Log out → log in** → session works

## Step 7 — Auto-deploy on `git push`

Both Vercel and Render auto-deploy on every push to `main`. You get:

- Push → Render rebuilds backend image, runs `alembic upgrade head`, swaps in the new container with zero downtime (~3 min).
- Push → Vercel rebuilds the Next.js app, atomic swap (~90 s).
- Preview deploys for every PR on Vercel; Render preview environments require the Pro plan.

For rollbacks:

- **Vercel** — Deployments → click previous → **Promote to Production**. Instant.
- **Render** — Deploys → click previous successful build → **Rollback**. Takes a couple of minutes.

## Cost

| Item | Plan | Cost |
|------|------|------|
| Vercel | Hobby | $0 |
| Render | Web Service Starter (512 MB, 0.5 CPU) | $7 |
| Neon | Free | $0 |
| Stripe | Pay-per-transaction | 2.9% + $0.30 |
| Anthropic | Pay-per-token | usage-based |
| **Total fixed** | | **$7 / month** |

Move Neon to Launch ($19) and Render to Standard ($25) once you have real traffic.

## Troubleshooting

- **`/api/reports/export.pdf` returns 500 with `OSError: cannot load library 'libpangoft2-1.0.so.0'`** — your backend image was built before the Cairo/Pango fix landed. Pull `main` and redeploy on Render (it rebuilds from the Dockerfile).
- **Backend logs `JWT_SECRET_KEY too short`** — generate a fresh one: `openssl rand -hex 32` and update Render env. The app refuses to start with the placeholder in production (`DEBUG=false`).
- **Login works but every API call returns 401** — check that the Render service is healthy at `/api/health` and that `BACKEND_INTERNAL_URL` on Vercel points to the **public HTTPS** Render URL (not `localhost`).
- **Vercel build fails on `output: "standalone"`** — you're on an old branch. `next.config.ts` should gate `output` on `process.env.VERCEL`.
- **Render free tier cold-starts hurt** — upgrade to Starter ($7) which keeps the container warm.
- **AI streaming is buffered** — Vercel's rewrite proxy buffers responses up to 4 MB. For streaming AI replies, set `NEXT_PUBLIC_API_URL` on Vercel to the public Render URL so the browser hits the backend directly. You'll need to add the Vercel domain to `CORS_ORIGINS`.

## What's next

- Set up [`build-and-push.yml`](../../.github/workflows/build-and-push.yml) to push the same images to ECR / Artifact Registry too, in case you want to migrate clouds later.
- Read [aws.md](./aws.md) or [gcp.md](./gcp.md) when you outgrow Render.
- Read [self-hosted.md](./self-hosted.md) if you want to run on your own VPS.
