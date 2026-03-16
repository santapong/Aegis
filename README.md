# Aegis - Autonomous Wealth OS

AI-driven financial operating system for automated wealth management.

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, TypeScript 5
- **Backend**: Python (Litestar), SQLAlchemy, Pydantic
- **Database**: PostgreSQL 15
- **Infrastructure**: Docker Compose, Kafka, Zookeeper

## Features

### Dashboard
Central overview with financial goals summary, progress tracking, and upcoming milestones.

### Budget Tracker
Track income and expenses by category with monthly summaries, savings rate, and category breakdowns.

### Calendar
Monthly calendar view with scheduled payments, recurring entry projections, and quick-add functionality.

### Gantt Chart
Goal-oriented financial timeline with milestones, progress bars, and date range visualization.

### Debt Tracker
Track loans and credit cards with interest rates, payoff progress, and a payoff planner supporting **Avalanche** and **Snowball** strategies with custom extra payment simulations.

### Savings Jars
Visual savings goals with fill-level indicators, deposit/withdraw actions, auto-save configuration, and deadline countdowns.

### Reports & Analytics
Monthly income vs expense trend charts, category spending donut chart, yearly summary tables, and net worth tracking.

### Bill Reminders
Upcoming bill tracking with overdue alerts, mark-as-paid flow (auto-advances due dates), frequency management, and payment status indicators.

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 22+ (or Bun)
- uv (Python package manager)

### Quick Start

```bash
# 1. Start infrastructure (PostgreSQL, Kafka)
cd infrastructure && docker-compose up -d && cd ..

# 2. Install & start backend (port 8000)
source .venv/bin/activate
uv sync
export PYTHONPATH=$(pwd)/backend/src:$PYTHONPATH
uvicorn main:app --app-dir backend/src --host 0.0.0.0 --port 8000 --reload

# 3. Install & start frontend (port 3000)
cd frontend && npm install && npm run dev
```

Or use the automated script:

```bash
./start.sh
```

### Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **PostgreSQL**: localhost:5433

## API Endpoints

| Module | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Goals | `/api/goals` | CRUD, milestones |
| Budget | `/api/budget` | CRUD, summary, categories |
| Calendar | `/api/calendar` | events, summary |
| Debts | `/api/debts` | CRUD, summary, payoff-plan |
| Savings | `/api/savings` | CRUD, deposit, withdraw, summary |
| Bills | `/api/bills` | CRUD, pay, upcoming, summary |
| Reports | `/api/reports` | monthly-trend, category-breakdown, yearly-summary, net-worth |

## Project Structure

```
backend/src/
  database/       # SQLAlchemy models & connection
  routes/          # Litestar API controllers
  core/            # Currency converter
  automation/      # Headless banking (stub)

frontend/app/
  components/      # Sidebar navigation
  budget/          # Budget tracker page
  calendar/        # Calendar page
  gantt/           # Gantt chart page
  debt/            # Debt tracker page
  savings/         # Savings jars page
  reports/         # Reports & analytics page
  bills/           # Bill reminders page
```
