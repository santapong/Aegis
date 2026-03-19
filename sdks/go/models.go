package aegis

// ---------- Budget ----------

// BudgetEntry represents a single income or expense entry.
type BudgetEntry struct {
	ID          int     `json:"id"`
	EntryType   string  `json:"entry_type"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Description *string `json:"description"`
	Date        string  `json:"date"`
	IsRecurring *string `json:"is_recurring"`
	CreatedAt   *string `json:"created_at"`
}

// BudgetEntryCreate is the payload for creating a budget entry.
type BudgetEntryCreate struct {
	EntryType   string  `json:"entry_type"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Description *string `json:"description,omitempty"`
	Date        string  `json:"date"`
	IsRecurring *string `json:"is_recurring,omitempty"`
}

// BudgetEntryUpdate is the payload for updating a budget entry.
type BudgetEntryUpdate struct {
	EntryType   *string  `json:"entry_type,omitempty"`
	Amount      *float64 `json:"amount,omitempty"`
	Category    *string  `json:"category,omitempty"`
	Description *string  `json:"description,omitempty"`
	Date        *string  `json:"date,omitempty"`
	IsRecurring *string  `json:"is_recurring,omitempty"`
}

// BudgetSummary is the response from the budget summary endpoint.
type BudgetSummary struct {
	Month             string             `json:"month"`
	TotalIncome       float64            `json:"total_income"`
	TotalExpenses     float64            `json:"total_expenses"`
	NetSavings        float64            `json:"net_savings"`
	SavingsRate       float64            `json:"savings_rate"`
	IncomeByCategory  map[string]float64 `json:"income_by_category"`
	ExpenseByCategory map[string]float64 `json:"expense_by_category"`
	EntryCount        int                `json:"entry_count"`
}

// BudgetCategories lists available income and expense categories.
type BudgetCategories struct {
	Income  []string `json:"income"`
	Expense []string `json:"expense"`
}

// ---------- Goals ----------

// Goal represents a financial goal.
type Goal struct {
	ID            int         `json:"id"`
	Name          string      `json:"name"`
	Description   *string     `json:"description"`
	TargetAmount  *float64    `json:"target_amount"`
	CurrentAmount float64     `json:"current_amount"`
	StartDate     string      `json:"start_date"`
	EndDate       string      `json:"end_date"`
	Color         string      `json:"color"`
	Status        string      `json:"status"`
	CreatedAt     *string     `json:"created_at"`
	Milestones    []Milestone `json:"milestones"`
}

// GoalCreate is the payload for creating a goal.
type GoalCreate struct {
	Name          string   `json:"name"`
	Description   *string  `json:"description,omitempty"`
	TargetAmount  *float64 `json:"target_amount,omitempty"`
	CurrentAmount float64  `json:"current_amount"`
	StartDate     string   `json:"start_date"`
	EndDate       string   `json:"end_date"`
	Color         string   `json:"color"`
}

// GoalUpdate is the payload for updating a goal.
type GoalUpdate struct {
	Name          *string  `json:"name,omitempty"`
	Description   *string  `json:"description,omitempty"`
	TargetAmount  *float64 `json:"target_amount,omitempty"`
	CurrentAmount *float64 `json:"current_amount,omitempty"`
	StartDate     *string  `json:"start_date,omitempty"`
	EndDate       *string  `json:"end_date,omitempty"`
	Color         *string  `json:"color,omitempty"`
	Status        *string  `json:"status,omitempty"`
}

// ---------- Milestones ----------

// Milestone represents a milestone within a goal.
type Milestone struct {
	ID           int      `json:"id"`
	GoalID       int      `json:"goal_id"`
	Name         string   `json:"name"`
	TargetAmount *float64 `json:"target_amount"`
	StartDate    string   `json:"start_date"`
	EndDate      string   `json:"end_date"`
	Status       string   `json:"status"`
	Progress     float64  `json:"progress"`
}

// MilestoneCreate is the payload for creating a milestone.
type MilestoneCreate struct {
	GoalID       int      `json:"goal_id"`
	Name         string   `json:"name"`
	TargetAmount *float64 `json:"target_amount,omitempty"`
	StartDate    string   `json:"start_date"`
	EndDate      string   `json:"end_date"`
}

// MilestoneUpdate is the payload for updating a milestone.
type MilestoneUpdate struct {
	Name         *string  `json:"name,omitempty"`
	TargetAmount *float64 `json:"target_amount,omitempty"`
	StartDate    *string  `json:"start_date,omitempty"`
	EndDate      *string  `json:"end_date,omitempty"`
	Status       *string  `json:"status,omitempty"`
	Progress     *float64 `json:"progress,omitempty"`
}

