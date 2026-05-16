# Deploy: AWS

Run Aegis on AWS. Two backend options (**App Runner** for simplicity, **ECS Fargate** for control), three frontend options (Vercel, Amplify, or Cloud Run-style container hosting), and RDS Postgres.

```
   ┌───────────┐         ┌─────────────────┐       ┌──────────────┐
   │  Frontend │ /api/*  │  Backend (ECR)  │       │  RDS         │
   │  (Vercel/ ├────────►│  App Runner OR  ├──────►│  Postgres    │
   │  Amplify) │         │  ECS Fargate    │       │  db.t4g.micro│
   └───────────┘         └────────┬────────┘       └──────────────┘
                                  │
                                  ▼
                            CloudWatch logs
                            Secrets Manager
```

> **Read [vercel-neon.md](./vercel-neon.md) first** if you don't have a specific reason to be on AWS — it's $7/month vs ~$30–60 for the AWS equivalent.

## Prerequisites

- AWS account with billing enabled (free tier covers RDS for 12 months).
- AWS CLI v2 installed and authenticated (`aws configure`).
- A Docker registry inside AWS (ECR). The `.github/workflows/build-and-push.yml` workflow pushes there automatically if you set the right secrets/vars.
- An ACM certificate in the region you deploy to (for HTTPS on ALB or App Runner custom domain) — request one in the AWS Console **Certificate Manager**.

## Step 1 — Set up the registry (ECR)

```bash
aws ecr create-repository --repository-name aegis-backend  --region $AWS_REGION
aws ecr create-repository --repository-name aegis-frontend --region $AWS_REGION
```

Get the registry URL: `<ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com`.

Add these to the GitHub Actions workflow (Settings → Secrets and variables):

- **Variables**: `ECR_REGISTRY` = `<ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com`, `ECR_REGION` = `<REGION>`
- **Secrets**: `AWS_DEPLOY_ROLE_ARN` = an IAM role with `ecr:PutImage`, `ecr:Batch*`, configured for GitHub OIDC

Or push from your laptop:

```bash
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY
make push-ecr REGION=$AWS_REGION ACCOUNT=$AWS_ACCOUNT TAG=v1.0.0
```

## Step 2 — Provision the database (RDS)

```bash
aws rds create-db-instance \
  --db-instance-identifier aegis-db \
  --engine postgres \
  --engine-version 16.3 \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 \
  --master-username aegis \
  --master-user-password "$(openssl rand -hex 16)" \
  --db-name aegis \
  --backup-retention-period 7 \
  --publicly-accessible false \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name aegis-private-subnets \
  --region $AWS_REGION
```

Wait until the instance is `available` (~5–10 min):

```bash
aws rds wait db-instance-available --db-instance-identifier aegis-db --region $AWS_REGION
```

The connection string is `postgresql://aegis:<password>@<endpoint>:5432/aegis`. Stash it in Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name aegis/database-url \
  --secret-string "postgresql://aegis:<password>@<endpoint>:5432/aegis" \
  --region $AWS_REGION
