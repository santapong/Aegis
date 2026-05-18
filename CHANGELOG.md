# Changelog

All notable changes to the Aegis Money Management project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — performance

- **Pluggable cache layer** (`backend/app/cache.py`) — `CACHE_BACKEND`
  env var selects `memory` (per-process TTL dict, default), `redis`
  (production, shared across workers), or `disabled` (incident-response
  no-op). JSON values serialized via `pydantic_core.to_jsonable_python`;
  SCAN-based prefix delete on Redis; per-user invalidation helper. Now
  wired on `/api/dashboard/{summary,charts,health-score,cashflow-forecast}`
  and `/api/ai/{weekly-summary,insights}`, invalidated on every
  transaction mutation.
- **Redis-backed rate limiter** — replaces the per-worker in-memory
  limiter when `CACHE_BACKEND=redis` is set. Re-attempts Redis every
  60 s if unreachable at boot. Strict-prefix list expanded to cover
  `/api/auth/{login,register,google,logout}` and `/api/export/`.
- **Hot-path composite indexes** (v0.9.7 + v0.9.8 migrations) on
  `transactions(user_id, date)`, `(user_id, type, date)`,
  `(user_id, is_recurring)`, `(user_id, category)`,
  `plans(user_id, status)`, `plans(user_id, start_date)`,
  `budgets(user_id, period_start)`,
  `ai_recommendations(user_id, created_at)`.
- **`GZipMiddleware`** registered globally — ~75% wire-size reduction
  on dashboard JSON payloads (≥ 500 B threshold).
- **NDJSON export endpoints** (`/api/export/{transactions,plans,
  budgets}.ndjson`) — stream per-user data with `yield_per(100)` for
  warehouse ingestion and GDPR subject-access requests.
- **`docs/PERFORMANCE_BACKLOG.md`** — tracks remaining audit findings
  with impact × effort sequencing.
- **`docs/analytics-warehouses.md`** — CDC patterns and per-warehouse
  target schemas (Redshift, BigQuery, Snowflake, ClickHouse).
- **`docs/databases.md`** — multi-DB compatibility matrix for 20
  Postgres / MySQL / NewSQL targets.

### Added — security

- **Google sign-in** via Google Identity Services ID-token flow
  (`/api/auth/google` + opt-in `/api/auth/google/link`). Refuses
  silent account-link on the unauthenticated endpoint to avoid
  takeover via recycled Gmail addresses.
- **httpOnly session cookie** — JWT now in `aegis_session` cookie set
  on `/login` and `/google`. JavaScript can no longer read the token
  (XSS exfiltration closed). `AUTH_COOKIE_SAMESITE` env (`lax` default,
  `none` for cross-origin; `none` force-enables Secure).
- **App-level request body size cap** (default 2 MB,
  `MAX_REQUEST_BODY_BYTES`; CSV imports 5 MB) as pure-ASGI middleware
  so 413 surfaces cleanly even when the route raised.
- **FK `ON DELETE CASCADE`** on every user-owned table (v0.9.6
  migration). Deleting a user atomically cascades — GDPR-ready.
- **Multi-database support** — `database.py` rewritten with per-dialect
  engine config; pool sizing exposed via `DB_POOL_*` env vars. Tested:
  SQLite, Postgres 13–17, MySQL 8.0+, MariaDB 10.5+, RDS, Aurora,
  Cloud SQL, AlloyDB, Azure, Neon, Supabase, Yugabyte, CockroachDB,
  TiDB.
- **CI workflow** (`.github/workflows/test.yml`) — matrix runs pytest
  on (SQLite, Postgres) × (Python 3.11, 3.12) with a Redis service,
  plus ruff, bandit, Trivy SARIF upload.

### Added — UX

- **Galaxy theme system** — three runtime-switchable themes
  (Observatory, Constellation, Supernova) replacing the binary
  dark/light toggle. Persisted per-user via `user_preferences`.
- **Server-side pagination** with "Load more" footers on transactions,
  plans, payments, trips, investments pages.
- **Public landing page** (`/landing`) with `AuthGate` bypass.
- **Tutorials series** (`docs/tutorials/`) — getting started, CSV
  import, AI assistant, deploy-production, caching.

