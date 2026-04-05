export type PlanCategory = "income" | "expense" | "investment" | "savings";
export type PlanStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type Recurrence = "once" | "daily" | "weekly" | "monthly" | "yearly";
export type Priority = "low" | "medium" | "high" | "critical";
export type TransactionType = "income" | "expense";
export type ActionType = "reduce" | "increase" | "reallocate" | "alert";
export type RecurringInterval = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";
export type DebtType = "credit_card" | "student_loan" | "mortgage" | "car_loan" | "personal_loan" | "medical" | "other";

export interface Plan {
  id: string;
  title: string;
  description: string | null;
  category: PlanCategory;
  amount: number;
  currency: string;
  start_date: string;
  end_date: string | null;
  recurrence: Recurrence;
  status: PlanStatus;
  priority: Priority;
  progress: number;
  color: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  color: string;
  category: PlanCategory;
  status: PlanStatus;
  amount: number;
}

export interface GanttTask {
  id: string;
  title: string;
  start: string;
  end: string;
  progress: number;
  parent_id: string | null;
  color: string;
  priority: Priority;
  status: PlanStatus;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  plan_id: string | null;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string | null;
  created_at: string;
  is_recurring: boolean;
  recurring_interval: RecurringInterval | null;
  next_due_date: string | null;
  tags: Tag[];
}

export interface KPISummary {
  total_balance: number;
  monthly_income: number;
  monthly_expenses: number;
  savings_rate: number;
  active_plans: number;
  completed_plans: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color: string | null;
}

export interface DashboardCharts {
  spending_by_category: ChartDataPoint[];
  monthly_trend: { month: string; income: number; expenses: number }[];
  budget_progress: { name: string; budget: number; spent: number }[];
}

export interface AIRecommendation {
  id: string;
  plan_id: string | null;
  recommendation: string;
  confidence: number;
  category: string;
  action_type: ActionType;
  accepted: boolean;
  created_at: string;
}

export interface AIForecast {
  projected_balance: number;
  projected_income: number;
  projected_expenses: number;
  months_ahead: number;
  insights: string[];
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  spent: number;
  category: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface BudgetComparison {
  category: string;
  budget_amount: number;
  actual_spent: number;
  remaining: number;
  usage_percent: number;
  over_budget: boolean;
}

export interface BudgetComparisonResponse {
  period_start: string;
  period_end: string;
  comparisons: BudgetComparison[];
  total_budgeted: number;
  total_spent: number;
}

export interface HealthScoreBreakdown {
  name: string;
  score: number;
  max_score: number;
  description: string;
}

export interface HealthScoreResponse {
  overall_score: number;
  grade: string;
  breakdown: HealthScoreBreakdown[];
}

export interface CashFlowPoint {
  month: string;
  projected_income: number;
  projected_expenses: number;
  projected_balance: number;
}

export interface CashFlowForecastResponse {
  current_balance: number;
  forecast: CashFlowPoint[];
}

export interface AnomalyItem {
  transaction_id: string;
  date: string;
  category: string;
  amount: number;
  average_for_category: number;
  deviation_ratio: number;
  description: string | null;
}

export interface AnomaliesResponse {
  anomalies: AnomalyItem[];
  total_count: number;
}

export interface CategoryComparisonMonth {
  month: string;
  categories: Record<string, number>;
  changes: Record<string, number | null>;
}

export interface Notification {
  id: string;
  type: "budget_alert" | "anomaly" | "milestone" | "info";
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

// New types for v0.4.0

export interface RecurringTransactionSummary {
  total_monthly_recurring: number;
  recurring_income: number;
  recurring_expenses: number;
  subscriptions: Transaction[];
}

export interface SavingsGoal {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  category: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: string;
  name: string;
  description: string | null;
  balance: number;
  original_balance: number;
  interest_rate: number;
  minimum_payment: number;
  due_date: string | null;
  debt_type: DebtType;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface PayoffStep {
  month: number;
  debt_name: string;
  payment: number;
  remaining_balance: number;
  interest_paid: number;
}

export interface PayoffPlan {
  strategy: string;
  total_months: number;
  total_interest: number;
  total_paid: number;
  monthly_steps: PayoffStep[];
}

export interface WeeklySummary {
  period_start: string;
  period_end: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  income_change_percent: number;
  expense_change_percent: number;
  top_spending_categories: { category: string; amount: number }[];
  transaction_count: number;
}

export interface InsightItem {
  type: "positive" | "warning" | "info";
  title: string;
  message: string;
  metric: string;
}

export interface ImportPreviewRow {
  date: string;
  description: string | null;
  amount: number;
  type: string;
  category: string;
}

export interface ImportPreviewResponse {
  rows: ImportPreviewRow[];
  total_rows: number;
  valid_rows: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// Stripe / Payments

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "cancelled";

export interface Payment {
  id: string;
  stripe_payment_id: string | null;
  stripe_customer_id: string | null;
  stripe_session_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface StripeConfig {
  publishable_key: string;
  mode: string;
  configured: boolean;
}

export interface CheckoutSession {
  session_id: string;
  checkout_url: string;
}