```

Repeat for `aegis/jwt-secret-key` (`openssl rand -hex 32`), `aegis/anthropic-api-key`, `aegis/stripe-secret-key`, `aegis/stripe-webhook-secret`. Note each ARN.

## Step 3a — Backend on App Runner (recommended — simpler)

App Runner is the AWS equivalent of Cloud Run / Render: managed container, scales to zero, billed per request + memory. **~$5–25 / month** at small scale.

1. **Console → App Runner → Create service**.
2. **Source**: ECR → choose `aegis-backend:latest`.
3. **Service settings**:
   - **CPU**: 0.25 vCPU (smallest)
   - **Memory**: 0.5 GB (smallest)
   - **Port**: `8000`
   - **Start command**: leave empty (uses Dockerfile `CMD`).
4. **Environment variables**:
   - Plain: `LOG_FORMAT=json`, `DEBUG=false`, `CORS_ORIGINS=["https://app.example.com"]`
   - **From Secrets Manager**: `DATABASE_URL` → ARN from Step 2; same for `JWT_SECRET_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_*`.
5. **Health check**:
   - **Protocol**: HTTP
   - **Path**: `/api/health`
   - **Interval**: 20 s, **Healthy threshold**: 1
6. **Networking**: VPC connector — point at the same subnets as RDS so the backend can reach the DB on the private network.
7. **Auto scaling**: min 1, max 3 (or min 0 if you want scale-to-zero at the cost of cold starts).
8. **Custom domain** (optional): App Runner will give you a `.awsapprunner.com` URL. Add `api.example.com` and point a CNAME at it from your DNS.

After creation, test:

```bash
curl https://aegis-backend.us-east-1.awsapprunner.com/api/health
# {"ok":true,"db":true,"error":null}
```

## Step 3b — Backend on ECS Fargate (scale-up alternative)

If you outgrow App Runner (sustained high traffic, need fine-grained control over networking / logging / sidecars), move to ECS Fargate.

The headline difference: **ALB + Target Group + Task Definition + Service** instead of a single App Runner config. Roughly 2–3× more cost at idle (you pay for the ALB hour plus running tasks). Step-by-step:

1. Create an ECS cluster: `aws ecs create-cluster --cluster-name aegis`.
2. Write a task definition (`backend-taskdef.json`) — see the [template below](#ecs-task-definition-template).
3. Register it: `aws ecs register-task-definition --cli-input-json file://backend-taskdef.json`.
4. Create an ALB in the public subnets, target group on port 8000 with health check path `/api/health`.
5. Create an ECS service: `aws ecs create-service --cluster aegis --service-name aegis-backend --task-definition aegis-backend --desired-count 1 --launch-type FARGATE --network-configuration 'awsvpcConfiguration={subnets=[…],securityGroups=[…]}' --load-balancers 'targetGroupArn=arn:aws:elasticloadbalancing:…,containerName=backend,containerPort=8000'`.
6. Update the security group on RDS to allow inbound port 5432 from the ECS task SG.

#### ECS task definition template

```json
{
  "family": "aegis-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/aegis-backend-task",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/aegis-backend:latest",
      "portMappings": [{ "containerPort": 8000, "protocol": "tcp" }],
      "essential": true,
      "environment": [
        { "name": "LOG_FORMAT", "value": "json" },
        { "name": "DEBUG", "value": "false" },
        { "name": "CORS_ORIGINS", "value": "[\"https://app.example.com\"]" }
      ],
      "secrets": [
        { "name": "DATABASE_URL",         "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:aegis/database-url" },
        { "name": "JWT_SECRET_KEY",       "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:aegis/jwt-secret-key" },
        { "name": "ANTHROPIC_API_KEY",    "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:aegis/anthropic-api-key" },
        { "name": "STRIPE_SECRET_KEY",    "valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:aegis/stripe-secret-key" },
        { "name": "STRIPE_WEBHOOK_SECRET","valueFrom": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:aegis/stripe-webhook-secret" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/aegis-backend",
          "awslogs-region": "REGION",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -fsS http://localhost:8000/api/health || exit 1"],
        "interval": 30, "timeout": 5, "retries": 3, "startPeriod": 30
      }
    }
  ]
}
```

#### IAM — least privilege

