# Deploy: GCP

Run Aegis on Google Cloud. **Cloud Run** for the backend (scale-to-zero, generous free tier), **Cloud SQL Postgres** for the database, and the frontend on either Vercel (recommended) or Cloud Run / Firebase Hosting.

```
   ┌───────────┐         ┌─────────────────┐       ┌────────────────┐
   │  Frontend │ /api/*  │  Backend        │       │  Cloud SQL     │
   │  (Vercel/ ├────────►│  Cloud Run      ├──────►│  Postgres      │
   │  Firebase)│         │  scale-to-zero  │       │  db-f1-micro   │
   └───────────┘         └────────┬────────┘       └────────────────┘
                                  │
                                  ▼
                            Cloud Logging
                            Secret Manager
```

> **Read [vercel-neon.md](./vercel-neon.md) first** if you don't have a specific reason to be on GCP — Cloud Run's free tier makes the GCP recipe genuinely cheap, but the setup is one or two notches more involved.

## Prerequisites

- GCP project with billing enabled (Cloud Run, Cloud SQL, Artifact Registry, and Secret Manager all need it).
- `gcloud` CLI installed and authenticated (`gcloud auth login`, `gcloud config set project YOUR_PROJECT`).
- A custom domain (optional — Cloud Run gives you a `.run.app` URL).

Enable the APIs:

```bash
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
```

## Step 1 — Set up Artifact Registry

```bash
gcloud artifacts repositories create aegis \
  --repository-format=docker \
  --location=$GCP_REGION \
  --description="Aegis container images"

gcloud auth configure-docker $GCP_REGION-docker.pkg.dev
```

Push images:

```bash
make push-gar REGION=$GCP_REGION PROJECT=$GCP_PROJECT REPO=aegis TAG=v1.0.0
```

Or wire `.github/workflows/build-and-push.yml` by setting these in **Repo Settings → Secrets and variables**:

- **Variables**: `GAR_LOCATION` = `us-central1` (or your region), `GAR_PROJECT` = `my-project`, `GAR_REPOSITORY` = `aegis`
- **Secret**: `GCP_DEPLOY_SA_KEY` = JSON key for a service account with `roles/artifactregistry.writer` (or use OIDC)

## Step 2 — Provision the database (Cloud SQL)

```bash
gcloud sql instances create aegis-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=$GCP_REGION \
  --storage-size=10 \
  --backup-start-time=03:00 \
  --no-assign-ip   # private IP only
```

