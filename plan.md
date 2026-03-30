# Plan: Analysis & Good-to-Have Features

## Current State
The project has: transaction tracking with tags and recurring support, financial plans/goals, dashboard with KPI cards and insights, calendar, Gantt chart, budget management, reports, AI advisor, savings goals, debt tracker, and CSV import.

---

## Completed Features (v0.2.0)

1. Financial Health Score (0-100 gauge on dashboard)
2. Budget vs Actual Analysis (budgets page)
3. Spending Anomaly Detection (>2x category average)
4. Cash Flow Forecast Chart (6-month projection)
5. Monthly Category Comparison (month-over-month reports)
6. Export to CSV (reports page)

## Completed Features (v0.4.0)

1. Transaction Tags/Labels (multi-tag categorization with CRUD)
2. Recurring Transactions & Subscription Tracker (with monthly cost normalization)
3. CSV/Bank Statement Import (auto-detect column formats, preview before import)
4. Savings Goals with Progress Tracking (CRUD + contributions + progress bars)
5. Debt Payoff Tracker (snowball/avalanche strategies with payoff calculator)
6. Financial Insights & Weekly Summary (auto-generated insights on dashboard)

---

## Future Ideas

### Authentication & Multi-User
- User registration and login (JWT)
- Per-user data isolation
- Shared budgets between users

### Enhanced AI
- WebSocket streaming for real-time AI responses
- Natural language transaction queries
- AI-powered automatic categorization of imported transactions

### Data & Integrations
- Plaid/bank API integration for auto-importing transactions
- Receipt/attachment upload for transactions (image storage)
- Multi-currency support with exchange rate conversion

### UX Improvements
- Onboarding tour for first-time users
- Keyboard shortcuts (N = new plan, / = search)
- Virtual scrolling for large transaction lists
- Push notifications for budget alerts and bill reminders