The task role (`aegis-backend-task`) needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT:secret:aegis/*"
    }
  ]
}
```

The execution role is the standard `ecsTaskExecutionRole` plus `secretsmanager:GetSecretValue` on the same secrets.

## Step 4 — Frontend (pick one)

### Option 1 — Vercel (recommended, even on AWS)

Same as the [Vercel + Neon recipe](./vercel-neon.md#step-3--deploy-the-frontend-vercel), but:

- `BACKEND_INTERNAL_URL` = your App Runner / ALB URL (e.g. `https://api.example.com` or `https://aegis-backend.us-east-1.awsapprunner.com`)
- Update backend `CORS_ORIGINS` to include the Vercel domain.

You get free Vercel hosting + AWS-hosted backend + DB. Best of both worlds.

### Option 2 — AWS Amplify Hosting

Amplify supports Next.js SSR natively.

1. **Console → Amplify → New app → Host web app**.
2. Connect your GitHub repo. **Monorepo root**: `frontend`.
3. Amplify auto-detects Next.js. The default `amplify.yml` is fine.
4. Environment variables: `BACKEND_INTERNAL_URL` = backend public URL.
5. Deploy. Custom domain via Route 53 (Amplify provisions ACM cert automatically).

Cost: ~$0.01 per build minute + $0.15 per GB served. For low-traffic sites, often cheaper than Vercel — but Vercel's free tier is hard to beat at small scale.

### Option 3 — Frontend container on ECS Fargate / App Runner

The frontend `Dockerfile` produces a `node:20-alpine` runtime that runs `node server.js`. Same procedure as the backend deploy — point a Fargate service or App Runner service at the `aegis-frontend` ECR image, set `BACKEND_INTERNAL_URL`, port 3000.

Only useful if you want everything in one cloud for compliance / cost-center reasons.

### Option 4 — S3 + CloudFront

**Not recommended.** Aegis uses Next.js's standalone server (`output: "standalone"`) for SSR; static export (`output: "export"`) drops API routes, middleware, and dynamic rendering. You'd lose features. Skip.

## Step 5 — DNS, TLS, CDN

- **Custom domain**: Route 53 hosted zone → A/AAAA alias records pointing at the ALB or App Runner endpoint.
- **TLS**: ACM-managed cert (free) attached to the ALB / App Runner custom domain.
- **CDN**: Vercel / Amplify include one. For ECS-fronted frontend, put CloudFront in front of the ALB.

## Step 6 — Smoke test

Same checklist as [vercel-neon.md Step 6](./vercel-neon.md#step-6--smoke-test).

## Step 7 — CI/CD

`.github/workflows/build-and-push.yml` (in this repo) already pushes images to ECR on every `main` push, *if* you set the workflow vars/secrets in Step 1. To auto-deploy after the push, add a step that:

- For App Runner: `aws apprunner start-deployment --service-arn arn:aws:apprunner:…`
- For ECS: `aws ecs update-service --cluster aegis --service aegis-backend --force-new-deployment`

Add it as a job-level step after the `Build & push` step.

## Cost (rough, single AZ, low traffic)

| Item | Plan | Cost |
|------|------|------|
| App Runner | 0.25 vCPU, 0.5 GB, ~720 hrs | ~$22 |
| RDS Postgres | db.t4g.micro, single AZ | ~$14 |
| ECR | <5 GB images | <$1 |
| Data transfer | <10 GB egress | ~$1 |
| Vercel frontend | Hobby | $0 |
| Secrets Manager | 5 secrets | ~$2 |
| **Total** | | **~$40 / month** |

ECS Fargate equivalent adds ALB (~$18/mo) → ~$58/month total.

## Troubleshooting

- **App Runner says `Service failed to reach a healthy state`** — usually `/api/health` returns 500 because the DB is unreachable. Check that the App Runner VPC connector is attached to the same subnets as RDS and that the RDS security group allows inbound 5432 from the App Runner SG.
- **`alembic upgrade head` hangs on startup** — your task can't reach RDS. Check security groups and DNS resolution from the VPC connector.
- **PDF export 500 with libpango error** — your backend image was built before the Cairo/Pango fix. Rebuild from `main`.
- **CloudWatch shows JSON logs as a single line per record** — that's correct; `LOG_FORMAT=json` is the prod default. Use CloudWatch Logs Insights queries: `fields @timestamp, level, message | filter level = "ERROR"`.

## What's next

- [Observability stack](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch-application-insights.html) — Sentry or CloudWatch Container Insights.
- Multi-AZ RDS for HA.
- WAF in front of CloudFront for bot mitigation.
- Migrate Secrets Manager values to AWS Systems Manager Parameter Store if you prefer (cheaper at scale).
