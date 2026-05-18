# Performance backlog

Tracks performance work from the audit at commit `52b2ffc` that wasn't shipped in PR #30 (the CRITICAL-only pass). Ordered by impact × effort ratio.

The CRITICALs are landed; what's below is **fine today**, breaks at 10k+ users or 100k+ rows.

## 🟡 WARNINGs — fix at scale

### Backend

- [x] **Cache the 4 remaining dashboard endpoints** — `/dashboard/health-score`, `/dashboard/cashflow-forecast`, `/ai/insights`, `/ai/weekly-summary`. ✅ Shipped: all wired into `_DASHBOARD_CACHE_SCOPES` and invalidated on transaction mutation.
- [x] **SQL aggregation pass on the remaining materialize-then-aggregate routes** — ✅ Shipped: `dashboard.health_score` (was 5–14 queries, now 4 aggregate queries), `dashboard.cashflow_forecast` (was all-time scan, now 2 aggregate queries), `ai.weekly_summary` (was 2 full scans + 4 Python loops, now 3 aggregate queries), `reports.category_comparison` (was N month-scans, now 1 GROUP BY). `budgets.budget_comparison` and `ai.get_insights` still on the list — the latter is just cached for now since its logic is complex.
- [x] **`notification_service.evaluate_budget_thresholds` fires on every transaction mutation** — ✅ Shipped: replaced per-budget `.all()` + Python sum with `COALESCE(SUM(amount), 0)` SQL scalar.
- [x] **`/api/reports/export.{csv,pdf}` have no `LIMIT`** — ✅ Shipped: CSV capped at 50k rows (configurable `?limit=`, max 100k), PDF capped at 5k rows.
- [x] **`budgets.budget_comparison`** — ✅ Shipped: replaced `.all()` + Python group with one GROUP BY query (≤ ~30 rows regardless of window size).
- [x] **`ai.get_insights` SQL aggregation** — ✅ Shipped: two aggregate queries with a CASE-based bucket column gives totals + per-category breakdown for both current and prior month in 2 round-trips instead of 2 full scans.
- [x] **CSV import uses pandas** — ✅ Shipped: rewritten with `csv.DictReader` (streaming, constant memory) + helper `_money()` for the bank-export format zoo. pandas removed from `pyproject.toml` entirely (~30 MB cold-start saving); matplotlib keeps numpy as a transitive dep for the PDF chart renderer.
- [x] **Sync handlers share one threadpool** — ✅ Shipped the quick fix: Dockerfile bumped `--workers` from 2 to 4 with a note explaining the DB-pool math at scale. Worker-queue refactor (Celery / Render cron) still in the architectural backlog if you outgrow this.
- [x] **Anomaly detection bounded** — ✅ Shipped: two-step now (one GROUP BY for per-category averages, then a single bounded query for outliers using OR-of-category clauses). Stops loading every expense in a 90-day window for power users.

### Frontend

- [x] **Page-level `useAppStore()` subscription on the dashboard** — ✅ Shipped: dashboard and settings pages now use per-field selectors.
- [x] **Transactions filter object identity** — ✅ Shipped: `queryParams` wrapped in `useMemo`.
- [x] **Manage-tags modal O(tags × txns × txn.tags)** — ✅ Shipped: `tagUsageById` memoized as a `Map<tagId, count>` built once per data refresh; modal reads `O(1)` per tag.
- [x] **Calendar `getEventsForDay` called inside 42-cell day grid per render** — ✅ Shipped: O(events) walk once per `events` change, then `Map<dayKey, CalendarEvent[]>` lookups in render.
- [x] **Anomaly / insight cards re-fire entry stagger animation on every refetch** — ✅ Shipped: gated via `hasMounted` state — `initial={false}` and `duration: 0` after first paint, so refetches snap-in instantly.
- [x] **TrendChart re-mounts the 1 s Recharts entry animation on every refetch** — ✅ Shipped: `isAnimationActive={animate}` where `animate` flips false 1.1 s after first paint.
- [x] **Driver.js (onboarding) and Stripe.js in shared client bundle** — ✅ Verified: driver.js is already `await import("driver.js")` in `onboarding-tour.tsx:75` (only the small CSS file stays static). Stripe.js is NOT in the bundle — the frontend uses Stripe's redirect-checkout flow (`window.location.href = checkout_url`), so no `@stripe/stripe-js` import. Audit was being cautious; both items were already resolved.
- [x] **React Query `staleTime: 30_000` doesn't align with backend cache TTL=60s** — ✅ Shipped: `staleTime: 60_000` + `refetchOnWindowFocus: false` in `providers.tsx`.

