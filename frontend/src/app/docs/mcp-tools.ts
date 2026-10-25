export const mcpTools = [
  {
    "name": "ai_analyze",
    "description": "Ask the Aegis AI advisor to analyze recent spending and return structured recommendations. Optional `question` to focus the analysis.",
    "group": "ai",
    "effect": "provider",
    "source": "backend/app/mcp/tools/ai.py"
  },
  {
    "name": "ai_forecast",
    "description": "Forecast finances N months ahead based on recent history.",
    "group": "ai",
    "effect": "provider",
    "source": "backend/app/mcp/tools/ai.py"
  },
  {
    "name": "ai_recommend",
    "description": "Get general financial recommendations without a specific question.",
    "group": "ai",
    "effect": "provider",
    "source": "backend/app/mcp/tools/ai.py"
  },
  {
    "name": "get_budgets",
    "description": "List the authenticated user's budgets. Filter by category or active=true.",
    "group": "budgets",
    "effect": "read",
    "source": "backend/app/mcp/tools/budgets.py"
  },
  {
    "name": "get_budget_comparison",
    "description": "Compare budgeted amounts vs actual spending for a period. Defaults to month-to-date when no dates are provided.",
    "group": "budgets",
    "effect": "read",
    "source": "backend/app/mcp/tools/budgets.py"
  },
  {
    "name": "create_budget",
    "description": "Create a new budget. Use trip_id to attach a budget line to a trip.",
    "group": "budgets",
    "effect": "write",
    "source": "backend/app/mcp/tools/budgets.py"
  },
  {
    "name": "update_budget",
    "description": "Update an existing budget. Pass budget_id plus the fields to change.",
    "group": "budgets",
    "effect": "write",
    "source": "backend/app/mcp/tools/budgets.py"
  },
  {
    "name": "get_plans",
    "description": "List the user's financial plans. Filter by status (planned/in_progress/completed/cancelled).",
    "group": "plans",
    "effect": "read",
    "source": "backend/app/mcp/tools/plans.py"
  },
  {
    "name": "create_plan",
    "description": "Create a new financial plan.",
    "group": "plans",
    "effect": "write",
    "source": "backend/app/mcp/tools/plans.py"
  },
  {
    "name": "update_plan",
    "description": "Update an existing plan. Pass plan_id plus the fields to change.",
    "group": "plans",
    "effect": "write",
    "source": "backend/app/mcp/tools/plans.py"
  },
  {
    "name": "get_dashboard",
    "description": "Return a quick financial dashboard for the period (week/month/year): income, expenses, net, savings rate, and spending by category.",
    "group": "reports",
    "effect": "read",
    "source": "backend/app/mcp/tools/reports.py"
  },
  {
    "name": "list_transactions",
    "description": "List the authenticated user's transactions, with optional filters (type, category, date range, trip, free-text). Returns JSON array.",
    "group": "transactions",
    "effect": "read",
    "source": "backend/app/mcp/tools/transactions.py"
  },
  {
    "name": "create_transaction",
    "description": "Create a new transaction for the authenticated user. Triggers budget-overrun notifications when the affected budget crosses 80% or 100% of its cap.",
    "group": "transactions",
    "effect": "write",
    "source": "backend/app/mcp/tools/transactions.py"
  },
  {
    "name": "update_transaction",
    "description": "Update an existing transaction (the 'correct useful data' loop). Pass the transaction_id plus only the fields you want to change. Re-evaluates budget thresholds after the change.",
    "group": "transactions",
    "effect": "write",
    "source": "backend/app/mcp/tools/transactions.py"
  },
  {
    "name": "list_trips",
    "description": "List the user's trips. Filter by status (planned/active/completed).",
    "group": "trips",
    "effect": "read",
    "source": "backend/app/mcp/tools/trips.py"
  },
  {
    "name": "create_trip",
    "description": "Create a new trip. Attach budget lines and transactions to it via trip_id on create_budget / create_transaction for rolled-up trip spending.",
    "group": "trips",
    "effect": "write",
    "source": "backend/app/mcp/tools/trips.py"
  },
  {
    "name": "update_trip",
    "description": "Update an existing trip. Pass trip_id plus the fields to change.",
    "group": "trips",
    "effect": "write",
    "source": "backend/app/mcp/tools/trips.py"
  },
  {
    "name": "get_trip_summary",
    "description": "Return a rolled-up summary for one trip: total budgeted, total spent, per-category breakdown, and linked transaction count.",
    "group": "trips",
    "effect": "read",
    "source": "backend/app/mcp/tools/trips.py"
  }
] as const;
