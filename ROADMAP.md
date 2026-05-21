# Aegis — Roadmap

This roadmap reflects the project state as of **v1.0.0** (2026-04-17). See
[CHANGELOG.md](CHANGELOG.md) for the full release history.

Current status: **generally available**.

---

## Release map

```mermaid
timeline
    title Aegis release timeline
    section Foundation
        v0.1–v0.6 : Scaffold → auth → multi-db → AI tool_use
        v0.7.0    : shadcn/ui tokens + smoke tests
    section Polish
        v0.8.0 : First-run & discoverability
        v0.9.0 : Scale & export
    section GA
        v1.0.0 : General availability (2026-04-17)
    section In progress
        v1.1.0 : MCP server + Trip entity + budget overrun alerts
```

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

```mermaid
mindmap
  root((Post-v1.0))
    Smart AI & real-time
      WebSocket AI streaming
      NL transaction queries
      CSV auto-categorization
      Tax optimization
      Live dashboard updates
    Feature expansion
      Investment portfolio
      Budget templates 50/30/20
      Multi-currency + FX
      Receipt attachments
      Shared budgets
    Integrations & data
      Plaid bank import
      Receipt OCR
      SMTP + Web Push
      Outbound webhooks
      LINE Messaging API
      AI categorization queue
      More CSV connectors
      Postgres tsvector + GIN
    Ops & SRE
      Async workers RQ/Celery
      Prometheus /metrics
      Sentry error tracking
      Automated load testing
```

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

### Ops & SRE
- Horizontal scale via async workers (RQ or Celery) for heavy AI / PDF jobs.
- Prometheus `/metrics` endpoint.
- Structured error tracking (Sentry).
- Automated load testing against a seeded demo DB.

---

## Architecture snapshot (current)

```mermaid
flowchart TB
    subgraph FE["FRONTEND — Next.js 15 / React 19 / Bun"]
        direction LR
        FE1[Landing · Dashboard · Calendar · Gantt · Reports]
        FE2[Transactions · Budgets · Debts · Savings · Plans · Payments]
        FE3[AI Advisor · Onboarding · Command palette · Cheatsheet]
        FE4[Tailwind v4 · shadcn/ui · Recharts · Zustand · React Query v5]
        FE5[react-virtual · react-hotkeys-hook · driver.js]
    end

    subgraph BE["BACKEND — Python 3.11+ / FastAPI"]
        direction LR
        BE1[Auth · Plans · Transactions search · Budgets · Savings]
        BE2[Debts · Payments Stripe · Reports CSV/PDF]
        BE3[Notifications · AI Claude tool_use]
        BE4[SQLAlchemy 2.0 · Alembic · Pydantic v2]
        BE5[WeasyPrint · matplotlib · Jinja2]
    end

    DB[(SQLite / PostgreSQL / MySQL<br/>via DATABASE_URL)]

    FE -- REST / JWT cookie --> BE
    BE --> DB
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
