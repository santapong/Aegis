package aegis

import "fmt"

// DebtService handles operations on the /api/debts endpoints.
type DebtService struct {
	client *Client
}

// List returns all debts.
func (s *DebtService) List() ([]Debt, error) {
	var debts []Debt
	err := s.client.get("/api/debts/", &debts)
	return debts, err
}

// Create adds a new debt.
func (s *DebtService) Create(debt DebtCreate) (*Debt, error) {
	var created Debt
	err := s.client.post("/api/debts/", &debt, &created)
	return &created, err
}

// Get retrieves a single debt by ID.
func (s *DebtService) Get(id int) (*Debt, error) {
	var debt Debt
	err := s.client.get(fmt.Sprintf("/api/debts/%d", id), &debt)
	return &debt, err
}

// Update modifies an existing debt by ID.
func (s *DebtService) Update(id int, debt DebtUpdate) (*Debt, error) {
	var updated Debt
	err := s.client.put(fmt.Sprintf("/api/debts/%d", id), &debt, &updated)
	return &updated, err
}

// Delete removes a debt by ID.
func (s *DebtService) Delete(id int) (*MessageResponse, error) {
	var resp MessageResponse
	err := s.client.delete(fmt.Sprintf("/api/debts/%d", id), &resp)
	return &resp, err
}

// Summary returns the aggregated debt summary.
func (s *DebtService) Summary() (*DebtSummary, error) {
	var summary DebtSummary
	err := s.client.get("/api/debts/summary", &summary)
	return &summary, err
}

// PayoffPlan returns a debt payoff plan.  strategy should be "avalanche" or
// "snowball"; extra is the additional monthly payment on top of minimums.
func (s *DebtService) PayoffPlan(strategy string, extra float64) (*PayoffPlan, error) {
	qs := queryString(map[string]string{
		"strategy": strategy,
		"extra":    fmt.Sprintf("%.2f", extra),
	})
	var plan PayoffPlan
	err := s.client.get("/api/debts/payoff-plan"+qs, &plan)
	return &plan, err
}