(`db-f1-micro` is the smallest shared-CPU tier — ~$10/month. There's no perpetual free tier for Cloud SQL.)

Create the database and user:

```bash
gcloud sql databases create aegis --instance=aegis-db
gcloud sql users create aegis --instance=aegis-db --password="$(openssl rand -hex 16)"
```

Get the **connection name** (you'll need it for Cloud Run): `gcloud sql instances describe aegis-db --format='value(connectionName)'`. Looks like `my-project:us-central1:aegis-db`.

Stash secrets in Secret Manager:

```bash
echo -n "postgresql://aegis:PASSWORD@/aegis?host=/cloudsql/PROJECT:REGION:aegis-db" | \
  gcloud secrets create aegis-database-url --data-file=-

openssl rand -hex 32 | gcloud secrets create aegis-jwt-secret-key --data-file=-

# repeat for ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET as needed
```

Note: the `?host=/cloudsql/PROJECT:REGION:aegis-db` syntax tells the backend to use the unix-socket connection that Cloud Run provides when you mount the SQL instance (next step). No Cloud SQL Auth Proxy sidecar needed.

## Step 3 — Deploy the backend (Cloud Run)

```bash
gcloud run deploy aegis-backend \
  --image=$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/aegis/aegis-backend:v1.0.0 \
  --region=$GCP_REGION \
  --platform=managed \
  --port=8000 \
  --cpu=1 --memory=512Mi \
  --min-instances=0 --max-instances=4 \
  --allow-unauthenticated \
  --add-cloudsql-instances=$GCP_PROJECT:$GCP_REGION:aegis-db \
  --set-env-vars="LOG_FORMAT=json,DEBUG=false,CORS_ORIGINS=[\"https://app.example.com\"]" \
  --set-secrets="DATABASE_URL=aegis-database-url:latest,JWT_SECRET_KEY=aegis-jwt-secret-key:latest,ANTHROPIC_API_KEY=aegis-anthropic-api-key:latest"
```

Grant the Cloud Run service account access to the secrets:

```bash
SA=$(gcloud run services describe aegis-backend --region=$GCP_REGION --format='value(spec.template.spec.serviceAccountName)')
for SECRET in aegis-database-url aegis-jwt-secret-key aegis-anthropic-api-key; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

And grant Cloud SQL access:

```bash
gcloud projects add-iam-policy-binding $GCP_PROJECT \
  --member="serviceAccount:$SA" \
  --role="roles/cloudsql.client"
```

Health check is auto-detected by Cloud Run via the container's HTTP startup probe; for stricter checks, set:

```bash
gcloud run services update aegis-backend \
  --region=$GCP_REGION \
  --update-startup-probe="httpGet.path=/api/health,initialDelaySeconds=5,periodSeconds=5,failureThreshold=10"
```

Smoke test:

```bash
URL=$(gcloud run services describe aegis-backend --region=$GCP_REGION --format='value(status.url)')
curl $URL/api/health
# {"ok":true,"db":true,"error":null}
```

## Step 4 — Frontend (pick one)

### Option 1 — Vercel (recommended)

Same as [Vercel + Neon recipe](./vercel-neon.md#step-3--deploy-the-frontend-vercel) but with `BACKEND_INTERNAL_URL` set to the Cloud Run URL (or your custom backend domain). Update `CORS_ORIGINS` on Cloud Run after the fact.

### Option 2 — Firebase Hosting + Cloud Functions

Firebase Hosting can host a Next.js app via the [Firebase frameworks integration](https://firebase.google.com/docs/hosting/frameworks/nextjs).

```bash
cd frontend
firebase init hosting   # pick "Use an existing project" and "Configure as a web framework"
firebase deploy --only hosting
```

Firebase auto-detects Next.js, deploys the static parts to its CDN and the SSR parts to Cloud Functions. Set `BACKEND_INTERNAL_URL` in `.env.production` before deploying — Firebase reads it.

Cost: free tier 10 GB storage + 360 MB/day transfer, then $0.026/GB.

### Option 3 — Cloud Run for the frontend

The frontend `Dockerfile` runs `node server.js` on port 3000. Deploy exactly like the backend:

```bash
gcloud run deploy aegis-frontend \
  --image=$GCP_REGION-docker.pkg.dev/$GCP_PROJECT/aegis/aegis-frontend:v1.0.0 \
  --region=$GCP_REGION \
  --port=3000 \
  --cpu=1 --memory=512Mi \
  --min-instances=0 --max-instances=4 \
  --allow-unauthenticated \
  --set-env-vars="BACKEND_INTERNAL_URL=https://aegis-backend-xxx-uc.a.run.app"
```

Useful if you want a single-cloud bill (everything on GCP).

## Step 5 — Custom domain + TLS

```bash
gcloud run domain-mappings create --service=aegis-backend \
  --domain=api.example.com --region=$GCP_REGION
gcloud run domain-mappings create --service=aegis-frontend \
  --domain=app.example.com --region=$GCP_REGION
```

Cloud Run will give you a CNAME record to add at your DNS provider. TLS is auto-provisioned.

For Vercel frontend + Cloud Run backend, use Vercel for the frontend domain and Cloud Run for `api.example.com`.

## Step 6 — Stripe webhook (optional)

In Stripe Dashboard → Webhooks, point the endpoint at `https://api.example.com/api/payments/webhook` (or the Cloud Run URL). Copy the signing secret into the `aegis-stripe-webhook-secret` Secret Manager entry; the next Cloud Run deploy picks it up.

## Step 7 — CI/CD

`.github/workflows/build-and-push.yml` already pushes to Artifact Registry when the GAR variables/secret are set (Step 1). To auto-deploy after a successful push, add this step after the build:

```yaml
- name: Deploy to Cloud Run
  if: ${{ vars.GAR_PROJECT != '' && secrets.GCP_DEPLOY_SA_KEY != '' }}
  run: |
    gcloud run deploy aegis-backend \
      --image=${{ vars.GAR_LOCATION }}-docker.pkg.dev/${{ vars.GAR_PROJECT }}/${{ vars.GAR_REPOSITORY }}/aegis-backend:sha-${{ github.sha }} \
      --region=${{ vars.GAR_LOCATION }}
```

(Same for frontend if you deploy it on Cloud Run.)

Alternatively, set up a **Cloud Build trigger** from the GCP Console → Cloud Build → Triggers → connect repo → on push to `main`, run `gcloud run deploy`. Skips the GitHub Actions hop.

## Cost (rough, low traffic)

| Item | Plan | Cost |
|------|------|------|
| Cloud Run backend | 1 vCPU, 512 MB, scale-to-zero | $0–5 (covered by free tier at low traffic) |
| Cloud Run frontend (option 3) | same | $0–5 |
| Cloud SQL Postgres | db-f1-micro | ~$10 |
| Artifact Registry | <5 GB | <$1 |
| Secret Manager | 5 secrets | <$1 |
| Vercel frontend (option 1) | Hobby | $0 |
| **Total (Vercel + Cloud Run + Cloud SQL)** | | **~$11 / month** |

GCP's Cloud Run free tier (2M requests / 360k vCPU-sec / 180k GB-sec per month) typically covers a small app entirely — your bill ends up being just Cloud SQL.

## Troubleshooting

- **Cloud Run service crashes on first deploy** — check Cloud Logging for the alembic / connection error. The most common cause is the Cloud SQL connection string: it must include `?host=/cloudsql/PROJECT:REGION:INSTANCE` because Cloud Run mounts the SQL instance as a unix socket.
- **`Permission denied on secret aegis-database-url`** — the Cloud Run service account doesn't have `roles/secretmanager.secretAccessor` on that secret. Re-run the IAM binding from Step 3.
- **PDF export 500 with libpango error** — backend image was built before the Cairo/Pango fix. Rebuild from `main`.
- **Cold start latency hurts** — set `--min-instances=1` (costs ~$5/month at idle).
- **Webhooks intermittently fail** — Cloud Run has a 60s request timeout by default. If a webhook handler is slow, bump it with `--timeout=300`.

## What's next

- Cloud Build trigger for fully GCP-native CI/CD.
- Cloud Armor in front of Cloud Run for DDoS / bot mitigation.
- Cloud Logging exports to BigQuery for long-term analysis.
- Switch to a Cloud SQL HA tier for production traffic.