// ---------- Debts ----------

// Debt represents a debt entry.
type Debt struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Creditor       *string `json:"creditor"`
	Principal      float64 `json:"principal"`
	InterestRate   float64 `json:"interest_rate"`
	MinimumPayment float64 `json:"minimum_payment"`
	CurrentBalance float64 `json:"current_balance"`
	DueDay         *int    `json:"due_day"`
	StartDate      string  `json:"start_date"`
	Status         string  `json:"status"`
	Color          string  `json:"color"`
	CreatedAt      *string `json:"created_at"`
}

// DebtCreate is the payload for creating a debt.
type DebtCreate struct {
	Name           string  `json:"name"`
	Creditor       *string `json:"creditor,omitempty"`
	Principal      float64 `json:"principal"`
	InterestRate   float64 `json:"interest_rate"`
	MinimumPayment float64 `json:"minimum_payment"`
	CurrentBalance float64 `json:"current_balance"`
	DueDay         *int    `json:"due_day,omitempty"`
	StartDate      string  `json:"start_date"`
	Color          string  `json:"color"`
}

// DebtUpdate is the payload for updating a debt.
type DebtUpdate struct {
	Name           *string  `json:"name,omitempty"`
	Creditor       *string  `json:"creditor,omitempty"`
	Principal      *float64 `json:"principal,omitempty"`
	InterestRate   *float64 `json:"interest_rate,omitempty"`
	MinimumPayment *float64 `json:"minimum_payment,omitempty"`
	CurrentBalance *float64 `json:"current_balance,omitempty"`
	DueDay         *int     `json:"due_day,omitempty"`
	StartDate      *string  `json:"start_date,omitempty"`
	Color          *string  `json:"color,omitempty"`
}

// DebtSummary is the response from the debt summary endpoint.
type DebtSummary struct {
	TotalDebt             float64  `json:"total_debt"`
	TotalMinimumPayment   float64  `json:"total_minimum_payment"`
	WeightedAvgRate       float64  `json:"weighted_avg_rate"`
	DebtCount             int      `json:"debt_count"`
	EstimatedPayoffMonths *float64 `json:"estimated_payoff_months"`
}

// PayoffPlanPayment is a single debt's payment info within a timeline entry.
type PayoffPlanPayment struct {
	DebtID   int     `json:"debt_id"`
	Name     string  `json:"name"`
	Balance  float64 `json:"balance"`
	Payment  float64 `json:"payment"`
	Interest float64 `json:"interest"`
}

// PayoffPlanTimelineEntry is one point in the payoff timeline.
type PayoffPlanTimelineEntry struct {
	Month          int                 `json:"month"`
	TotalRemaining float64             `json:"total_remaining"`
	Payments       []PayoffPlanPayment `json:"payments"`
}

// PayoffPlanDebt summarizes when each debt is paid off.
type PayoffPlanDebt struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	PayoffMonth *int   `json:"payoff_month"`
}

// PayoffPlan is the response from the debt payoff plan endpoint.
type PayoffPlan struct {
	Strategy          string                    `json:"strategy"`
	ExtraPayment      float64                   `json:"extra_payment"`
	TotalMonths       int                       `json:"total_months"`
	TotalInterestPaid float64                   `json:"total_interest_paid"`
	Debts             []PayoffPlanDebt          `json:"debts"`
	Timeline          []PayoffPlanTimelineEntry `json:"timeline"`
}

// ---------- Savings ----------

// SavingsJar represents a savings jar.
type SavingsJar struct {
	ID                int     `json:"id"`
	Name              string  `json:"name"`
	TargetAmount      float64 `json:"target_amount"`
	CurrentAmount     float64 `json:"current_amount"`
	Icon              string  `json:"icon"`
	Color             string  `json:"color"`
	Deadline          *string `json:"deadline"`
	AutoSaveAmount    float64 `json:"auto_save_amount"`
	AutoSaveFrequency *string `json:"auto_save_frequency"`
	CreatedAt         *string `json:"created_at"`
}

// SavingsJarCreate is the payload for creating a savings jar.
type SavingsJarCreate struct {
	Name              string  `json:"name"`
	TargetAmount      float64 `json:"target_amount"`
	CurrentAmount     float64 `json:"current_amount"`
	Icon              string  `json:"icon"`
	Color             string  `json:"color"`
	Deadline          *string `json:"deadline,omitempty"`
	AutoSaveAmount    float64 `json:"auto_save_amount"`
	AutoSaveFrequency *string `json:"auto_save_frequency,omitempty"`
}

