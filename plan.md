# Plan: Analysis & Good-to-Have Features

## Current State
The project already has: transaction tracking, financial plans/goals, dashboard with KPI cards, calendar, Gantt chart, basic reports, and AI advisor. The budget model exists but isn't fully wired up.

---

## Proposed Features (6 items)

### 1. Financial Health Score (Backend + Frontend)
- Compute a 0-100 "health score" based on: savings rate, budget adherence, expense consistency, income stability
- New endpoint: `GET /api/dashboard/health-score`
- Display as a gauge/radial chart on the dashboard
- Show breakdown of what contributes to the score

### 2. Budget vs Actual Analysis (Backend + Frontend)
- Fully integrate the existing `Budget` model with routes
- New endpoints: CRUD for budgets + `GET /api/budgets/comparison`
- Frontend page `/budgets` showing:
  - Per-category budget bar charts (budget limit vs actual spent)
  - Over-budget warnings highlighted in red
  - Remaining budget percentage

### 3. Spending Anomaly Detection (Backend)
- Detect unusual transactions compared to historical averages
- New endpoint: `GET /api/transactions/anomalies`
- Flag transactions that are >2x the category average
- Show anomalies as alerts on the dashboard

### 4. Cash Flow Forecast Chart (Backend + Frontend)
- Project future cash flow based on recurring plans + historical patterns
- New endpoint: `GET /api/dashboard/cashflow-forecast`
- Line chart showing projected balance over next 3-6 months
- Display on dashboard or reports page

### 5. Monthly Category Comparison (Backend + Frontend)
- Compare spending across months for each category
- New endpoint: `GET /api/reports/category-comparison`
- Grouped bar chart: month-over-month per category
- Show % change from previous month
- Add to the reports page

### 6. Export Reports to CSV (Backend)
- Wire up the existing "Export" button on the reports page
- New endpoint: `GET /api/reports/export?format=csv`
- Export transactions with date range filtering
- Return downloadable CSV file

---

## Implementation Order
1. Budget vs Actual (builds on existing model)
2. Monthly Category Comparison (extends reports)
3. Financial Health Score (new dashboard widget)
4. Cash Flow Forecast (new chart)
5. Spending Anomaly Detection (new alerts)
6. Export to CSV (wires up existing button)

## Files to Create/Modify
- **Backend**: New router `budgets.py`, new endpoints in `dashboard.py`, `reports.py`, `transactions.py`
- **Frontend**: New page `/budgets`, new dashboard components, update reports page
- **Schemas**: New Pydantic schemas for health score, anomalies, forecasts, budget comparison
