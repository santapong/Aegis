# Changelog

All notable changes to the Aegis Money Management project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Landing-page WebGL comet Phase 1: a dependency-free WebGL2 renderer with a
  transparent canvas, moving comet core, responsive DPR, hidden-tab pause,
  resource cleanup, and a graceful fallback when WebGL2 is unavailable.
- Landing-page WebGL comet Phase 2: a responsive procedural plasma tail with
  shader-driven flow, curvature, taper, layered filaments, and reduced-motion
  behavior.
- Landing-page WebGL comet Phase 3: a GPU-driven energy-particle layer with
  responsive density, soft point sprites, tail-aware motion, and no per-frame
  buffer uploads.
- Landing-page WebGL comet Phase 4: a restrained transparent bloom pipeline
  using highlight extraction, reduced-resolution separable blur, and
  premultiplied-alpha compositing.
- Landing-page WebGL comet Phase 5: fine-pointer parallax with bounded,
  frame-rate-independent smoothing and reduced-motion/coarse-pointer fallbacks.
- Landing-page WebGL comet Phase 6 depth pass: a procedurally shaded volumetric
  core, orbital head loop, instanced spline-like energy strands, cloud/wisp
  density breakup, and depth-tiered motes derived from the supplied concept art.
- Landing-page WebGL comet Phase 6 stabilization: automatic WebGL context-loss
  recovery, deterministic screenshot states, and development-only frame-pacing
  diagnostics exposed on the canvas for repeatable validation.
- Landing-page WebGL comet Phase 7: a one-shot upper-left-to-right-center
  cinematic arrival that settles into the reference composition, with one
  shared rotated pose across the core, tail, strands, and particles plus subtle
  post-arrival breathing and an immediate settled reduced-motion state.
- Landing-page WebGL comet Phase 8: scroll-scrubbed flight inside a sticky hero
  scene, plus a reference-proportion pass with a smaller star core, layered
  orbital loops, a longer S-curved plasma ribbon, finer strands, and denser
  energy dust. Internal plasma remains time-driven while translation follows
  the visitor; reduced motion stays on the composed final frame.

## [1.4.9] - 2026-08-12

### Changed

- Landing hero and auth-page backgrounds now use a comet field
  (`CometGL`) instead of the rising-embers effect — seven comets with
  fading tails, alternating redshift/blueshift, arcing on looping
  parabolic paths.

## [1.4.8] - 2026-08-12

### Added

- New favicon and app icon (gravitational-lensing ring mark) via
  Next.js's file-based icon convention.

## [1.4.7] - 2026-08-12

### Added

- `/changelog`: public page rendering `CHANGELOG.md` (Keep a Changelog
  format) as release cards.

### Changed

- Landing nav trimmed to Docs + Changelog + Sign in/Get started —
  the old Product/Pricing links pointed nowhere real.
- `/docs` is reachable without login (still gets the full app shell
  when signed in via a new `OPEN_APP_PAGES` category in `AuthGate`).
- Landing hero and auth-page backgrounds now share one warm,
  organic "rising embers" WebGL animation (`GrowthGL`) instead of two
  unrelated concepts (Meridian terrain grid, Pulse orbit rings).

## [1.4.6] - 2026-08-12

### Fixed

- `/landing` title rendered doubled ("Aegis — ... — Aegis") because the
  root layout's title template appended onto the page's own title
  string. Landing now sets an absolute title.

## [1.4.5] - 2026-08-12

### Added

- SEO/GEO basics for the public landing page: `robots.txt` and
  `sitemap.xml` route handlers, per-page metadata (title, description,
  canonical, Open Graph, Twitter card) on `/landing`, and
  `SoftwareApplication` JSON-LD for AI answer engines. Root layout
  metadata now defaults to `noindex` since `/` is the login-gated app
  shell; `/landing` overrides it back to indexable. Site URL is
  configurable via `NEXT_PUBLIC_SITE_URL`.

## [1.4.4] - 2026-08-10

### Fixed