### Changed

- **8 routes converted from materialize-then-aggregate to SQL
  aggregation**: `dashboard.{summary,charts,health-score,cashflow-forecast}`,
  `transactions.transaction_summary`, `ai.weekly_summary`,
  `reports.category_comparison`,
  `notification_service.evaluate_budget_thresholds`. Worst-case path
  on 100k transactions drops from ~250 ms to ~5 ms.
- **`detect_anomalies` two-step**: per-category average via `GROUP BY`
  then a single bounded query for outliers — was loading every expense
  in the window.
- **`list_transactions`, `get_recurring_transactions`,
  `detect_anomalies`** — `selectinload(Transaction.tags)` eliminates
  N+1 lazy loads (was up to 500 extra SQL roundtrips per page at
  `limit=500`).
- **Dashboard bundle**: 14 kB / 293 kB First Load JS → 8.85 kB / 167 kB
  (−43%). Recharts dynamic-imported via `next/dynamic`.
- **Stripe return URLs** now derived from `FRONTEND_URL` (was
  caller-supplied with localhost default — open redirect + broken
  in production).
- **React Query**: `staleTime: 60_000`, `refetchOnWindowFocus: false`
  — matches backend cache TTL, cuts redundant refetches.
- **Lifespan handler** replaces deprecated `@app.on_event("startup")`;
  engine disposed on SIGTERM for graceful shutdown.
- **Uvicorn defaults** (`backend/Dockerfile`):
  `--proxy-headers --forwarded-allow-ips=* --timeout-graceful-shutdown=25`.

### Fixed

- **Account-takeover via silent Google auto-link** — was allowing any
  verified-Google account to attach to an existing email/password user.
- **Tag uniqueness was global** — Alice's "groceries" blocked Bob's
  own tag. v0.9.5 migration moves to composite `(user_id, name)`.
- **`/api/transactions/import/preview` was unauthenticated** — DoS
  vector via repeated 5 MB CSV parses.
- **`/api/health` logged on every probe** — silenced; was generating
  thousands of zero-signal log lines per pod per day.
- **AI provider clients had no HTTP timeout** — hung upstream could
  pin a worker for 10 min (SDK default). Now 30 s.
- **CSP allowed `unsafe-eval`** — dropped; HSTS added; Google + Stripe
  origins allowlisted.
- **CSV exports were unbounded** — capped at 50 000 rows
  (configurable), PDF capped at 5 000.

---

## [1.0.0] - 2026-04-17

**General availability.**

### Added
- **Demo seed data** — `backend/app/seeds/demo.py` creates a `demo@aegis.local`
  user with 120 days of deterministic transactions, three active budgets, two
  savings goals, a credit-card debt, and two seed notifications. Idempotent per
  demo user: re-running wipes only that user's rows. Entry point:
  `python -m backend.app.seeds.demo`.
- **Makefile** with `migrate`, `seed`, `test`, `backend`, `frontend`, `dev`
  targets wrapping the most common commands.
- **Public landing page** at `/welcome` — chrome-less marketing page with
  feature grid, live gradient, and CTAs to register / sign in. `AuthGate` now
  treats `/welcome` as a public route alongside `/login` and `/register`.
- **GHCR release workflow** — `.github/workflows/release.yml` builds
  multi-arch (`amd64` + `arm64`) images of `aegis-backend` and
  `aegis-frontend` and pushes to `ghcr.io/<owner>/...` on every `v*.*.*` tag
  (also dispatchable manually). Uses Docker Buildx + GitHub Actions cache.

### Changed
- Version bumped to `1.0.0` in `pyproject.toml`, `backend/app/main.py`,
  `frontend/package.json`, Settings → About, and the landing page footer.
- `ROADMAP.md` rewritten to reflect GA plus the post-v1 backlog (smart AI &
  real-time, feature expansion, integrations, ops & SRE).
- `README.md` "Status" line updated to GA; feature list references the
  landing page.

---

## [0.9.0] - 2026-04-17

**Theme:** Scale & export.