### Database

- [x] **`transactions(user_id, category)` index** — ✅ Shipped (v0.9.8 migration).
- [x] **`budgets(user_id, period_start)` composite index** — ✅ Shipped (v0.9.8 migration).
- [x] **`ai_recommendations(user_id, created_at)` composite index** — ✅ Shipped (v0.9.8 migration).
- [ ] **Connection pool math at 2+ Render pods exceeds Neon free tier cap** — drop `db_pool_size` to 5 OR migrate to Neon's pooler endpoint (`-pooler.neon.tech`). *~10 min config change.* Documented in `docs/deployment/vercel-neon.md`.

## 🟠 Architectural concerns — bigger refactors

### ~~`GET /api/dashboard/bundle`~~ ✅ Shipped

`GET /api/dashboard/bundle` returns summary + charts + health-score + cashflow-forecast + anomalies + AI weekly-summary + AI insights in one response. Backend caches the bundle under `dashboard:bundle:<user_id>` (registered in `_GLOBAL_USER_SCOPES` so all mutation routes invalidate it). Frontend dashboard switched from 6 `useQuery` calls to 1. AI bits degrade gracefully to `null` / `[]` when the provider isn't configured.

### Move long-running routes to a worker queue
WeasyPrint PDFs and AI calls share threadpool slots with `/api/health` and auth. A user kicking off a PDF concurrent with an AI analysis can starve the pool for everyone.

- **Win**: predictable latency for the hot path under load
- **Cost**: ~half day for Phase 1 (PDF only via arq + Redis)
- **When**: when 95p latency on `/api/health` starts spiking during peak hours
- **Design doc**: [`docs/design/001-background-worker-queue.md`](design/001-background-worker-queue.md) — picks arq over Celery, defines API surface, lists 10-step implementation plan and open questions for the user

### ~~Single-prefix user cache invalidation~~ ✅ Shipped

Resolved via `backend/app/cache.py:_GLOBAL_USER_SCOPES` + `invalidate_user_all(user_id)`. New cached endpoints register their scope name once at module-load time; every mutation route automatically picks it up. Transactions router was migrated from per-router scope list to the new helper.

### Frontend → React Server Components for dashboard
Even with the 6-endpoint dashboard collapsed, TTFB could be served from a single SSR/edge call.

- **Win**: dashboard renders with data already inlined, no client-side fetch waterfall
- **Cost**: ~1 week — major frontend refactor, need to migrate auth from cookie-attached-to-fetch to cookie-attached-to-RSC-fetch
- **When**: post-launch; only if dashboard TTFB becomes a complaint

### Async SQLAlchemy
All routers are sync `def`. FastAPI dispatches to a threadpool. For DB-heavy reads we could use `asyncpg` + async SQLAlchemy and free the threadpool for CPU-bound work (PDF, AI).

- **Win**: 2–3× more concurrent requests per worker without raising worker count
- **Cost**: ~1 week — every router signature changes, every test changes, fixtures change
- **When**: post-launch; only if synchronous threadpool exhaustion becomes a hard ceiling

## What's NOT on the backlog

Things the audit flagged that we explicitly won't fix:

- **Vercel rewrite latency overhead (~30–80ms RTT)** — acceptable for non-streaming responses. Direct CORS to backend would add complexity for marginal win. Reconsider only if AI streaming moves to SSE.
- **Lucide React tree-shaking** — already optimal, no action.
- **`metadata_json` JSON column on `Payment`** — never queried by key predicate; portable JSON is the right choice. Don't add GIN/JSONB until a query predicate appears.

## Sequencing

If you have 1 day: pick the 5-minute migrations + React Query staleTime + the page-level store-selector fix. Stops the easy bleed.

If you have 1 week: ship the SQL aggregation pass on the 4 remaining dashboard routes + cache them. Solves "the dashboard feels slow as data grows" before you ever feel it.

If you have a sprint: the `dashboard/bundle` endpoint refactor. Sets up scaling for the next year.
