// ─── Budget ──────────────────────────────────────────────────────────────────

export interface BudgetEntry {
  id: number;
  entry_type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  date: string;
  is_recurring: string | null;
  created_at: string | null;
}

export interface BudgetEntryCreate {
  entry_type: "income" | "expense";
  amount: number;
  category: string;
  description?: string | null;
  date: string;
  is_recurring?: string | null;
}

export interface BudgetEntryUpdate {
  entry_type?: "income" | "expense";
  amount?: number;
  category?: string;
  description?: string | null;
  date?: string;
  is_recurring?: string | null;
}

export interface BudgetSummary {
  month: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  income_by_category: Record<string, number>;
  expense_by_category: Record<string, number>;
  entry_count: number;
}

export interface BudgetCategories {
  income: string[];
  expense: string[];
}

export interface BudgetListParams {
  month?: string;
  entry_type?: "income" | "expense";
  category?: string;
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface Milestone {
  id: number;
  goal_id: number;
  name: string;
  target_amount: number | null;
  start_date: string;
  end_date: string;
  status: "pending" | "in_progress" | "completed";
  progress: number;
}

export interface Goal {
  id: number;
  name: string;
  description: string | null;
  target_amount: number | null;
  current_amount: number;
  start_date: string;
  end_date: string;
  color: string;
  status: "active" | "completed" | "paused";
  created_at: string | null;
  milestones: Milestone[];
}

export interface GoalCreate {
  name: string;
  description?: string | null;
  target_amount?: number | null;
  current_amount?: number;
  start_date: string;
  end_date: string;
  color?: string;
}

export interface GoalUpdate {
  name?: string;
  description?: string | null;
  target_amount?: number | null;
  current_amount?: number;
  start_date?: string;
  end_date?: string;
  color?: string;
  status?: "active" | "completed" | "paused";
}

export interface MilestoneCreate {
  goal_id: number;
  name: string;
  target_amount?: number | null;
  start_date: string;
  end_date: string;
}

export interface MilestoneUpdate {
  name?: string;
  target_amount?: number | null;
  start_date?: string;
  end_date?: string;
  status?: "pending" | "in_progress" | "completed";
  progress?: number;
}

// ─── Debts ───────────────────────────────────────────────────────────────────

export interface Debt {
  id: number;
  name: string;
  creditor: string | null;
  principal: number;
  interest_rate: number;
  minimum_payment: number;
  current_balance: number;
  due_day: number | null;
  start_date: string;
  status: "active" | "paid_off" | "deferred";
  color: string;
  created_at: string | null;
}

export interface DebtCreate {
  name: string;
  creditor?: string | null;
  principal: number;
  interest_rate?: number;
  minimum_payment?: number;
  current_balance: number;
  due_day?: number | null;
  start_date: string;
  color?: string;
}

export interface DebtUpdate {
  name?: string;
  creditor?: string | null;
  principal?: number;
  interest_rate?: number;
  minimum_payment?: number;
  current_balance?: number;
  due_day?: number | null;
  start_date?: string;
  color?: string;
}

export interface DebtSummary {
  total_debt: number;
  total_minimum_payment: number;
  weighted_avg_rate: number;
  debt_count: number;
  estimated_payoff_months: number | null;
}

export interface PayoffPlanPayment {
  debt_id: number;
  name: string;
  balance: number;
  payment: number;
  interest: number;
}

export interface PayoffPlanTimelineEntry {
  month: number;
  total_remaining: number;
  payments: PayoffPlanPayment[];
}

export interface PayoffPlanDebt {
  id: number;
  name: string;
  payoff_month: number | null;
}

export interface PayoffPlan {
  strategy: string;
  extra_payment: number;
  total_months: number;
  total_interest_paid: number;
  debts: PayoffPlanDebt[];
  timeline: PayoffPlanTimelineEntry[];
}

export interface PayoffPlanParams {
  strategy?: "avalanche" | "snowball";
  extra?: number;
}

// ─── Savings ─────────────────────────────────────────────────────────────────

export interface SavingsJar {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  icon: string;
  color: string;
  deadline: string | null;
  auto_save_amount: number;
  auto_save_frequency: string | null;
  created_at: string | null;
}

export interface SavingsJarCreate {
  name: string;
  target_amount: number;
  current_amount?: number;
  icon?: string;
  color?: string;
  deadline?: string | null;
  auto_save_amount?: number;
  auto_save_frequency?: string | null;
}

export interface SavingsJarUpdate {
  name?: string;
  target_amount?: number;
  current_amount?: number;
  icon?: string;
  color?: string;
  deadline?: string | null;
  auto_save_amount?: number;
  auto_save_frequency?: string | null;
}

export interface SavingsTransaction {
  amount: number;
}

export interface SavingsSummary {
  total_saved: number;
  total_target: number;
  overall_progress: number;
  jar_count: number;
  nearest_deadline: string | null;
}

// ─── Bills ───────────────────────────────────────────────────────────────────

export interface BillReminder {
  id: number;
  name: string;
  amount: number;
  category: string | null;
  due_day: number;
  frequency: "monthly" | "quarterly" | "yearly";
  is_active: string;
  last_paid_date: string | null;
  next_due_date: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface BillReminderCreate {
  name: string;
  amount: number;
  category?: string | null;
  due_day: number;
  frequency?: string;
  is_active?: string;
  next_due_date?: string | null;
  notes?: string | null;
}

export interface BillReminderUpdate {
  name?: string;
  amount?: number;
  category?: string | null;
  due_day?: number;
  frequency?: string;
  is_active?: string;
  next_due_date?: string | null;
  notes?: string | null;
}

export interface UpcomingBill extends BillReminder {
  is_overdue: boolean;
}

export interface BillsSummary {
  monthly_total: number;
  active_count: number;
  overdue_count: number;
  next_bill: { name: string; next_due_date: string } | null;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface MonthlyTrendEntry {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategoryBreakdownEntry {
  category: string;
  amount: number;
  percentage: number;
}

export interface CategoryBreakdown {
  month: string;
  total: number;
  breakdown: CategoryBreakdownEntry[];
}

export interface YearlyMonthData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface YearlySummary {
  year: number;
  months: YearlyMonthData[];
  total_income: number;
  total_expenses: number;
  total_net: number;
  best_month: YearlyMonthData | null;
  worst_month: YearlyMonthData | null;
}

export interface NetWorth {
  net_worth: number;
  assets: number;
  liabilities: number;
  savings_total: number;
  goals_total: number;
  debt_total: number;
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: number;
  entry_type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  date: string;
  is_recurring: string | null;
  projected: boolean;
}

export interface CalendarSummary {
  month: string;
  actual_entries: number;
  projected_recurring: number;
  total_events: number;
  actual_income: number;
  actual_expense: number;
  projected_income: number;
  projected_expense: number;
  total_income: number;
  total_expense: number;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  session_id?: string | null;
}

export interface ChatResponse {
  session_id: string;
  response: string;
  message_count: number;
}

export interface AnalyzeRequest {
  custom_prompt?: string | null;
}

export interface AnalysisEntry {
  id: number;
  analysis_type: string;
  prompt: string | null;
  response: string;
  financial_summary: string | null;
  model_used: string;
  created_at: string | null;
}

export interface ChatMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string | null;
}

export interface ChatSession {
  session_id: string;
  started_at: string | null;
  last_message_at: string | null;
  message_count: number;
}

export interface AIStatus {
  connected: boolean;
  model: string;
  available_models: string[];
  ollama_url: string;
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface FinancialSnapshot {
  id: number;
  snapshot_date: string | null;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  total_debt: number;
  total_savings: number;
  net_worth: number;
  details: string | null;
  created_at: string | null;
}

export interface TimelineEntry {
  type: "snapshot" | "analysis";
  date: string | null;
  data: Record<string, unknown>;
}

// ─── Common ──────────────────────────────────────────────────────────────────

export interface DeleteResponse {
  message: string;
}

export interface ErrorResponse {
  error: string;
  hint?: string;
}

export interface AegisClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
}
