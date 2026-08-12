# Aegis — Roadmap

This roadmap reflects the project state as of **v1.4.9** (2026-08-13). See
[CHANGELOG.md](CHANGELOG.md) for the full release history.

Current status: **generally available**.

---

## Release map

![Release map](docs/diagrams/roadmap-release-map.svg)

<sub>Diagram source: [roadmap-release-map.mmd](docs/diagrams/src/roadmap-release-map.mmd)</sub>

| Release | Theme | Status |
|---------|-------|--------|
| v0.1 – v0.6 | Scaffold → auth → multi-db → AI tool_use | ✅ Shipped |
| v0.7.0 | shadcn/ui tokens + smoke tests | ✅ Shipped |
| v0.8.0 | First-run & discoverability | ✅ Shipped |
| v0.9.0 | Scale & export | ✅ Shipped |
| **v1.0.0** | **General availability** | ✅ **Shipped** |
| v1.1.0 | MCP server + Trip entity + budget overrun alerts | ✅ Shipped |
| v1.2.0 | Perf audits + deploy story + market data + budget templates | ✅ Shipped |
| v1.3.0 | UX restraint pass + customizable dashboard widgets | ✅ Shipped |
| v1.4.0–v1.4.9 | Runtime AI configuration + public-site and visual-system refinements | ✅ Shipped |
| v1.5.0 | WebGL2 comet hero Phase 6: stabilization and release validation | 🚧 Unreleased |

---

## Post-v1.2 direction

Captured here for continuity; not scoped.

![Post-v1.2 direction](docs/diagrams/roadmap-post-v1-0-direction.svg)

<sub>Diagram source: [roadmap-post-v1-0-direction.mmd](docs/diagrams/src/roadmap-post-v1-0-direction.mmd)</sub>

### Smart AI & real-time
- ~~Runtime provider/model configuration + usage metering + cost visibility.~~
  ✅ Shipped (unreleased): see [`docs/design/006`](docs/design/006-ai-provider-configuration.md).
- WebSocket streaming for the AI advisor (replace current request/response).
- Natural-language transaction queries ("how much did I spend on food last month?").
- AI auto-categorization of imported CSV rows.
- Tax optimization suggestions based on transaction categories.
- Live dashboard updates when transactions are added from another session.

### Feature expansion
- ~~Investment portfolio (stocks / ETF / crypto) with price feeds.~~ ✅ Shipped: v1.1.0 portfolio + v1.2.0 market data (Finnhub/Binance) + watchlist.
- ~~Budget templates (50/30/20, zero-based) that users can adopt with one click.~~ ✅ Shipped in v1.2.0.
- Multi-currency with daily FX conversion.
- Receipt / attachment upload per transaction (image storage).
- Shared budgets between users (household mode).

### Integrations & data
- Plaid / bank-API auto-import.
- Receipt OCR from uploaded images.
- Email / push notifications (SMTP + Web Push).
- **Outbound webhooks** — generic delivery channel for budget/anomaly/bill events (follow-up to v1.1 MCP work).
- **LINE Messaging API** — push notifications and a chat-driven expense logger. The user-settings token storage this needed now exists: the `user_secrets` table added for the AI provider key is deliberately general, so the LINE token is a new key name rather than a new table (see [`docs/design/006`](docs/design/006-ai-provider-configuration.md), Decision 4). Still needs the background task system.
- **AI auto-categorization with review queue** — the "correct useful data" loop on top of the CSV importer.
- Additional CSV connectors for common Thai / UK / EU banks.
- Postgres `tsvector` + GIN index upgrade for transaction search (replaces the v0.8 `ILIKE` MVP).

### Ops & SRE
- Horizontal scale via async workers (RQ or Celery) for heavy AI / PDF jobs.
- Prometheus `/metrics` endpoint.
- Structured error tracking (Sentry).
- Automated load testing against a seeded demo DB.

### Experience & visual platform

- ✅ WebGL2 comet implementation delivered through Phase 5: renderer and core,
  procedural tail, GPU particles, restrained transparent bloom, and
  fine-pointer parallax. See
  [`docs/design/007`](docs/design/007-webgl-comet-hero.md).
- 🚧 **Phase 6 — stabilization and release validation:** capture stable desktop,
  mobile, and reduced-motion screenshot baselines; profile representative
  integrated-GPU and mobile devices; exercise WebGL context loss/restoration;
  and add adaptive quality only if profiling shows it is necessary.

---

## Architecture snapshot (current)

![Architecture snapshot (current)](docs/diagrams/roadmap-architecture-snapshot-current.svg)

<sub>Hand-authored SVG: [roadmap-architecture-snapshot-current.svg](docs/diagrams/roadmap-architecture-snapshot-current.svg) · conventions in [THEME.md](docs/diagrams/THEME.md)</sub>

## Tech stack

| Layer      | Technology                                                      |
|------------|-----------------------------------------------------------------|
| Backend    | Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic      |
| Database   | SQLite / PostgreSQL 16 / MySQL                                   |
| Auth       | JWT (HS256) + bcrypt                                             |
| AI         | Claude API (`tool_use` structured output)                        |
| Payments   | Stripe test mode                                                 |
| Reports    | WeasyPrint (PDF) + matplotlib + Jinja2                           |
| Frontend   | Next.js 15, React 19, TypeScript, Bun                            |
| Styling    | Tailwind CSS v4, shadcn/ui (Radix primitives)                    |
| State      | Zustand + TanStack React Query v5                                |
| Perf       | `@tanstack/react-virtual`                                        |
| UX         | `driver.js` + `react-hotkeys-hook`                               |
| Charts     | Recharts                                                         |
| DevOps     | Docker Compose, GitHub Actions (GHCR multi-arch release)         |
