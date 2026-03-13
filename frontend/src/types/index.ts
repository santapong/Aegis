export type PlanCategory = "income" | "expense" | "investment" | "savings";
export type PlanStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type Recurrence = "once" | "daily" | "weekly" | "monthly" | "yearly";
export type Priority = "low" | "medium" | "high" | "critical";
export type TransactionType = "income" | "expense";
export type ActionType = "reduce" | "increase" | "reallocate" | "alert";

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

export interface Transaction {
  id: string;
  plan_id: string | null;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string | null;
  created_at: string;
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
