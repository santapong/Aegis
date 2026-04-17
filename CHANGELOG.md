# Changelog

All notable changes to the Aegis Money Management project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

---

## [0.7.0] - 2026-04-17

### Added
- **Frontend shadcn/ui design-token migration** across all 12 pages (payments,
  calendar, savings, gantt, reports, budgets, debts, plans, settings, docs,
  transactions) plus the error-boundary component. Legacy `var(--*)` CSS
  variables replaced with Tailwind tokens (`primary`, `destructive`,
  `muted`, `foreground`, `input`, `border`, `card`). `CardBody` → `CardContent`,
  `variant="cancel"` → `variant="outline"`, `variant="danger"` → `variant="destructive"`.
- **Backend smoke-test harness** under `backend/tests/` using pytest + httpx
  with an in-memory SQLite. Covers `/api/health` and the
  register → login → authorized `/api/auth/me` flow plus the 401-without-token contract.
- `test` optional-dependency group and `[tool.pytest.ini_options]` in `pyproject.toml`.

### Changed
- `.env.example` now covers every setting declared in `backend/app/config.py`:
  added `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES`, and `AI_MODEL`.
- `README.md` rewritten: SQLite-first quickstart, JWT auth flow,
  `/docs` in-app page, Stripe test-key onboarding, link to CHANGELOG.
- Version bumped to `0.7.0` in `pyproject.toml`, `backend/app/main.py`,
  `frontend/package.json`, and the in-app Settings page.
- `docker-compose.dev.yml` top comment clarifies how to use the override.

### Fixed
- `JWT_SECRET_KEY` was absent from `.env.example`, so a fresh clone silently
  ran with the config default `CHANGE-ME-IN-PRODUCTION`. Now explicit.

---

## [0.6.0] - 2026-04-12

### Added
- **JWT authentication & multi-user support**
  - `User` model with email, username, bcrypt-hashed password.
  - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
  - `get_current_user` dependency protects all resource routers.
  - `user_id` foreign key on Plan, Transaction, Budget, SavingsGoal, Debt,
    Payment, AIRecommendation, and Tag for per-user isolation.
  - Frontend `/login` and `/register` pages, auth-store (Zustand), AuthGate
    component, JWT attached to every API call.
- **Alembic database migrations** replacing `create_all()` at startup.
  Initial migration `686549b8431b_initial_schema_with_user_auth.py`
  captures all tables, indices, and foreign keys; SQLite batch mode enabled.
- **Claude `tool_use` AI integration** — AI advisor, analysis, recommendations,
  forecast, and weekly summary use native `tools` + `tool_choice` for
  guaranteed structured output (no more `text.find("[")` parsing).
- **Multi-database support** — `DATABASE_URL` switches between PostgreSQL,
  MySQL, and SQLite via a dialect-aware engine factory in `backend/app/database.py`.
  SQLite gets `check_same_thread=False` and `PRAGMA foreign_keys=ON`; PG/MySQL
  use `pool_pre_ping`. Drivers `psycopg2-binary` and `pymysql` added.
- **Frontend `/docs` page** with API reference, user guide, and setup instructions.
- **CHANGELOG.md** bootstrapped.

### Changed
- API `version` bumped to `0.6.0` in the FastAPI constructor and `/api/health`.
- Settings page About section reflects v0.6.0, shadcn/ui, and PostgreSQL.

---

## [0.5.0] - 2026-04-05

### Added
- **Security Hardening**
  - Security headers middleware (X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy)
  - In-memory rate limiting middleware (100 req/min default, 20 req/min for sensitive endpoints)
  - Request logging with loguru (method, path, status code, response time)
  - CSV import file size limit (5MB) and content type validation
  - API documentation hidden in production mode (only accessible when DEBUG=true)
- **Stripe Test Mode Integration**
  - Stripe checkout session creation (`POST /api/payments/create-checkout-session`)
  - Payment listing and detail endpoints (`GET /api/payments/`)
  - Stripe webhook handler with signature verification (`POST /api/payments/webhook`)
  - Stripe configuration endpoint (`GET /api/payments/config`)
  - Payment model with status tracking (pending, succeeded, failed, refunded, cancelled)
  - Payments page in frontend with test card info, checkout flow, and payment history
  - Test mode banner with clear visual indicator
- **User Experience**
  - Custom 404 page with navigation options
  - Global error boundary page with retry button
  - Global loading skeleton state
  - Payments link in sidebar navigation

### Changed
- CORS configuration restricted to specific HTTP methods and headers (was wildcard)
- API version updated to 0.5.0
- Settings page version updated to 0.5.0
- Default DEBUG changed to false in .env.example

### Security
- Fixed overly permissive CORS: restricted `allow_methods` and `allow_headers` from wildcard
- Added security headers to all API responses
- Added rate limiting to prevent abuse
- CSV upload hardened with size and content-type validation
- Stripe webhook signature verification prevents forged events

---

## [0.4.0] - 2026-03-30

### Added
- **Transaction Tags/Labels** — flexible multi-tag categorization for transactions
- **Recurring Transactions & Subscription Tracker**
- **CSV/Bank Statement Import** with auto-detect and preview
- **Savings Goals with Progress Tracking**
- **Debt Payoff Tracker** with avalanche and snowball strategies
- **Financial Insights & Weekly Summary**
- Added Savings Goals and Debt Tracker to sidebar navigation

### Changed
- Updated API version to 0.4.0
- Enhanced transaction creation form with tag picker and recurring toggle
- Expanded TypeScript types for all new features

---

## [0.3.0] - 2026-03-14

### Added
- Complete Aegis frontend overhaul with modern UI component library
- Reusable UI primitives, toast notification system, error boundary, progress ring
- Transactions, Plans & Goals, and Settings pages
- Framer Motion animations throughout
- Mobile-responsive sidebar and notification center
- Dark mode fix (theme syncs to DOM and persists)

### Changed
- Renamed application from "MoneyAI" to "Aegis"
- Enhanced Dashboard, Budgets, Calendar, Gantt, Reports, AI Panel

### Fixed
- Docker best practices: multi-stage builds, non-root users, restart policies,
  resource limits, standalone Next.js output.

---

## [0.2.0] - 2026-03-14

### Added
- Financial analysis and reporting features (budget vs actual, monthly category
  comparison, CSV export, spending anomaly detection, financial health score,
  cash flow forecast).
- Budget management and Reports & Analytics frontend pages.
- Dashboard KPI cards, spending charts, and trend charts.

### Fixed
- Docker Compose verification: reliable container startup and healthchecks.

---

## [0.1.0] - 2026-03-14

### Added
- Initial full-stack scaffold: FastAPI backend, Next.js 15 + React 19 frontend,
  PostgreSQL with SQLAlchemy, Claude AI analysis, Docker Compose infra.
