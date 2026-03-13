# Money Management Project — Implementation Roadmap

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Bun + Next.js)                 │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Dashboard  │  │ Calendar  │  │   Gantt    │  │ AI Advisor │  │
│  │  Charts   │  │  Planner  │  │   Chart    │  │   Panel    │  │
│  └───────────┘  └───────────┘  └────────────┘  └────────────┘  │
│          Tailwind CSS  •  Recharts  •  DnD Kit  •  Zustand      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST / WebSocket
┌──────────────────────────┴──────────────────────────────────────┐
│                     BACKEND (Python + FastAPI)                   │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Plans API │  │ Finance   │  │   AI       │  │  Auth &    │  │
│  │ (CRUD)    │  │  API      │  │  Engine    │  │  Users     │  │
│  └───────────┘  └───────────┘  └────────────┘  └────────────┘  │
│          SQLAlchemy  •  Pydantic  •  Claude API  •  Pandas      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │   PostgreSQL Database    │
              │  (plans, transactions,   │
              │   budgets, ai_history)   │
              └─────────────────────────┘
```

---

## Phase 1: Foundation & Backend Core (Week 1-2)

### 1.1 Project Setup
- [x] Python project with FastAPI, SQLAlchemy, Pydantic, Pandas
- [ ] Initialize Next.js app with Bun runtime
- [ ] Configure Tailwind CSS v4 + shadcn/ui components
- [ ] Docker Compose for PostgreSQL + backend + frontend
- [ ] Environment config (.env) for API keys, DB connection

### 1.2 Database Schema
```
plans
├── id (UUID)
├── title (str)
├── description (text)
├── category (enum: income, expense, investment, savings)
├── amount (decimal)
├── currency (str)
├── start_date (date)
├── end_date (date)
├── recurrence (enum: once, daily, weekly, monthly, yearly)
├── status (enum: planned, in_progress, completed, cancelled)
├── priority (enum: low, medium, high, critical)
├── progress (int 0-100)
├── color (str)
├── parent_id (UUID, nullable — for sub-tasks)
├── created_at / updated_at (timestamps)

transactions
├── id (UUID)
├── plan_id (UUID, FK)
├── amount (decimal)
├── type (enum: income, expense)
├── category (str)
├── date (date)
├── description (text)
├── created_at (timestamp)

budgets
├── id (UUID)
├── name (str)
├── amount (decimal)
├── spent (decimal)
├── period_start / period_end (date)
├── category (str)

ai_recommendations
├── id (UUID)
├── plan_id (UUID, FK, nullable)
├── recommendation (text)
├── confidence (float 0-1)
├── category (str)
├── action_type (enum: reduce, increase, reallocate, alert)
├── accepted (bool)
├── created_at (timestamp)
```

### 1.3 Backend API Endpoints
```
Plans
  POST   /api/plans              — Create plan
  GET    /api/plans              — List plans (filters: date range, category, status)
  GET    /api/plans/{id}         — Get single plan
  PUT    /api/plans/{id}         — Update plan
  DELETE /api/plans/{id}         — Delete plan
  PATCH  /api/plans/{id}/progress — Update progress

Calendar
  GET    /api/calendar/events    — Get plans as calendar events (month/week/day)
  PUT    /api/calendar/events/{id}/move — Drag-drop reschedule

Gantt
  GET    /api/gantt/tasks        — Get plans as Gantt tasks with dependencies
  PUT    /api/gantt/tasks/{id}   — Update task dates/progress

Transactions
  POST   /api/transactions       — Add transaction
  GET    /api/transactions       — List with filters
  GET    /api/transactions/summary — Aggregated summary

Dashboard
  GET    /api/dashboard/summary  — KPIs: total income, expenses, savings rate
  GET    /api/dashboard/charts   — Chart data (by category, by month, trends)

AI Engine
  POST   /api/ai/analyze         — Analyze spending & plans
  POST   /api/ai/recommend       — Get AI recommendations
  POST   /api/ai/forecast        — Forecast future finances
  GET    /api/ai/history         — Past recommendations
