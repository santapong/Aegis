# Aegis — AI-Powered Money Management

AI-powered financial planning with calendar, Gantt charts, JWT auth, Stripe test-mode payments, keyboard-first navigation, PDF reports, and smart recommendations powered by Claude.

Status: **v1.0.0 — generally available.** See [CHANGELOG.md](CHANGELOG.md) for release history and [ROADMAP.md](ROADMAP.md) for the post-v1 direction.

Public landing page: [`/welcome`](http://localhost:3000/welcome).

## Tech Stack

| Layer      | Technology                                                      |
|------------|-----------------------------------------------------------------|
| Backend    | Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2               |
| Database   | SQLite (dev) / PostgreSQL 16 / MySQL — pick via `DATABASE_URL`   |
| Migrations | Alembic                                                          |
| Auth       | JWT (HS256) with bcrypt password hashing                         |
| AI         | Claude API (Anthropic) with `tool_use` structured output         |
| Payments   | Stripe test mode (checkout + webhooks)                           |
| Reports    | WeasyPrint (PDF) + matplotlib (server-side charts)               |
| Frontend   | Next.js 15, React 19, TypeScript, Bun                            |
| Styling    | Tailwind CSS v4, shadcn/ui (Radix primitives)                    |
| Charts     | Recharts                                                         |
| State      | Zustand + TanStack React Query v5                                |
| Perf       | `@tanstack/react-virtual` for long lists                         |
| UX         | `driver.js` onboarding tour + `react-hotkeys-hook` shortcuts     |
| CI/CD      | GitHub Actions → GHCR multi-arch (`amd64` + `arm64`)             |

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Generate a real JWT secret and paste it as JWT_SECRET_KEY:
openssl rand -hex 32
```

The default `DATABASE_URL` is SQLite (`sqlite:///./money_management.db`) so you can run end-to-end with zero infra. Optionally paste your Anthropic and Stripe test keys.

### 2. System dependencies for PDF export

WeasyPrint needs Cairo / Pango. On Debian / Ubuntu:

```bash
sudo apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 libffi-dev
```

On macOS: `brew install pango cairo gdk-pixbuf libffi`. The GHCR image bakes these in.

### 3. Run with Docker Compose

```bash
docker compose up -d        # production-ish
# or, for hot reload:
make dev
```

Frontend: http://localhost:3000 • Backend: http://localhost:8000

### 4. Or run manually via `make`

```bash
make migrate      # alembic upgrade head
make seed         # populate with demo@aegis.local + 120 days of data
make backend      # uvicorn --reload
make frontend     # bun run dev
make test         # backend pytest
```

### 5. Published images (GHCR)

After `git tag v1.0.0 && git push --tags`, the `release.yml` workflow publishes:

```
ghcr.io/santapong/aegis-backend:1.0.0
ghcr.io/santapong/aegis-frontend:1.0.0
```

## First-time user flow

1. Open http://localhost:3000/welcome for the landing page, or jump straight to `/register`.
2. Register with email + username + password (≥8 chars).
3. Log in — the JWT is stored in the Zustand auth store.
4. The **onboarding tour** walks you through Dashboard → Transactions → Budgets → AI Advisor on first login. Skip it or replay it from **Settings → Preferences → Restart tour**.
5. Press <kbd>?</kbd> anytime for the shortcut cheatsheet; <kbd>/</kbd> opens the global command palette.

Or, to explore with pre-loaded data:

```bash
make seed
# then log in with: demo@aegis.local / demo-password-123
```

## Features

- **Landing** — public `/welcome` marketing page (chrome-less, CTA to register).
- **Dashboard** — KPI cards, spending charts, financial health score, cash-flow forecast, AI-generated insights.
- **Transactions** — CRUD, CSV import with preview, recurring / subscription tracker, multi-tag categorization, free-text search (`?q=`).
- **Budgets** — period-based limits with budget-vs-actual comparison.
- **Savings Goals** — target tracking with contributions.
- **Debt Tracker** — avalanche / snowball payoff strategies with interest calculations.
- **Plans & Goals** — hierarchical financial plans with progress tracking.
- **Calendar Planner** — monthly / weekly views, drag-drop rescheduling.
- **Gantt Chart** — timeline visualization with zoom levels, mobile touch scrolling.
- **Reports** — category comparison, trend analysis, CSV **and PDF** export (WeasyPrint).
- **Payments** — Stripe test-mode checkout with webhook-driven status updates.
- **AI Advisor** — spending analysis, budget recommendations, 6-month forecasting, weekly summary.
- **Notifications** — server-backed budget / bill / goal / anomaly alerts with idempotent dedupe keys.
- **Onboarding tour** — first-run walkthrough (`driver.js`), replayable from Settings.
- **Keyboard shortcuts** — `N` new, `/` search, `?` cheatsheet, `g d/t/b/c/r` navigation.
- **Docs** — in-app `/docs` page with API reference and user guide.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `N` | New transaction |
| `/` | Open command palette / focus search |
| `?` | Show cheatsheet |
| `g d` | Go to dashboard |
| `g t` | Go to transactions |
| `g b` | Go to budgets |
| `g c` | Go to calendar |
| `g r` | Go to reports |
| `Esc` | Close dialog / palette |

## API Docs

When `DEBUG=true`:

- Swagger UI: http://localhost:8000/api/docs
- ReDoc:      http://localhost:8000/api/redoc

In production (`DEBUG=false`) these are disabled.

## Testing

```bash
make test
# or:
cd backend && uv pip install -e '.[test]' && pytest
```

Smoke tests live in `backend/tests/test_smoke.py` and cover `/api/health` plus the register → login → authorized-request flow.

## Directory layout

```
aegis/
├── .github/workflows/
│   └── release.yml             GHCR multi-arch publish on version tag
├── backend/
│   ├── app/
│   │   ├── services/           notification_service.py, pdf_renderer.py, ai_engine.py
│   │   ├── seeds/              demo.py (seed fixture)
│   │   └── templates/          report.html (WeasyPrint)
│   ├── alembic/                Database migrations
│   └── tests/                  Backend tests
├── frontend/
│   └── src/
│       ├── app/                Next.js App Router (welcome, login, register, dashboard, …)
│       ├── components/
│       │   ├── ui/             shadcn/ui + custom (virtual-list, cheatsheet-dialog)
│       │   ├── search/         command-palette
│       │   ├── global-shortcuts.tsx
│       │   └── onboarding-tour.tsx
│       ├── stores/             zustand (auth, app, notification)
│       └── lib/                API client, utilities
├── Makefile
├── docker-compose.yml
├── docker-compose.dev.yml
├── CHANGELOG.md
└── ROADMAP.md
```

## License

MIT — see [LICENSE](LICENSE).
