# Aegis — Roadmap

This roadmap reflects the project state as of **v1.0.0** (2026-04-17). See
[CHANGELOG.md](CHANGELOG.md) for the full release history.

Current status: **generally available**.

---

## Release map

| Release | Theme | Status |
|---------|-------|--------|
| v0.1 – v0.6 | Scaffold → auth → multi-db → AI tool_use | ✅ Shipped |
| v0.7.0 | shadcn/ui tokens + smoke tests | ✅ Shipped |
| v0.8.0 | First-run & discoverability | ✅ Shipped |
| v0.9.0 | Scale & export | ✅ Shipped |
| **v1.0.0** | **General availability** | ✅ **Shipped** |
| v1.1.0 | MCP server + Trip entity + budget overrun alerts | 🚧 In progress |

---

## Post-v1.0 direction

Captured here for continuity; not scoped.

### Smart AI & real-time
- WebSocket streaming for the AI advisor (replace current request/response).
- Natural-language transaction queries ("how much did I spend on food last month?").
- AI auto-categorization of imported CSV rows.
- Tax optimization suggestions based on transaction categories.
- Live dashboard updates when transactions are added from another session.

### Feature expansion
- Investment portfolio (stocks / ETF / crypto) with price feeds.
- Budget templates (50/30/20, zero-based) that users can adopt with one click.
- Multi-currency with daily FX conversion.
- Receipt / attachment upload per transaction (image storage).
- Shared budgets between users (household mode).

### Integrations & data
- Plaid / bank-API auto-import.
- Receipt OCR from uploaded images.
- Email / push notifications (SMTP + Web Push).
- **Outbound webhooks** — generic delivery channel for budget/anomaly/bill events (follow-up to v1.1 MCP work).
- **LINE Messaging API** — push notifications and a chat-driven expense logger (requires user-settings token storage + background task system).
- **AI auto-categorization with review queue** — the "correct useful data" loop on top of the CSV importer.
- Additional CSV connectors for common Thai / UK / EU banks.
- Postgres `tsvector` + GIN index upgrade for transaction search (replaces the v0.8 `ILIKE` MVP).

### Frontend reliability follow-ups (deferred from v1.1 QA pass)
- **Session-expired toast** — surface a "Your session expired, please sign in again" message before the silent redirect (`frontend/src/lib/api.ts:31-42`).
- **Per-route `error.tsx` boundaries** — keep sidebar/status-bar chrome when a query throws.
- **Cross-tab logout propagation** — `storage` event listener on `aegis-auth` so logging out in tab A logs out tab B.
- **Plans progress-slider debounce** — currently fires ~100 requests on a single drag (`frontend/src/app/plans/page.tsx:371-380`).
- **Dashboard query error UI** — surface failures from the six `useQuery` calls instead of blank space (`frontend/src/app/page.tsx:72-100`).
- **Notification store** — stop swallowing sync errors and fix the `unreadCount` off-by-one (`frontend/src/stores/notification-store.ts:19-43`).
- **Settings backend persistence** — replace the "local preferences only" copy with a real `user_preferences` table + endpoint.
- **Tag management UI** — backend supports it; no frontend surface yet.

### Ops & SRE
- Horizontal scale via async workers (RQ or Celery) for heavy AI / PDF jobs.
- Prometheus `/metrics` endpoint.
- Structured error tracking (Sentry).
- Automated load testing against a seeded demo DB.

---

## Architecture snapshot (current)

```
┌─────────────────────────────────────────────────────────────────┐
│                FRONTEND (Next.js 15 + React 19 + Bun)           │
│  Landing • Dashboard • Calendar • Gantt • Reports •              │
│  Transactions • Budgets • Debts • Savings • Plans • Payments •   │
│  AI Advisor • Onboarding tour • Command palette • Cheatsheet     │
│  Tailwind v4 • shadcn/ui • Recharts • Zustand • React Query v5   │
│  @tanstack/react-virtual • react-hotkeys-hook • driver.js        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST / JWT
┌──────────────────────────┴──────────────────────────────────────┐
│                BACKEND (Python 3.11+ + FastAPI)                  │
│  Auth • Plans • Transactions (+search) • Budgets • Savings •     │
│  Debts • Payments (Stripe) • Reports (CSV + PDF) •               │
│  Notifications • AI (Claude tool_use)                            │
│  SQLAlchemy 2.0 • Alembic • Pydantic v2 • Pandas •               │
│  WeasyPrint + matplotlib • Jinja2                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │  SQLite / PostgreSQL /   │
              │  MySQL via DATABASE_URL  │
              └─────────────────────────┘
```

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
