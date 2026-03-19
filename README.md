# Aegis - Autonomous Wealth OS

AI-driven financial operating system for automated wealth management, with AI-powered financial analysis using local LLMs.

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4, TypeScript 5
- **Backend**: Python (Litestar), SQLAlchemy, Pydantic
- **Database**: PostgreSQL 15
- **AI Engine**: Ollama + Qwen 2.5 (local LLM for financial analysis)
- **Infrastructure**: Docker Compose, Kafka, Zookeeper
- **SDKs**: Python, TypeScript, Go

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

### AI Financial Advisor
Interactive chat with a local AI model (Qwen via Ollama) that analyzes your financial data and provides personalized advice:
- Full financial health analysis with scoring
- Spending pattern analysis and budget suggestions
- Debt payoff recommendations
- Savings strategy optimization
- Interactive Q&A about your finances

### Financial History & Snapshots
Track your financial progress over time:
- Point-in-time snapshots of net worth, income, expenses, savings rate
- AI analysis history with timestamped recommendations
- Combined timeline view

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 22+ (or Bun)
- uv (Python package manager)
- Ollama (for AI features)

### Quick Start

```bash
# 1. Start infrastructure (PostgreSQL, Kafka, Ollama)
cd infrastructure && docker-compose up -d && cd ..

# 2. Pull the AI model
ollama pull qwen2.5:7b

# 3. Install & start backend (port 8000)
source .venv/bin/activate
uv sync
export PYTHONPATH=$(pwd)/backend/src:$(pwd)/ai_engine:$PYTHONPATH
uvicorn main:app --app-dir backend/src --host 0.0.0.0 --port 8000 --reload

# 4. Install & start frontend (port 3000)
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
- **Ollama**: http://localhost:11434

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
| AI | `/api/ai` | analyze, chat, chat/history, chat/sessions, analyses, status |
| History | `/api/history` | snapshots, timeline |

## Client SDKs

### Python SDK

```bash
cd sdks/python && pip install -e .
```

```python
from aegis_sdk import AegisClient

client = AegisClient("http://localhost:8000")

# Budget operations
entries = client.budget.list(month="2026-03")
summary = client.budget.get_summary(month="2026-03")

# AI chat
response = client.ai.chat("How can I improve my savings rate?")

# Take a financial snapshot
snapshot = client.history.create_snapshot()
```

### TypeScript SDK

```bash
cd sdks/typescript && npm install && npm run build
```

```typescript
import { AegisClient } from "@aegis/sdk";

const client = new AegisClient("http://localhost:8000");

// Budget operations
const entries = await client.budget.list({ month: "2026-03" });
const summary = await client.budget.getSummary("2026-03");

// AI chat
const response = await client.ai.chat("What are my biggest expenses?");

// Take a financial snapshot
const snapshot = await client.history.createSnapshot();
```

### Go SDK

```go
import aegis "github.com/aegis-wealth/aegis-sdk-go"

client := aegis.NewClient("http://localhost:8000")

// Budget operations
entries, _ := client.Budget.List("2026-03", "", "")
summary, _ := client.Budget.Summary("2026-03")

// AI chat
response, _ := client.AI.Chat("How should I manage my debt?", "")

// Take a financial snapshot
snapshot, _ := client.History.CreateSnapshot()
```

## AI Configuration

The AI engine uses Ollama with Qwen by default. Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `AEGIS_AI_MODEL` | `qwen2.5:7b` | Model to use for analysis |

You can use any Ollama-compatible model (e.g., `llama3.1:8b`, `mistral:7b`, `qwen2.5:14b`).

## Project Structure

```
backend/src/
  database/       # SQLAlchemy models & connection
  routes/         # Litestar API controllers (budget, goals, debt, savings, bills, reports, ai, history)
  core/           # Currency converter
  automation/     # Headless banking (stub)

ai_engine/
  agent.py        # Ollama/Qwen advisor agent
  context_builder.py  # Financial data context builder

frontend/app/
  components/     # Sidebar navigation
  budget/         # Budget tracker page
  calendar/       # Calendar page
  gantt/          # Gantt chart page
  debt/           # Debt tracker page
  savings/        # Savings jars page
  reports/        # Reports & analytics page
  bills/          # Bill reminders page
  ai/             # AI advisor chat page
  history/        # Financial history & snapshots page

sdks/
  python/         # Python client SDK (httpx)
  typescript/     # TypeScript client SDK (fetch)
  go/             # Go client SDK (net/http)

infrastructure/
  docker-compose.yml  # PostgreSQL, Kafka, Zookeeper, Ollama
```
