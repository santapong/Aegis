package aegis

import "fmt"

// BillService handles operations on the /api/bills endpoints.
type BillService struct {
	client *Client
}

// List returns all bill reminders.
func (s *BillService) List() ([]BillReminder, error) {
	var bills []BillReminder
	err := s.client.get("/api/bills/", &bills)
	return bills, err
}

// Create adds a new bill reminder.
func (s *BillService) Create(bill BillReminderCreate) (*BillReminder, error) {
	var created BillReminder
	err := s.client.post("/api/bills/", &bill, &created)
	return &created, err
}

// Get retrieves a single bill reminder by ID.
func (s *BillService) Get(id int) (*BillReminder, error) {
	var bill BillReminder
	err := s.client.get(fmt.Sprintf("/api/bills/%d", id), &bill)
	return &bill, err
}

// Update modifies an existing bill reminder by ID.
func (s *BillService) Update(id int, bill BillReminderUpdate) (*BillReminder, error) {
	var updated BillReminder
	err := s.client.put(fmt.Sprintf("/api/bills/%d", id), &bill, &updated)
	return &updated, err
}

// Delete removes a bill reminder by ID.
func (s *BillService) Delete(id int) (*MessageResponse, error) {
	var resp MessageResponse
	err := s.client.delete(fmt.Sprintf("/api/bills/%d", id), &resp)
	return &resp, err
}

// Pay marks a bill as paid and advances its next due date.
func (s *BillService) Pay(id int) (*BillReminder, error) {
	var bill BillReminder
	err := s.client.post(fmt.Sprintf("/api/bills/%d/pay", id), nil, &bill)
	return &bill, err
}

// Upcoming returns bills due within the given number of days.
func (s *BillService) Upcoming(days int) ([]UpcomingBill, error) {
	qs := queryString(map[string]string{
		"days": fmt.Sprintf("%d", days),
	})
	var bills []UpcomingBill
	err := s.client.get("/api/bills/upcoming"+qs, &bills)
	return bills, err
}

// Summary returns the aggregated bill summary.
func (s *BillService) Summary() (*BillSummary, error) {
	var summary BillSummary
	err := s.client.get("/api/bills/summary", &summary)
	return &summary, err
}
