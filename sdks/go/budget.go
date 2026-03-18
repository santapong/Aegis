package aegis

import "fmt"

// BudgetService handles operations on the /api/budget endpoints.
type BudgetService struct {
	client *Client
}

// List returns all budget entries, optionally filtered by month, entry type,
// and/or category.  Pass empty strings to skip a filter.
func (s *BudgetService) List(month, entryType, category string) ([]BudgetEntry, error) {
	qs := queryString(map[string]string{
		"month":      month,
		"entry_type": entryType,
		"category":   category,
	})
	var entries []BudgetEntry
	err := s.client.get("/api/budget/"+qs, &entries)
	return entries, err
}

// Create adds a new budget entry.
func (s *BudgetService) Create(entry BudgetEntryCreate) (*BudgetEntry, error) {
	var created BudgetEntry
	err := s.client.post("/api/budget/", &entry, &created)
	return &created, err
}

// Update modifies an existing budget entry by ID.
func (s *BudgetService) Update(id int, entry BudgetEntryUpdate) (*BudgetEntry, error) {
	var updated BudgetEntry
	err := s.client.put(fmt.Sprintf("/api/budget/%d", id), &entry, &updated)
	return &updated, err
}

// Delete removes a budget entry by ID.
func (s *BudgetService) Delete(id int) (*MessageResponse, error) {
	var resp MessageResponse
	err := s.client.delete(fmt.Sprintf("/api/budget/%d", id), &resp)
	return &resp, err
}

// Summary returns the budget summary for the given month (format "YYYY-MM").
func (s *BudgetService) Summary(month string) (*BudgetSummary, error) {
	qs := queryString(map[string]string{"month": month})
	var summary BudgetSummary
	err := s.client.get("/api/budget/summary"+qs, &summary)
	return &summary, err
}

// Categories returns the available income and expense categories.
func (s *BudgetService) Categories() (*BudgetCategories, error) {
	var cats BudgetCategories
	err := s.client.get("/api/budget/categories", &cats)
	return &cats, err
}
