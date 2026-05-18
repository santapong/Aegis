# Performance backlog

Tracks performance work from the audit at commit `52b2ffc` that wasn't shipped in PR #30 (the CRITICAL-only pass). Ordered by impact × effort ratio.

The CRITICALs are landed; what's below is **fine today**, breaks at 10k+ users or 100k+ rows.

## 🟡 WARNINGs — fix at scale

### Backend

- [x] **Cache the 4 remaining dashboard endpoints** — `/dashboard/health-score`, `/dashboard/cashflow-forecast`, `/ai/insights`, `/ai/weekly-summary`. ✅ Shipped: all wired into `_DASHBOARD_CACHE_SCOPES` and invalidated on transaction mutation.
- [x] **SQL aggregation pass on the remaining materialize-then-aggregate routes** — ✅ Shipped: `dashboard.health_score` (was 5–14 queries, now 4 aggregate queries), `dashboard.cashflow_forecast` (was all-time scan, now 2 aggregate queries), `ai.weekly_summary` (was 2 full scans + 4 Python loops, now 3 aggregate queries), `reports.category_comparison` (was N month-scans, now 1 GROUP BY). `budgets.budget_comparison` and `ai.get_insights` still on the list — the latter is just cached for now since its logic is complex.
- [x] **`notification_service.evaluate_budget_thresholds` fires on every transaction mutation** — ✅ Shipped: replaced per-budget `.all()` + Python sum with `COALESCE(SUM(amount), 0)` SQL scalar.
- [x] **`/api/reports/export.{csv,pdf}` have no `LIMIT`** — ✅ Shipped: CSV capped at 50k rows (configurable `?limit=`, max 100k), PDF capped at 5k rows.
- [ ] **`budgets.budget_comparison`** — replace `.all()` + Python group with `SELECT category, SUM(amount) GROUP BY category` + budget JOIN. *~30 min.*
- [ ] **`ai.get_insights` SQL aggregation** — currently cached but still scans 60 days into Python on miss. Convert to one GROUP BY giving (this-month, prev-month) category buckets. *~1 hour.*
- [ ] **CSV import uses pandas** — `transactions.py:295`. Stdlib `csv.DictReader` is 10× faster and drops a ~30 MB runtime dep at build time. Note: matplotlib still depends on numpy; full pandas removal saves more once PDF generator is also rewritten. *~2 hours.*
- [ ] **Sync handlers share one threadpool** — WeasyPrint PDF (~800 ms CPU) + AI calls (~30 s timeout) on the same pool as `/api/health`. Either move long-running routes to a background queue (Render cron / Celery), or bump `--workers ≥ 4` and the anyio threadpool limit. *~half-day if queue, ~15 min if just `--workers 4`.*
- [x] **Anomaly detection bounded** — ✅ Shipped: two-step now (one GROUP BY for per-category averages, then a single bounded query for outliers using OR-of-category clauses). Stops loading every expense in a 90-day window for power users.

### Frontend

- [x] **Page-level `useAppStore()` subscription on the dashboard** — ✅ Shipped: dashboard and settings pages now use per-field selectors.
- [x] **Transactions filter object identity** — ✅ Shipped: `queryParams` wrapped in `useMemo`.
- [ ] **Manage-tags modal O(tags × txns × txn.tags)** — `transactions/page.tsx:931` runs `transactions?.filter(...some(...))` inside `tags.map()`. Fine at 50 tags / 100 txns; bad at 5k. Memoize a `Map<tagId, count>` once per data refresh.
- [x] **Calendar `getEventsForDay` called inside 42-cell day grid per render** — ✅ Shipped: O(events) walk once per `events` change, then `Map<dayKey, CalendarEvent[]>` lookups in render.
- [ ] **Anomaly / insight cards re-fire entry stagger animation on every refetch** — gate to first mount with `key` + `AnimatePresence`, or drop the stagger.
- [ ] **TrendChart re-mounts the 1 s Recharts entry animation on every refetch** — set `isAnimationActive={false}` after first mount, or stabilize the `data` identity.
- [ ] **Driver.js (onboarding) and Stripe.js in shared client bundle** — dynamic-import inside the wrapper components, gated on first use.
- [x] **React Query `staleTime: 30_000` doesn't align with backend cache TTL=60s** — ✅ Shipped: `staleTime: 60_000` + `refetchOnWindowFocus: false` in `providers.tsx`.

### Database

- [x] **`transactions(user_id, category)` index** — ✅ Shipped (v0.9.8 migration).
- [x] **`budgets(user_id, period_start)` composite index** — ✅ Shipped (v0.9.8 migration).
- [x] **`ai_recommendations(user_id, created_at)` composite index** — ✅ Shipped (v0.9.8 migration).
- [ ] **Connection pool math at 2+ Render pods exceeds Neon free tier cap** — drop `db_pool_size` to 5 OR migrate to Neon's pooler endpoint (`-pooler.neon.tech`). *~10 min config change.* Documented in `docs/deployment/vercel-neon.md`.

## 🟠 Architectural concerns — bigger refactors

### `GET /api/dashboard/bundle`
The dashboard mounts and fires **6 parallel uncached endpoints**: summary, charts, health-score, cashflow-forecast, anomalies, insights. Collapse into one composite endpoint:

- **Win**: 5× fewer roundtrips, one cache key per user, one invalidation on mutations
- **Cost**: ~1 day backend + matching frontend hook refactor
- **When**: before scaling past ~500 concurrent dashboard users

### Move long-running routes to a worker queue
WeasyPrint PDFs and AI calls share threadpool slots with `/api/health` and auth. A user kicking off a PDF concurrent with an AI analysis can starve the pool for everyone.

- **Win**: predictable latency for the hot path under load
- **Cost**: 2–3 days for Celery + Redis + result-polling endpoint, or simpler with Render's cron jobs for batch work
- **When**: when 95p latency on `/api/health` starts spiking during peak hours

### Single-prefix user cache invalidation
Today every mutation route manually lists which scopes to invalidate (`_DASHBOARD_CACHE_SCOPES` in transactions, more to come). As cached endpoints multiply, drift is inevitable.

- **Win**: one `invalidate_user(user_id)` call covers everything
- **Cost**: ~half-day — switch all keys to a single `user:{id}:*` prefix scheme
- **When**: when you add the 6th cached scope

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
