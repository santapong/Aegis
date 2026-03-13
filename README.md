# Money Management Project

AI-powered financial planning with calendar, Gantt charts, and smart recommendations.

## Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Pandas
- **Frontend**: Next.js 15, React 19, TypeScript, Bun
- **Styling**: Tailwind CSS v4, Recharts
- **AI**: Claude API (Anthropic)
- **Database**: PostgreSQL 16

## Quick Start

### 1. Clone & configure
```bash
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY
```

### 2. Run with Docker Compose
```bash
docker compose up -d
```

### 3. Or run manually

**Backend:**
```bash
cd backend
uv pip install -r pyproject.toml
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
bun install
bun run dev
```

## Features

- **Dashboard** — KPI cards, spending charts, monthly trends
- **Calendar Planner** — Monthly/weekly view, drag-and-drop scheduling
- **Gantt Chart** — Timeline visualization with progress tracking
- **Reports** — Category breakdowns, date-range filtering, export
- **AI Advisor** — Spending analysis, budget recommendations, forecasting

## API Docs

With the backend running: http://localhost:8000/api/docs