- Vercel: the `/api/:path*` rewrite does not match trailing-slash URLs,
  so every collection endpoint (`/api/transactions/`, `/api/budgets/`,
  ...) fell through to the frontend and returned Next's 404 — data
  pages silently rendered empty states. An explicit `/api/:path*/`
  rewrite now routes them to the backend.

## [1.4.3] - 2026-08-10

### Changed

- Signed-out visitors to the app root now land on `/landing` instead of
  the sign-in page; deep links to specific app pages still redirect to
  sign-in.

## [1.4.2] - 2026-08-10

### Changed

- The landing page's seed-credentials line now renders only in
  development builds; production no longer advertises the demo login.

## [1.4.1] - 2026-08-10

### Fixed

- `backend/uv.lock` was stale against `pyproject.toml` and missing
  `google-auth`, crashing every backend function on Vercel
  (`ModuleNotFoundError: No module named 'google'`) when built from a
  clean checkout. Re-locked.

## [1.4.0] - 2026-08-10

### Changed — Meridian/Pulse redesign (from the claude.ai/design systems)

- **Landing page rebuilt on the Meridian design system** — near-black ground,
  bone ink, amber/teal accents, Syne display type, a dependency-free WebGL
  wireframe-terrain hero (scroll-bound, pointer parallax, static under
  `prefers-reduced-motion`), numbered feature folds, a hairline capability
  table, and once-only intersection reveals.
- **`theme-meridian` is the new default app theme**; `theme-pulse` (data
  console: graphite tiles, one fuchsia chroma) added as an option. Both appear
  in Settings. Auth pages gained a theme-aware WebGL particle-orbit backdrop.
- **Theming bugfix:** the shadcn alias variables were computed once on `:root`
  against the Observatory palette, so theme switches silently kept Observatory
  colors in aliased surfaces; aliases are now re-declared under every theme
  class.
- **Token sweep:** all raw Tailwind green/red classes app-wide became
  `--ok`/`--bad`/`--accent` tokens; every page shows its sidebar code as the
  PageHeader eyebrow; chart palettes use a Meridian ladder; Lucide icons render
  at 1.25px square-capped strokes under Meridian.
- **Chart rendering bugfix:** recharts 2.x entrance animations leave Pie
  sectors and Bar rects unrendered under React 19 — the spending donut and
  budget-vs-actual bars had never drawn; animations disabled.

### Fixed — Vercel services deployment

- `vercel.json` migrated from the removed `experimentalServices` syntax to
  `services` + service-targeted rewrites (including an explicit `/` rewrite —
  `/:path*` does not match the bare root).
- Neon pooler support: pooler detection now matches Neon's current
  `ep-*-pooler.<region-cell>.aws.neon.tech` hosts, and the `statement_timeout`
  startup option is dropped on pooled connections (PgBouncer rejects it).


### Added — operator API key storage (design 006, step 4)

- **`user_secrets` table** (migration `d5e9a37b2c81`) — encrypted per-user
  secrets, keyed by name. Deliberately general rather than an `api_key` column
  on `users`: the AI provider key is the first consumer and the LINE Messaging
  token already on the ROADMAP ("requires user-settings token storage") is the
  designed-for second, so it needs one mechanism and one migration rather than
  two.
- **`GET/PUT/DELETE /api/secrets`** — write-only by design. A stored secret can
  be set, replaced or cleared but never read back; `GET` returns a mask
  (`gsk_…4f2a`) plus a `configured` flag. A row that exists but will not
  decrypt is reported distinctly from an absent one, because the two need
  different fixes.
- **Resolution order is stored secret → env.** An operator who never opens
  Settings keeps their `.env` behaviour untouched, and clearing the stored key
  falls straight back to it.
- **Encryption** uses `SECRETS_ENCRYPTION_KEY` when set, otherwise derives a
  key from `JWT_SECRET_KEY` via HKDF so existing deploys need no new config.
  Rotating `JWT_SECRET_KEY` without setting `SECRETS_ENCRYPTION_KEY` therefore
  makes stored secrets undecryptable — survivable, because resolution falls
  back to `.env` and the key can be re-entered. `cryptography` is now a direct
  dependency rather than relying on `python-jose`'s extras.
- **Settings → Provider API Key card.**

### Fixed — three guardrails around stored credentials

