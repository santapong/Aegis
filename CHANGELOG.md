# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-03-17

### Added
- **Debt Tracker**: Full CRUD for debts with interest rates, payoff progress bars, and payoff planner supporting Avalanche and Snowball strategies with extra payment simulations.
- **Savings Jars**: Visual savings goals with fill-level indicators, deposit/withdraw actions, auto-save configuration, and deadline countdowns.
- **Reports & Analytics**: Monthly income vs expense trend bar charts (CSS-only), category spending donut chart (conic-gradient), yearly summary tables, and net worth tracking.
- **Bill Reminders**: Upcoming bill tracking with overdue alerts, mark-as-paid flow with auto-advancing due dates, frequency management (monthly/quarterly/yearly).
- **Premium fintech UI design system**: CSS custom properties for accent gradients, glow effects, card depth, `financial-number` tabular-nums utility, `card-premium`/`btn-premium`/`input-premium` component classes, shimmer and glow-pulse animations, custom scrollbar.
- **Sidebar navigation overhaul**: Grouped sections (Overview, Planning, Features), gradient active indicator bar, branded logo mark, user avatar placeholder.
- Backend models: `Debt`, `SavingsJar`, `BillReminder`.
- Backend routes: `debt.py`, `savings.py`, `reports.py`, `bills.py` with full CRUD + specialized endpoints.
- Net worth calculation endpoint aggregating savings, goals, and debts.

## [0.2.0] - 2026-03-17

### Added
- **Dashboard**: Financial overview with summary cards, goal progress bars, upcoming milestones, and quick stats.
- **Budget Tracker**: Income/expense CRUD with monthly summaries, savings rate, category breakdowns (CSS bar charts), recurring entry support, date filtering.
- **Calendar**: Monthly grid view with event pills, recurring entry projections, quick-add to any day, upcoming payments sidebar.
- **Sidebar navigation** component with active state highlighting.
- Backend route: `budget.py` with CRUD, summary, and categories endpoints.
- Backend route: `calendar.py` with event listing and recurring projection engine.
- Database model: `BudgetEntry` with recurring support.
- Updated root layout with sidebar + content flex structure.

## [0.1.0] - 2026-03-14

### Added
- Initial project structure scaffolding for Aegis Autonomous Wealth OS.
- Setup core architectural folders (backend, frontend, ai_engine, infrastructure).
- Gantt chart page with goals and milestones CRUD.
- PostgreSQL and Kafka Docker Compose infrastructure.
- Stubs for LangChain Agent, LSTM forecasting model, and Mojo/Rust compute layer.
- Placeholder for Kafka, PostgreSQL, and Kubernetes deployments.
- Created `start.sh` cross-platform script to initialize the ecosystem.