### Added
- **Virtual scrolling primitive** — new `frontend/src/components/ui/virtual-list.tsx`
  (TanStack `@tanstack/react-virtual` v3) for rendering long transaction /
  payment lists without frame drops. Uses dynamic `measureElement` so variable
  row heights work out of the box.
- **PDF export of reports** — new `GET /api/reports/export.pdf?start_date=&end_date=`
  rendered server-side via **WeasyPrint**. HTML + print CSS template at
  `backend/app/templates/report.html`; server-side matplotlib chart inlined
  as base64 PNG. "PDF" button sits beside the existing CSV export on `/reports`.
- **Mobile polish** — `.gantt-scroll` helper (`touch-action: pan-x`,
  `overscroll-behavior-x: contain`) prevents swipe-back conflict on
  horizontally-scrolling timelines; `.chart-responsive` helper clamps Recharts
  containers on narrow viewports; `prefers-reduced-motion` is now honored
  globally.
- **Empty-state / skeleton / 404 polish** — `EmptyState` now accepts an
  `illustration` slot; `Skeleton` ships with `SkeletonRows` and `SkeletonCard`
  helpers. Every app route now has a dedicated `loading.tsx`
  (`budgets`, `debts`, `savings`, `plans`, `payments`, `calendar`, `gantt`,
  `settings`, `reports`, `transactions`).

### Changed
- Version bumped to `0.9.0` in `pyproject.toml`, `backend/app/main.py`,
  `frontend/package.json`, and the in-app Settings → About panel.
- Backend dependencies add `jinja2`, `matplotlib`, `weasyprint`, `python-multipart`.

---

## [0.8.0] - 2026-04-17

**Theme:** First-run & discoverability.

### Added
- **Onboarding tour** (`driver.js`) — first-run walkthrough of
  Dashboard → Transactions → Budgets → AI Advisor. Skippable, replayable from
  Settings → Preferences → "Restart tour". Server-persisted via new
  `users.onboarded_at` column (Alembic migration `a1c8f3b4e501`) with a local
  zustand fallback (`hasSeenTour`). `data-tour-id` anchors added to the sidebar
  and AI Advisor trigger.
- **Keyboard shortcuts** (`react-hotkeys-hook`) — `N` new transaction, `/`
  command palette, `?` cheatsheet, `g d` / `g t` / `g b` / `g c` / `g r`
  navigation, `Esc` to close. Scoped to non-editable focus so it never fights
  form inputs.
- **Command palette** — global `/` spotlight composed from shadcn primitives
  (`ScrollArea`, popover surface, plain input). Page jumps plus live transaction
  search (`GET /api/transactions/?q=`, 250 ms debounce via `useDeferredValue`
  and React Query caching).
- **Transaction full-text search** — `?q=` query parameter added to
  `GET /api/transactions`. Server-side `ILIKE` match across `description` and
  `category`. (Postgres `tsvector` upgrade path documented for a future
  release.)
- **Server-backed notification center** — new `notifications` table with
  `(user_id, dedupe_key)` unique index, endpoints under `/api/notifications/`
  (`GET`, `POST /{id}/read`, `POST /read-all`, `DELETE /`), and a
  `notification_service.py` emitter for budget overruns, bill reminders, goal
  milestones, and anomalies. The existing `NotificationCenter` component now
  polls every 60 s and syncs state via the rewritten `notification-store.ts`.
- **New endpoint** `POST /api/auth/onboarded` stamps `users.onboarded_at`
  idempotently.
- **Cheatsheet dialog** (`?`) listing every shortcut.

### Changed
- `NotificationCenter` + `notification-store` switched from client-only
  persistence to server-authoritative state (`read_at` replaces boolean `read`;
  `bill_reminder` added to `NotificationType`).
- `Providers` now mounts `GlobalShortcuts` and `OnboardingTour` alongside the
  existing React Query + theme providers.
- `app-store` persists `hasSeenTour` and exposes `restartTour()`.
- Version bumped to `0.8.0` in the relevant surfaces.

### Migrations
- `a1c8f3b4e501_v080_onboarded_and_notifications.py` — adds `users.onboarded_at`
  and the `notifications` table with indexes and a unique `(user_id,
  dedupe_key)` constraint. Safe on SQLite (batch mode) and PostgreSQL.

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