// SavingsJarUpdate is the payload for updating a savings jar.
type SavingsJarUpdate struct {
	Name              *string  `json:"name,omitempty"`
	TargetAmount      *float64 `json:"target_amount,omitempty"`
	CurrentAmount     *float64 `json:"current_amount,omitempty"`
	Icon              *string  `json:"icon,omitempty"`
	Color             *string  `json:"color,omitempty"`
	Deadline          *string  `json:"deadline,omitempty"`
	AutoSaveAmount    *float64 `json:"auto_save_amount,omitempty"`
	AutoSaveFrequency *string  `json:"auto_save_frequency,omitempty"`
}

// SavingsTransaction is used for deposit and withdraw operations.
type SavingsTransaction struct {
	Amount float64 `json:"amount"`
}

// SavingsSummary is the response from the savings summary endpoint.
type SavingsSummary struct {
	TotalSaved      float64 `json:"total_saved"`
	TotalTarget     float64 `json:"total_target"`
	OverallProgress float64 `json:"overall_progress"`
	JarCount        int     `json:"jar_count"`
	NearestDeadline *string `json:"nearest_deadline"`
}

// ---------- Bills ----------

// BillReminder represents a bill reminder.
type BillReminder struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	Amount       float64 `json:"amount"`
	Category     *string `json:"category"`
	DueDay       int     `json:"due_day"`
	Frequency    string  `json:"frequency"`
	IsActive     string  `json:"is_active"`
	LastPaidDate *string `json:"last_paid_date"`
	NextDueDate  *string `json:"next_due_date"`
	Notes        *string `json:"notes"`
	CreatedAt    *string `json:"created_at"`
}

// BillReminderCreate is the payload for creating a bill reminder.
type BillReminderCreate struct {
	Name        string  `json:"name"`
	Amount      float64 `json:"amount"`
	Category    *string `json:"category,omitempty"`
	DueDay      int     `json:"due_day"`
	Frequency   string  `json:"frequency"`
	IsActive    string  `json:"is_active"`
	NextDueDate *string `json:"next_due_date,omitempty"`
	Notes       *string `json:"notes,omitempty"`
}

// BillReminderUpdate is the payload for updating a bill reminder.
type BillReminderUpdate struct {
	Name        *string  `json:"name,omitempty"`
	Amount      *float64 `json:"amount,omitempty"`
	Category    *string  `json:"category,omitempty"`
	DueDay      *int     `json:"due_day,omitempty"`
	Frequency   *string  `json:"frequency,omitempty"`
	IsActive    *string  `json:"is_active,omitempty"`
	NextDueDate *string  `json:"next_due_date,omitempty"`
	Notes       *string  `json:"notes,omitempty"`
}

// UpcomingBill extends BillReminder with an overdue indicator.
type UpcomingBill struct {
	BillReminder
	IsOverdue bool `json:"is_overdue"`
}

// BillSummary is the response from the bills summary endpoint.
type BillSummary struct {
	MonthlyTotal float64       `json:"monthly_total"`
	ActiveCount  int           `json:"active_count"`
	OverdueCount int           `json:"overdue_count"`
	NextBill     *NextBillInfo `json:"next_bill"`
}

// NextBillInfo holds the next upcoming bill details.
type NextBillInfo struct {
	Name        string `json:"name"`
	NextDueDate string `json:"next_due_date"`
}

// ---------- Reports ----------

// MonthlyTrend is one data point in the monthly trend report.
type MonthlyTrend struct {
	Month    string  `json:"month"`
	Income   float64 `json:"income"`
	Expenses float64 `json:"expenses"`
	Net      float64 `json:"net"`
}

// CategoryBreakdownItem is one category in the breakdown report.
type CategoryBreakdownItem struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
}

// CategoryBreakdown is the response from the category breakdown endpoint.
type CategoryBreakdown struct {
	Month     string                  `json:"month"`
	Total     float64                 `json:"total"`
	Breakdown []CategoryBreakdownItem `json:"breakdown"`
}

// YearlySummary is the response from the yearly summary endpoint.
type YearlySummary struct {
	Year          int            `json:"year"`
	Months        []MonthlyTrend `json:"months"`
	TotalIncome   float64        `json:"total_income"`
	TotalExpenses float64        `json:"total_expenses"`
	TotalNet      float64        `json:"total_net"`
	BestMonth     *MonthlyTrend  `json:"best_month"`
	WorstMonth    *MonthlyTrend  `json:"worst_month"`
}

