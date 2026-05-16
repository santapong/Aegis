# Deploy: Self-hosted (Docker Compose)

Run all three services (frontend + backend + Postgres) on a single VPS, fronted by Caddy for automatic HTTPS. **~$5–20 / month** on a $5–10 DigitalOcean droplet or equivalent Hetzner / Linode / Vultr / OVH instance.

```
       Internet (TLS auto-renewed by Caddy)
                    │
                    ▼
        ┌──────────────────────┐
        │   Caddy reverse proxy│ ← :80 / :443
        │   on the same host   │
        └──────────┬───────────┘
              ┌────┴────┐
              ▼         ▼
        frontend     backend ─→ postgres
        :3000        :8000       :5432 (private network only)
```

This is the deployment story `docker-compose.prod.yml` is designed for. Caddy handles TLS via Let's Encrypt or the DNS challenge.

## Prerequisites

- A VPS with Docker + Docker Compose v2 installed (Ubuntu 22.04 LTS or 24.04 LTS recommended). 1 GB RAM minimum; 2 GB recommended.
- A domain name pointing an A record at the VPS public IP. Caddy needs this to issue a Let's Encrypt cert.
- SSH access. The rest of this doc runs as a non-root user with `sudo`.

## Step 1 — Bootstrap the host

```bash
# Update packages
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # reload group membership without re-login

# Allow ports 80 + 443
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 2 — Clone and configure

```bash
git clone https://github.com/santapong/aegis.git
cd aegis

# Generate a .env with a fresh JWT_SECRET_KEY
make setup
```

Edit `.env` to set:

```env
JWT_SECRET_KEY=...                            # `openssl rand -hex 32`
POSTGRES_USER=postgres                        # change for prod
POSTGRES_PASSWORD=<a strong password>         # change for prod
DATABASE_URL=postgresql://postgres:<password>@db:5432/money_management
CORS_ORIGINS=["https://aegis.example.com"]
DEBUG=false
LOG_FORMAT=json
ANTHROPIC_API_KEY=...                         # optional
STRIPE_SECRET_KEY=...                         # optional
```

## Step 3 — Configure Caddy for the public domain

The repo ships a local-only `Caddyfile` (uses `local_certs` for `https://localhost`). For production, swap it for one that uses your real domain:

```caddyfile
# Caddyfile
{
    admin off
}

aegis.example.com {
    encode gzip zstd

    handle /api/* {
        reverse_proxy backend:8000
    }
    handle {
        reverse_proxy frontend:3000
    }
}
```

Replace `aegis.example.com` with your domain. Caddy will auto-provision a Let's Encrypt cert on first boot.

## Step 4 — Start

```bash
make up-prod
```

This runs `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`, which:

1. Builds the backend image (Cairo/Pango baked in).
2. Builds the frontend image (standalone Next.js).
3. Starts Postgres with the `pgdata` named volume.
4. Waits for the DB to be healthy, then starts the backend (which runs `alembic upgrade head` via `docker-entrypoint.sh`).
5. Starts the frontend.
6. Starts Caddy, which provisions TLS for your domain.

First boot takes ~3–5 minutes (cert issuance + migrations).

Verify:

```bash
curl https://aegis.example.com/api/health
# {"ok":true,"db":true,"error":null}
```

Browse `https://aegis.example.com` — register a new account, log in.

## Step 5 — Backups

The Postgres data lives in a Docker named volume `pgdata`. Back it up regularly.

### Nightly backup cron

```bash
sudo crontab -e
```

Add:

```cron
0 3 * * * cd /home/$USER/aegis && docker compose exec -T db pg_dump -U postgres money_management | gzip > /home/$USER/backups/aegis-$(date +\%Y\%m\%d).sql.gz
0 4 * * * find /home/$USER/backups -name 'aegis-*.sql.gz' -mtime +14 -delete
```

Mount `/home/$USER/backups` somewhere off-host (rclone to S3 / Backblaze / Wasabi) for disaster recovery:

```bash
# Example: sync nightly to Backblaze B2
0 5 * * * rclone sync /home/$USER/backups b2:my-aegis-backups
```

### Restore

```bash
gunzip -c backups/aegis-20260516.sql.gz | docker compose exec -T db psql -U postgres -d money_management
```

## Step 6 — Updates

```bash
git pull
make up-prod   # rebuilds changed images, applies any new migrations on next boot
```

For zero-downtime updates with two replicas behind Caddy, use the `docker-compose.scale.yml` pattern (out of scope here — small VPS deployments typically tolerate the ~10-second downtime during a rolling restart).

## Step 7 — Monitoring (light touch)

For a single-host deploy, two cheap signals catch most outages:

- **Uptime ping**: free [Uptime Kuma](https://github.com/louislam/uptime-kuma) container in the same compose, monitoring `https://aegis.example.com/api/health`.
- **Email alerts on container exit**: add a [docker-event-listener](https://github.com/wdullaer/docker-volume-backup) sidecar, or use Caddy's structured logs piped to `vector` / `loki`.

## Smoke test

Same as the [Vercel + Neon checklist](./vercel-neon.md#step-6--smoke-test).

## Cost

| Item | Plan | Cost |
|------|------|------|
| VPS | DigitalOcean Basic 1 GB | $4 |
| Domain | varies | ~$1/month |
| Backup storage | Backblaze B2, 10 GB | <$1/month |
| **Total** | | **~$5–10 / month** |

Hetzner CX11 (Germany) is half the price (~$3/mo) if latency to your users is OK.

## Troubleshooting

- **Caddy logs `unable to obtain certificate`** — your domain doesn't resolve to the VPS IP, or ports 80/443 are firewalled. Check `dig aegis.example.com +short` and `sudo ufw status`.
- **Backend container restarts with `connection refused`** — Postgres isn't healthy yet. Tail `docker compose logs db` and confirm `pg_isready` succeeds.
- **PDF export 500 with libpango error** — image was built before the Cairo/Pango fix landed in `backend/Dockerfile`. `git pull && make up-prod`.
- **Out of memory on a 1 GB droplet** — Postgres + Next.js + Python is tight. Bump to a 2 GB plan, or move Postgres off-host to a free Neon database.

## What's next

- Migrate the database to Neon / Supabase (`DATABASE_URL` change only) so you can move the app to any host without DB downtime.
- Use [Tailscale](https://tailscale.com/) to lock SSH access to your tailnet.
- Add Sentry for error tracking — uncomment `SENTRY_DSN` in `.env` when supported (roadmap item).
