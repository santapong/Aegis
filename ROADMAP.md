# Aegis — Roadmap

This roadmap reflects the project state after **v0.7.0** (2026-04-17). The
original week-by-week scaffold plan that lived here has been archived — every
Phase 1–4 item is shipped. See [CHANGELOG.md](CHANGELOG.md) for release
history.

Current status: **production-ready for beta**.

---

## Release map

| Release | Theme | Target | Status |
|---------|-------|--------|--------|
| v0.8.0 | First-run & discoverability | Next | Planned |
| v0.9.0 | Scale & export | After v0.8 | Planned |
| v1.0.0 | General Availability | After v0.9 | Planned |

---

## v0.8.0 — First-run & discoverability

Help new users find the product's value on day one.

- **Onboarding tour** — first-run walkthrough (dashboard → transactions → budgets → AI advisor). Skippable, re-openable from Settings. Persists `users.onboarded_at`. Library: `driver.js`.
- **Keyboard shortcuts** — `N` (new transaction), `/` (focus search), `?` (cheatsheet), `g d` / `g t` / `g b` (jump to dashboard / transactions / budgets). Library: `react-hotkeys-hook`.
- **Transaction full-text search** — `ILIKE` search across `description`, `category`, `notes`. Global `/` spotlight (command palette) plus in-page search on `/transactions`. Postgres `tsvector` upgrade path deferred.
- **In-app notification center** — server-backed notifications for budget overruns, upcoming recurring bills, goal milestones, and AI anomalies. New `notifications` table with `dedupe_key` unique index. Wires into the existing `notification-center.tsx`.

## v0.9.0 — Scale & export

Make the app feel fast and printable.

- **Virtual scrolling** for large transaction / payment lists. Library: `@tanstack/react-virtual`.
- **Mobile-responsive polish** for Gantt and charts. Tailwind v4 `@container` queries, Recharts responsive mode, `touch-action: pan-x` on Gantt.
- **PDF export of reports** — new `GET /api/reports/export.pdf?start=&end=` using **WeasyPrint** server-side (HTML + print CSS, matplotlib PNG charts). No browser headless dependency.
- **Empty-state / skeleton / 404 polish** — extend existing `empty-state.tsx` + `skeleton.tsx`, add per-route `loading.tsx` to every app page.

## v1.0.0 — General Availability

- Demo seed data (`backend/app/seeds/demo.py`) + `make seed` target.
- Public landing page at `frontend/src/app/(marketing)/page.tsx`.
- GHCR image published on version tag via `.github/workflows/release.yml`.
- Final polish of `README.md`, `/docs`, and `CHANGELOG.md`.

---

## Post-v1.0 backlog

Captured here for continuity; not scoped yet.

- **Smart AI & real-time** — WebSocket streaming for the AI advisor, natural-language transaction queries, AI auto-categorization of imported CSV rows, tax optimization suggestions, live dashboard updates.
- **Feature expansion** — investment portfolio (stocks / ETF / crypto), budget templates (50/30/20, zero-based), multi-currency with FX conversion, receipt / attachment upload, shared budgets between users.
- **Integrations & data** — Plaid / bank API auto-import, receipt OCR, email / push notifications, additional CSV connectors.

---

## Architecture snapshot (current)

```
┌─────────────────────────────────────────────────────────────────┐
│                FRONTEND (Next.js 15 + React 19 + Bun)           │
│  Dashboard • Calendar • Gantt • Reports • Transactions •         │
│  Budgets • Debts • Savings • Plans • Payments • AI Advisor       │
│  Tailwind v4 • shadcn/ui • Recharts • Zustand • React Query v5   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST / JWT
┌──────────────────────────┴──────────────────────────────────────┐
│                BACKEND (Python 3.11+ + FastAPI)                  │
│  Auth • Plans • Transactions • Budgets • Savings • Debts •       │
│  Payments (Stripe) • Reports • AI (Claude tool_use)              │
│  SQLAlchemy 2.0 • Alembic • Pydantic v2 • Pandas                 │
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
| Frontend   | Next.js 15, React 19, TypeScript, Bun                            |
| Styling    | Tailwind CSS v4, shadcn/ui (Radix primitives)                    |
| State      | Zustand + TanStack React Query v5                                |
| Charts     | Recharts                                                         |
| DevOps     | Docker Compose, GitHub Actions                                   |
