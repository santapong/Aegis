// Client
export { AegisClient, AegisError } from "./client";

// Resource classes
export {
  BudgetResource,
  GoalResource,
  DebtResource,
  SavingsResource,
  BillResource,
  ReportsResource,
  CalendarResource,
  AIResource,
  HistoryResource,
} from "./resources";

// Types
export type {
  // Common
  AegisClientOptions,
  DeleteResponse,
  ErrorResponse,

  // Budget
  BudgetEntry,
  BudgetEntryCreate,
  BudgetEntryUpdate,
  BudgetSummary,
  BudgetCategories,
  BudgetListParams,

  // Goals
  Goal,
  GoalCreate,
  GoalUpdate,
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,

  // Debts
  Debt,
  DebtCreate,
  DebtUpdate,
  DebtSummary,
  PayoffPlan,
  PayoffPlanParams,
  PayoffPlanDebt,
  PayoffPlanPayment,
  PayoffPlanTimelineEntry,

  // Savings
  SavingsJar,
  SavingsJarCreate,
  SavingsJarUpdate,
  SavingsTransaction,
  SavingsSummary,

  // Bills
  BillReminder,
  BillReminderCreate,
  BillReminderUpdate,
  UpcomingBill,
  BillsSummary,

  // Reports
  MonthlyTrendEntry,
  CategoryBreakdownEntry,
  CategoryBreakdown,
  YearlyMonthData,
  YearlySummary,
  NetWorth,

  // Calendar
  CalendarEvent,
  CalendarSummary,

  // AI
  ChatRequest,
  ChatResponse,
  AnalyzeRequest,
  AnalysisEntry,
  ChatMessage,
  ChatSession,
  AIStatus,

  // History
  FinancialSnapshot,
  TimelineEntry,
} from "./types";
