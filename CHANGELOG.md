# Changelog

All notable changes to the Aegis Money Management project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Multi-database support: PostgreSQL, MySQL, and SQLite
- Documents page in frontend with API reference, user guide, and setup instructions
- CHANGELOG.md to track project changes

---

## [0.3.0] - 2026-03-14

### Added
- Complete Aegis frontend overhaul with modern UI component library
  - Reusable UI primitives: Button, Input, Select, Textarea, Modal, Card, Badge, Tabs, Skeleton, EmptyState, PageHeader, DropdownMenu
  - Toast notification system with auto-dismiss and animations
  - Error boundary component
  - Animated progress ring chart component
- Three new frontend pages
  - **Transactions page** — full CRUD with filters, summary cards, responsive table/card layouts
  - **Plans & Goals page** — CRUD with grid/list views, category/status filters, progress rings, inline progress slider
  - **Settings page** — theme selection, currency preferences, about section
- Framer Motion animations throughout all pages (stagger, slide, scale, fade)
- Mobile-responsive sidebar with overlay drawer and hamburger menu
- Notification center with bell icon and unread count
- Dark mode fix (theme now syncs to DOM and persists to localStorage)
- Expanded CSS design tokens (hover, ring, success/danger/warning backgrounds)
- Zustand persist middleware for settings storage

### Changed
- Renamed application from "MoneyAI" to "Aegis"
- Enhanced Dashboard with animated health score ring, skeleton loaders, stagger animations
- Enhanced Budgets page with modal forms (create + edit), delete confirmation, animated progress bars
- Enhanced Calendar page with month transition animations, mobile list view
- Enhanced Gantt page with animated task bars, hover tooltips, mobile card fallback
- Enhanced Reports page with skeleton loading states, stagger animations
- Enhanced AI Panel with slide-in animation, typing indicator, toast on accept
- Enhanced charts with pie active shape, trend reference lines, animations
- Improved API client with `APIError` class for better error handling
- Updated TypeScript types with Notification interface

### Fixed
- Docker best practices for production deployment
  - Multi-stage builds for both frontend and backend
  - Non-root users in all containers
  - Restart policies (`unless-stopped`)
  - Resource limits (memory constraints)
  - Configurable database credentials via environment variables
  - Next.js standalone output for minimal production images
  - Proper container-to-container networking
- Added Node.js/Next.js entries to .gitignore
- Separated development Docker config into `docker-compose.dev.yml`

---

## [0.2.0] - 2026-03-14

### Added
- Financial analysis and reporting features
  - Budget vs actual spending comparison API
  - Budget CRUD endpoints
  - Monthly category comparison reports
  - CSV transaction export
  - Spending anomaly detection (>2x category average)
  - Financial health score (0-100 with A-F grading)
  - Cash flow forecast (6-month projection)
- Budget management frontend page with charts and progress bars
- Reports & Analytics frontend page with date filtering and CSV export
- Dashboard KPI cards, spending charts, and trend charts

### Fixed
- Docker Compose verification fixes for reliable container startup
- Health check configurations for all services

---

## [0.1.0] - 2026-03-14

### Added
- Initial full-stack application scaffold
- **Backend (FastAPI)**
  - Plans/Goals CRUD API with hierarchical sub-plans
  - Transactions CRUD API (income/expense tracking)
  - Calendar events API with drag-drop support
  - Gantt chart tasks API with progress tracking
  - Dashboard summary API
  - AI-powered financial analysis via Claude API
  - PostgreSQL database with SQLAlchemy ORM
  - Pydantic request/response validation
  - CORS middleware configuration
- **Frontend (Next.js 15 + React 19)**
  - Dashboard page with overview
  - Calendar planner page (monthly view)
  - Gantt chart page (timeline visualization)
  - Collapsible sidebar navigation
  - AI advisor floating panel
  - Zustand state management
  - TanStack React Query for data fetching
  - Tailwind CSS styling with light/dark theme variables
- **Infrastructure**
  - Docker Compose with PostgreSQL, FastAPI backend, Next.js frontend
  - Environment configuration via `.env`
  - Health checks for all services