- **Export serializer denylist.** `_ndjson_stream` serializes *every* column of
  whatever model it is handed, so its safety depended on the current endpoint
  list rather than on the serializer. It now drops `encrypted_value`,
  `hashed_password`, `google_subject` and similar by name, so adding a
  `/users.ndjson` endpoint later cannot quietly ship credentials.
- **Log redaction.** Provider SDKs put the failing request into exception
  messages and `_call_tool` logged those verbatim. Provider-key patterns are
  now redacted before logging — an un-redacted line is a durable copy of a
  secret somewhere nobody thinks to scrub.
- **Credential cache invalidation.** Saving or clearing a key clears both the
  `get_settings()` cache and the `lru_cache`d SDK clients, which are keyed on
  the API key and would otherwise keep serving the old credential until the
  process restarted.

### Added — AI usage metering and cost panel (design 006, steps 2-3)

- **`ai_usage` table** (migration `c4d8f26a1b73`) — one row per successful
  provider call, written from `AIEngine._call_tool`. `response.usage` was
  previously discarded, so nothing measured the AI layer at all. Metering
  inherits `_call_tool`'s contract and can never fail the request: a failed
  write is logged, rolled back and dropped, because a missing row beats a 500
  on a call the provider already answered and already billed.
- **`GET /api/ai/usage`** — call counts and token totals per model for a
  window, plus an estimated cost. Token counts are *measured*; cost is
  *derived*, preferring the provider's own published per-token prices and
  falling back to a static table stamped `PRICES_AS_OF`. A model neither
  source prices is reported with its usage and no cost, and named in
  `models_missing_price`, so a short total is visible rather than silent.
- **Settings → AI Usage card** rendering both, with the cost provenance
  stated rather than presented as fact.

### Changed — the model picker now hides models that cannot work

Running step 1 against the live Groq catalog showed 15 models offered of which
only 7 can serve `/api/ai/*`; the rest fail silently into the placeholder
recommendation, since every call pins `tool_choice` to one tool. Two
independent checks are needed — Groq's speech models (`whisper-*`,
`orpheus-*`) publish no `supported_features` so a features-only filter keeps
them, while `groq/compound` and `allam-2-7b` are text-to-text but list no
`tools` so a modality-only filter keeps those. Both are tri-state: only an
explicit `False` disqualifies, so a provider publishing no metadata keeps its
whole catalog.

This also corrects the design doc's claim that no provider API returns
pricing — Groq's model objects carry per-token prices, so a Groq deploy needs
no hand-maintained price table at all.

### Added — AI model picker (design 006, step 1)

- **`GET /api/ai/models`** — lists the models the configured provider
  currently offers, **fetched from the provider** rather than hard-coded, so a
  retired model drops out of the picker instead of 404-ing at request time.
  Cached per provider for an hour via the existing `CACHE_BACKEND`. An
  unreachable provider degrades to `stale: true` plus the model in effect —
  never a 500 and never an empty dropdown — and a failed fetch is deliberately
  *not* cached so the next render retries.
- **`user_preferences.ai_model`** (nullable, migration `b3c7e15d9a24`) — a
  per-user model override. NULL means "use the env default", so a deploy that
  never opens the picker behaves exactly as before. `AIEngine` resolves the
  override at construction and falls back to the env model if the preferences
  read fails, inheriting `_call_tool`'s never-break-the-feature contract.
- **Settings → AI Model card** — a picker driven by the endpoint above, with a
  "use server default" option that clears the override.

### Fixed — two stale strings on the settings page

- `AI Engine` claimed `Claude (Anthropic) + tool_use` unconditionally, which
  was wrong on any Groq or Typhoon deploy. It now reports the live provider
  and model from `GET /api/ai/models`.
- `Version` was a hard-coded `1.0.0` literal while the repo shipped v1.2.0. It
  is now injected from `package.json` at build time via `next.config.ts`, and
  `frontend/package.json` is bumped to `1.3.0` to match the latest tag.

### Added — design doc: AI provider configuration

