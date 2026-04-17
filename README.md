# Aegis — AI-Powered Money Management

AI-powered financial planning with calendar, Gantt charts, JWT auth, Stripe test-mode payments, and smart recommendations powered by Claude.

Status: **v0.7.0** — production-ready for beta. See [CHANGELOG.md](CHANGELOG.md) for release history and [plans/aegis-launch](https://github.com/santapong/obsidian/blob/main/wiki/plans/aegis-launch.md) for launch readiness.

## Tech Stack

| Layer      | Technology                                                      |
|------------|-----------------------------------------------------------------|
| Backend    | Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2               |
| Database   | SQLite (dev) / PostgreSQL 16 / MySQL — pick via `DATABASE_URL`   |
| Migrations | Alembic                                                          |
| Auth       | JWT (HS256) with bcrypt password hashing                         |
| AI         | Claude API (Anthropic) with `tool_use` structured output         |
| Payments   | Stripe test mode (checkout + webhooks)                           |
| Frontend   | Next.js 15, React 19, TypeScript, Bun                            |
| Styling    | Tailwind CSS v4, shadcn/ui (Radix primitives)                    |
| Charts     | Recharts                                                         |
| State      | Zustand + TanStack React Query v5                                |

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Generate a real JWT secret and paste it as JWT_SECRET_KEY:
openssl rand -hex 32
```

The default `DATABASE_URL` is SQLite (`sqlite:///./money_management.db`) so you can run end-to-end with zero infra. Optionally paste your Anthropic and Stripe test keys.

### 2. Run with Docker Compose

```bash
docker compose up -d        # production-ish
# or, for hot reload:
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Frontend: http://localhost:3000 • Backend: http://localhost:8000

### 3. Or run manually

```bash
# Backend
cd backend
uv pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
bun install
bun run dev
```

## First-time user flow

1. Open http://localhost:3000 — you'll be redirected to `/register`.
2. Register with email + username + password (≥8 chars).
3. Log in — the JWT is stored in the Zustand auth store.
4. Add a transaction, create a budget, explore the Calendar and Gantt views, open the AI Advisor panel.

## Features

- **Dashboard** — KPI cards, spending charts, financial health score, cash-flow forecast, AI-generated insights.
- **Transactions** — CRUD, CSV import with preview, recurring / subscription tracker, multi-tag categorization.
- **Budgets** — period-based limits with budget-vs-actual comparison.
- **Savings Goals** — target tracking with contributions.
- **Debt Tracker** — avalanche / snowball payoff strategies with interest calculations.
- **Plans & Goals** — hierarchical financial plans with progress tracking.
- **Calendar Planner** — monthly / weekly views, drag-drop rescheduling.
- **Gantt Chart** — timeline visualization with zoom levels.
- **Reports** — category comparison, trend analysis, CSV export.
- **Payments** — Stripe test-mode checkout with webhook-driven status updates.
- **AI Advisor** — spending analysis, budget recommendations, 6-month forecasting, weekly summary.
- **Docs** — in-app `/docs` page with API reference and user guide.

## API Docs

When `DEBUG=true`:

- Swagger UI: http://localhost:8000/api/docs
- ReDoc:      http://localhost:8000/api/redoc

In production (`DEBUG=false`) these are disabled.

## Testing

```bash
cd backend
uv pip install -e '.[test]'
pytest
```

Smoke tests live in `backend/tests/test_smoke.py` and cover `/api/health` plus the register → login → authorized-request flow.

## Directory layout

```
aegis/
├── backend/
│   ├── app/              FastAPI app (routers, models, schemas, services)
│   ├── alembic/          Database migrations
│   └── tests/            Backend tests
├── frontend/
│   └── src/
│       ├── app/          Next.js App Router pages
│       ├── components/   shadcn/ui + custom components
│       └── lib/          API client, utilities
├── docker-compose.yml
├── docker-compose.dev.yml
├── CHANGELOG.md
└── ROADMAP.md
```

## License

MIT — see [LICENSE](LICENSE).