```

---

## Phase 2: Frontend Core (Week 2-3)

### 2.1 Layout & Navigation
- Responsive sidebar navigation (collapsible)
- Dark/light theme toggle
- Top bar with search & notifications
- Breadcrumb navigation

### 2.2 Dashboard Page (`/`)
- **KPI Cards**: Total balance, monthly income, monthly expenses, savings rate
- **Spending by Category**: Donut/pie chart (Recharts)
- **Monthly Trend**: Area chart showing income vs expenses over time
- **Budget Progress**: Horizontal bar charts per budget category
- **Upcoming Plans**: Mini timeline of next 7 days
- **AI Insights Widget**: Latest recommendations with accept/dismiss

### 2.3 Calendar Planner (`/calendar`)
- Monthly / weekly / daily views
- Color-coded events by category (income=green, expense=red, etc.)
- Drag-and-drop to reschedule plans
- Click to create / edit plan modal
- Filter by category, status, priority
- Library: `@schedule-x/react` or custom with `date-fns`

### 2.4 Gantt Chart (`/gantt`)
- Horizontal timeline with draggable task bars
- Nested sub-tasks (parent-child hierarchy)
- Progress overlay on each bar
- Zoom levels: day / week / month / quarter
- Dependencies (arrows between tasks)
- Library: `gantt-task-react` or custom SVG-based
- Color by status / priority

### 2.5 Summary Charts (`/reports`)
- Date range picker
- Income vs Expense bar chart
- Category breakdown (stacked bar)
- Savings rate over time (line chart)
- Plan completion rate (progress chart)
- Export to PDF / CSV

---

## Phase 3: AI Decision Engine (Week 3-4)

### 3.1 AI Integration (Claude API)
- **Spending Analysis**: Analyze transaction patterns, detect anomalies
- **Budget Recommendations**: Suggest budget adjustments based on trends
- **Plan Optimization**: Recommend rescheduling or prioritizing plans
- **Forecasting**: Predict future balances based on recurring plans
- **Natural Language Query**: "How much did I spend on food last month?"

### 3.2 AI Features in UI
- Floating AI chat panel (slide-in from right)
- Inline recommendations on dashboard cards
- AI-generated plan suggestions
- Confidence scores on each recommendation
- Accept / dismiss / ask follow-up actions

### 3.3 AI Decision Flow
```
User data (plans + transactions + budgets)
        │
        ▼
   Preprocessing (Pandas aggregation)
        │
        ▼
   Prompt Construction (context + question)
        │
        ▼
   Claude API Call (structured JSON response)
        │
        ▼
   Parse & Store Recommendation
        │
        ▼
   Display in UI with confidence + actions
```

---

## Phase 4: Polish & Performance (Week 4-5)

### 4.1 Performance
- Server-side rendering (Next.js SSR) for initial page loads
- React Query / SWR for client-side data fetching + caching
- Virtual scrolling for large transaction lists
- Debounced search & filters
- WebSocket for real-time AI response streaming

### 4.2 UX Polish
- Skeleton loading states
- Toast notifications for actions
- Keyboard shortcuts (N = new plan, / = search)
- Responsive mobile layout
- Smooth animations (Framer Motion)
- Onboarding tour for first-time users

### 4.3 Data & Security
- Input validation (Zod on frontend, Pydantic on backend)
- Rate limiting on AI endpoints
- CORS configuration
- Environment-based config (dev / staging / prod)

---

## Tech Stack Summary

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Runtime     | Bun (frontend), Python 3.11+ (backend)         |
| Frontend    | Next.js 15, React 19, TypeScript               |
| Styling     | Tailwind CSS v4, shadcn/ui                      |
| Charts      | Recharts (summary), custom SVG (Gantt)          |
| Calendar    | Custom with date-fns or @schedule-x/react       |
| State       | Zustand + React Query                           |
| Backend     | FastAPI, SQLAlchemy 2.0, Pydantic v2            |
| Database    | PostgreSQL 16                                   |
| AI          | Claude API (Anthropic SDK)                      |
| Data        | Pandas, NumPy (aggregation & analysis)          |
| DevOps      | Docker Compose, GitHub Actions CI               |

---

## Directory Structure

```
money-management-project/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Settings & env
│   │   ├── database.py             # SQLAlchemy setup
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── plan.py
│   │   │   ├── transaction.py
│   │   │   ├── budget.py
│   │   │   └── ai_recommendation.py
│   │   ├── schemas/                # Pydantic schemas
│   │   │   ├── plan.py
│   │   │   ├── transaction.py
│   │   │   └── dashboard.py
│   │   ├── routers/                # API route handlers
│   │   │   ├── plans.py
│   │   │   ├── calendar.py
│   │   │   ├── gantt.py
│   │   │   ├── transactions.py
│   │   │   ├── dashboard.py
│   │   │   └── ai.py
│   │   └── services/               # Business logic
│   │       ├── ai_engine.py
│   │       ├── analytics.py
│   │       └── forecast.py
│   ├── alembic/                    # DB migrations
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx            # Dashboard
│   │   │   ├── calendar/page.tsx
│   │   │   ├── gantt/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── api/               # Next.js API routes (proxy)
│   │   ├── components/
│   │   │   ├── ui/                # shadcn components
│   │   │   ├── dashboard/
│   │   │   ├── calendar/
│   │   │   ├── gantt/
│   │   │   ├── charts/
│   │   │   └── ai/
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── lib/                   # Utilities
│   │   ├── stores/                # Zustand stores
│   │   └── types/                 # TypeScript types
│   ├── package.json
│   ├── bun.lockb
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── ROADMAP.md
└── README.md
```