- **[`docs/design/006-ai-provider-configuration.md`](docs/design/006-ai-provider-configuration.md)**
  — scopes an in-app AI settings surface: a provider/model picker fed by the
  provider's own model list (rather than a hard-coded catalog that goes stale),
  token-usage metering, a cost estimate labelled with the date its prices were
  captured, and operator storage of the provider key. Records that Aegis's
  deployment posture is **single-operator self-host** (no subscription tier, no
  `role` field, single-instance deploy recipes), which is what makes an in-app
  key field acceptable. Chooses a general `user_secrets` store over an
  `api_key` column on `User` so the planned LINE Messaging token reuses the
  same mechanism. Design only — no implementation.

  Three defects found while scoping and recorded there for follow-up: the
  Anthropic default in `config.py` is a dated snapshot rather than an alias;
  `AIEngine._call_tool` discards `response.usage`, so nothing meters the AI
  layer; and `settings/page.tsx` hard-codes `Version 1.0.0` and
  `AI Engine: Claude (Anthropic)`, both wrong on a current Groq or Typhoon
  deploy.

### Changed — structural diagrams are now hand-authored SVG

- **The seven C4 diagrams are drawn by hand and no longer generated.** Their
  `.svg` files are now the source and are edited directly; the matching
  `docs/diagrams/src/*.mmd` files are deleted. Affected: the README
  at-a-glance view, the container and component views in
  `docs/architecture.md`, the ROADMAP snapshot, the deployment recipe shape,
  and the analytics CDC pipeline.
- **Why.** Mermaid's `C4Container` / `C4Component` renderer lays shapes on a
  fixed grid and draws relationships as straight lines between shape centres,
  so edges cut through boxes and labels collided. Mermaid `flowchart` fixed
  the crossings but left placement to dagre, with no way to express which
  element a diagram is about. Hand-placed coordinates cost more per diagram
  and buy deliberate composition — the backend view reads top to bottom
  because that is the order a request travels.
- **Own theme, derived from the product.** Dark canvas (`--void: #050810`)
  with the app's cyan accent, matching `frontend/src/app/globals.css`. Roles
  carry colour: cyan containers, green datastores, muted dashed externals.
  Because the canvas is opaque, the diagrams look the same in GitHub's light
  and dark themes. Palette and conventions are in `docs/diagrams/THEME.md`.
- Every structural diagram now carries `role="img"` with `<title>` and a
  plain-English `<desc>` for screen readers.
- The C4 **model** is unchanged — same levels, same roles, same boundaries.
- `scripts/render-diagrams.mjs` still renders the other 49 diagrams (flows,
  sequences, state machines, ER) from `.mmd`. Those keep mermaid's default
  white canvas, so the two families do not yet match visually.

## [1.3.0] - 2026-08-01

### Changed — UX restraint pass

- **Cosmic backdrop confined to marketing routes** — the starfield, grid
  lattice, constellation and black-hole layers now render only on
  `/landing`, `/welcome`, `/login` and `/register`. Data screens sit on a
  plain two-stop gradient with the glow tokens zeroed (`body.route-app`),
  under every theme.
- **Collapsible sidebar clusters** — each nav cluster header toggles its
  group; state persists, System starts collapsed, and the cluster holding
  the active route always stays open.
- **Type scale consolidated** — 15 ad-hoc font sizes merged into a
  documented 9-step scale (see the comment block in `globals.css`);
  chart tick sizes unified at 10px.

### Added

- **Customizable dashboard widgets** — every dashboard section (KPI rail,
  health, anomalies, spending, trend, insights, cashflow) can be hidden
  and reordered via the new **Customize** popover; layout persists and
  resets in one click. Widget ids reconcile against the canonical list so
  future widgets appear automatically.

### Removed

- **Payments (Stripe) page hidden** — sidebar entry and its shortcuts
  (`g>y`, `Ctrl+Shift+8`) removed; the `/payments` route remains for easy
  restore.

### Fixed

- **Worker startup** — arq reads `redis_settings` as an attribute, not a
  callable.
- **Compose defaults** — backend wired to Redis by default; frontend
  standalone build no longer bakes `localhost:8000` into the `/api` proxy.

## [1.2.0] - 2026-07-27

### Added — docs & repo structure