// NetWorth is the response from the net worth endpoint.
type NetWorth struct {
	NetWorth     float64 `json:"net_worth"`
	Assets       float64 `json:"assets"`
	Liabilities  float64 `json:"liabilities"`
	SavingsTotal float64 `json:"savings_total"`
	GoalsTotal   float64 `json:"goals_total"`
	DebtTotal    float64 `json:"debt_total"`
}

// ---------- Calendar ----------

// CalendarEvent represents a calendar event entry.
type CalendarEvent struct {
	ID          int     `json:"id"`
	EntryType   string  `json:"entry_type"`
	Amount      float64 `json:"amount"`
	Category    string  `json:"category"`
	Description *string `json:"description"`
	Date        string  `json:"date"`
	IsRecurring *string `json:"is_recurring"`
	Projected   bool    `json:"projected"`
}

// CalendarSummary is the response from the calendar summary endpoint.
type CalendarSummary struct {
	Month              string  `json:"month"`
	ActualEntries      int     `json:"actual_entries"`
	ProjectedRecurring int     `json:"projected_recurring"`
	TotalEvents        int     `json:"total_events"`
	ActualIncome       float64 `json:"actual_income"`
	ActualExpense      float64 `json:"actual_expense"`
	ProjectedIncome    float64 `json:"projected_income"`
	ProjectedExpense   float64 `json:"projected_expense"`
	TotalIncome        float64 `json:"total_income"`
	TotalExpense       float64 `json:"total_expense"`
}

// ---------- AI ----------

// AnalyzeRequest is the payload for the AI analyze endpoint.
type AnalyzeRequest struct {
	CustomPrompt *string `json:"custom_prompt,omitempty"`
}

// ChatRequest is the payload for the AI chat endpoint.
type ChatRequest struct {
	Message   string  `json:"message"`
	SessionID *string `json:"session_id,omitempty"`
}

// AnalysisHistory represents a past AI analysis.
type AnalysisHistory struct {
	ID               int     `json:"id"`
	AnalysisType     string  `json:"analysis_type"`
	Prompt           *string `json:"prompt"`
	Response         string  `json:"response"`
	FinancialSummary *string `json:"financial_summary"`
	ModelUsed        string  `json:"model_used"`
	CreatedAt        *string `json:"created_at"`
}

// ChatMessage represents a single chat message.
type ChatMessage struct {
	ID        int     `json:"id"`
	SessionID string  `json:"session_id"`
	Role      string  `json:"role"`
	Content   string  `json:"content"`
	CreatedAt *string `json:"created_at"`
}

// ChatResponse is the response from the AI chat endpoint.
type ChatResponse struct {
	SessionID    string `json:"session_id"`
	Response     string `json:"response"`
	MessageCount int    `json:"message_count"`
}

// ChatSession represents a chat session summary.
type ChatSession struct {
	SessionID     string  `json:"session_id"`
	StartedAt     *string `json:"started_at"`
	LastMessageAt *string `json:"last_message_at"`
	MessageCount  int     `json:"message_count"`
}

// AIStatus is the response from the AI status endpoint.
type AIStatus struct {
	Connected       bool     `json:"connected"`
	Model           string   `json:"model"`
	AvailableModels []string `json:"available_models"`
	OllamaURL       string   `json:"ollama_url"`
}

// ---------- History ----------

// FinancialSnapshot represents a point-in-time financial snapshot.
type FinancialSnapshot struct {
	ID            int     `json:"id"`
	SnapshotDate  *string `json:"snapshot_date"`
	TotalIncome   float64 `json:"total_income"`
	TotalExpenses float64 `json:"total_expenses"`
	NetSavings    float64 `json:"net_savings"`
	SavingsRate   float64 `json:"savings_rate"`
	TotalDebt     float64 `json:"total_debt"`
	TotalSavings  float64 `json:"total_savings"`
	NetWorthValue float64 `json:"net_worth"`
	Details       *string `json:"details"`
	CreatedAt     *string `json:"created_at"`
}

// TimelineEntry is a single entry in the combined timeline.
type TimelineEntry struct {
	Type string      `json:"type"`
	Date *string     `json:"date"`
	Data interface{} `json:"data"`
}

// MessageResponse is a generic response with a message field.
type MessageResponse struct {
	Message string `json:"message"`
}

// ErrorResponse is a generic error response.
type ErrorResponse struct {
	Error string `json:"error"`
	Hint  string `json:"hint,omitempty"`
}