- **C4-model diagrams as committed SVGs** — every inline ` ```mermaid `
  block across the docs (56 diagrams, 25 files) now lives as an editable
  source in `docs/diagrams/src/*.mmd` rendered to a committed
  `docs/diagrams/*.svg` that the markdown embeds. Structural diagrams
  (system overview, backend/frontend component views, deployment recipes,
  CDC pipeline) are rewritten in mermaid C4 syntax (C4Container /
  C4Component / C4Deployment); flows, sequences and state machines stay in
  their native form. `scripts/render-diagrams.mjs` re-renders them (uses
  `npx @mermaid-js/mermaid-cli` + a local Chromium-based browser; no repo
  dependency added).
- **Branch model** — ongoing work lands on `develop`; `main` carries
  tagged releases. The pre-restructure `backend` / `frontend` history is
  preserved under `archive/*` tags.

### Added — features

- **Budget templates (50/30/20, zero-based)** — `/budgets` gains a
  **Use a template** action that creates a full set of category budgets for
  the current month in one click. `GET /api/budgets/templates` returns the
  catalog (each template carries categories + income percentages summing to
  100%); `POST /api/budgets/templates/{key}/adopt` takes a `monthly_income`
  and inserts one `Budget` per category sized at `round(income × pct, 2)`
  for the current period (1st → month-end). Templates allocate only to
  **real Aegis spend categories** (rent, groceries, dining, transport,
  utilities, subscriptions, entertainment, health, shopping, savings), so an
  adopted budget actually tracks spend in `GET /api/budgets/comparison`
  instead of reading $0; 50/30/20 maps onto those categories grouped into
  needs/wants/savings tiers (50/30/20 by tier). Adoption is idempotent at the
  application layer (re-adopting skips categories already present) with **no
  schema change** — a DB unique constraint was considered and rejected because
  it regressed the plain create endpoint + MCP tool and isn't NULL-safe across
  the supported databases (see `docs/design/005-budget-templates.md`,
  Decision 2). Covered by `backend/tests/test_budget_templates.py`.
- **Interactive investments picker** — `/investments` now lets you search
  and pick a stock or cryptocurrency instead of hand-typing
  `EXCHANGE:TICKER` strings. New `GET /api/market/{search,quote,status}`
  endpoints proxy a pluggable market-data service (Finnhub primary +
  keyless Binance fallback, server-side cached); it degrades to crypto-only
  search + manual entry when no `FINNHUB_API_KEY` is set. A debounced
  `SymbolSearch` combobox auto-fills the symbol, shows a TradingView
  preview + live-quote chip ("Use this price"), and supports a `units=0`
  **watchlist** (no migration; excluded from portfolio totals via a
  `units > 0` rollup filter and a `?watchlist` list filter).
- **AI "asking" animation** — the advisor panel's three bouncing dots are
  replaced by a framer-motion **Transmission Orb** with
  idle/listening/thinking/responding states and shimmer skeletons, honoring
  `prefers-reduced-motion`. Zero new dependencies.
- **Design doc** —
  `docs/design/004-ai-animation-and-interactive-investments.md` captures the
  research (data-provider comparison, animation tech) and the spec.

### Added — performance (second audit pass)

- **Recharts code-split on Budgets + Reports** — both pages still
  imported Recharts (and Reports the dashboard chart components)
  statically. Extracted `budget-comparison-chart.tsx` /
  `category-comparison-chart.tsx` behind `next/dynamic`. First Load JS:
  `/budgets` 271→169 kB (−38%), `/reports` 279→164 kB (−41%).
- **AI SDK client reuse** — `AIEngine` built a fresh Anthropic/OpenAI
  client (new connection pool + TLS handshake) per request; now cached
  per credential set via module-level `@lru_cache` factories.
- **SQL aggregation on `trips.trip_summary` and
  `AIEngine._gather_context`** — both loaded full row sets and summed in
  Python; now bounded `GROUP BY` / CASE-bucket aggregate queries, same
  pattern as the first-pass dashboard rewrites.
- **`notifications(user_id, created_at)` index** (v0.9.9 migration) for
  the list endpoint's `ORDER BY created_at DESC`.
- **`uvicorn[standard]`** — uvloop + httptools.
- **In-memory rate limiter GC amortized** — the O(unique-clients) size
  probe ran per request; now every 256th hit.
- **Frontend list polish** — `placeholderData: keepPreviousData` on
  Investments/Plans/Trips/Payments "Load more" queries (no more
  skeleton flash), Payments migrated from `useEffect` fetching to React
  Query, calendar months cached (`staleTime` 5 min), TradingView embeds
  lazy-mount via IntersectionObserver instead of one eager script per
  holding, transactions desktop row memoized against modal-typing
  re-renders.
- **Redis bounded** in compose: `--maxmemory 96mb --maxmemory-policy
  volatile-lru` (TTL'd cache keys evictable; arq queue keys never).
  Compose healthchecks moved to 10–30 s steady-state with
  `start_interval` keeping boot gating fast.

### Fixed

- **Frontend CI jobs failed at setup** — `test.yml` and
  `deploy-vercel.yml` pointed setup-node's npm cache (and `npm ci`) at
  a `package-lock.json` that doesn't exist; the repo uses `bun.lock`.
  Test job now runs on `oven-sh/setup-bun`, deploy job drops the
  pointless cache.
- **`alembic upgrade head` broke on SQLite with alembic ≥1.16** — the
  v0.9.5 tags migration used `if_exists=`/try-except guards that don't
  work under the batch-recreate path; rewritten with inspector-based
  existence checks (also MySQL-portable).
- **`pip install -e backend` failed** ("Multiple top-level packages
  discovered") — setuptools auto-discovery tripped on `app/` +
  `alembic/`; package discovery now pinned to `app*`.
- **ruff/bandit** moved into the `[dev]` extra and installed through the
  cached env instead of fresh `pip install` per CI run.

### Changed — repo layout & default deployment

- **Vercel-first deployment** — root [`vercel.json`](vercel.json) (already
  wired for `experimentalServices`) is now the default. `vercel deploy`
  from the repo root ships both frontend and backend in one platform.
  README Quick Start, `docs/deployment/README.md`, and the cloud-specific
  recipes now lead with Vercel; the previous "Vercel + Render" recipe
  remains as the full-features alternative.
- **Renamed deployment recipes** —
  `docs/deployment/vercel-experimental.md` → `vercel.md` (now the default,
  no longer "experimental" framing), and
  `docs/deployment/vercel-neon.md` → `vercel-render.md` (clearer that
  Render is what makes this recipe different from the all-Vercel default).
- **Removed dead files** — root `main.py` (a leftover `print("Hello…")`
  stub), root `pyproject.toml` (out-of-date duplicate; `aegis-mcp` script
  registration moved to `backend/pyproject.toml`), root `uv.lock` (was
  generated from the dead root pyproject), `DOCKER_VERIFY_PLAN.md` (a
  one-off Docker setup planning artifact), and `plan.md` (redundant with
  ROADMAP / CHANGELOG).
- **MCP server invocation path updated** — `uv run --project ./backend
  aegis-mcp` (was `--project .`). The script registration now lives next
  to the rest of the backend deps in `backend/pyproject.toml`.

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

## [1.1.0] - 2026-05-15

The v1.1 scope (PRs #24–#25). These entries were reconstructed when the
release was tagged retroactively — the work shipped without changelog
entries at the time.

### Added

- **MCP server** (`backend/app/mcp/`) — exposes Aegis to MCP clients via
  `uv run --project ./backend aegis-mcp`: tools for transactions, budgets,
  plans, trips, reports and the AI advisor, with per-user session auth.
- **Trip entity** — trip CRUD with budgets and per-trip transaction
  linking (`/api/trips`, trip summary aggregation, dedicated migration).
- **Budget overrun alerts** — the notification emitter evaluates budget
  thresholds on transaction mutations and raises in-app alerts.
- **Split-schedule salary recurrence** — income recurrence supporting
  split pay schedules.
- **Investment portfolio** — holdings CRUD with TradingView charts
  (`/api/investments`, `/investments` page).
- **User preferences** entity persisting per-user settings.

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
