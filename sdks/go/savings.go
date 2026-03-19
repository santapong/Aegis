package aegis

import "fmt"

// SavingsService handles operations on the /api/savings endpoints.
type SavingsService struct {
	client *Client
}

// List returns all savings jars.
func (s *SavingsService) List() ([]SavingsJar, error) {
	var jars []SavingsJar
	err := s.client.get("/api/savings/", &jars)
	return jars, err
}

// Create adds a new savings jar.
func (s *SavingsService) Create(jar SavingsJarCreate) (*SavingsJar, error) {
	var created SavingsJar
	err := s.client.post("/api/savings/", &jar, &created)
	return &created, err
}

// Get retrieves a single savings jar by ID.
func (s *SavingsService) Get(id int) (*SavingsJar, error) {
	var jar SavingsJar
	err := s.client.get(fmt.Sprintf("/api/savings/%d", id), &jar)
	return &jar, err
}

// Update modifies an existing savings jar by ID.
func (s *SavingsService) Update(id int, jar SavingsJarUpdate) (*SavingsJar, error) {
	var updated SavingsJar
	err := s.client.put(fmt.Sprintf("/api/savings/%d", id), &jar, &updated)
	return &updated, err
}

// Delete removes a savings jar by ID.
func (s *SavingsService) Delete(id int) (*MessageResponse, error) {
	var resp MessageResponse
	err := s.client.delete(fmt.Sprintf("/api/savings/%d", id), &resp)
	return &resp, err
}

// Deposit adds funds to a savings jar.
func (s *SavingsService) Deposit(id int, amount float64) (*SavingsJar, error) {
	tx := SavingsTransaction{Amount: amount}
	var jar SavingsJar
	err := s.client.post(fmt.Sprintf("/api/savings/%d/deposit", id), &tx, &jar)
	return &jar, err
}

// Withdraw removes funds from a savings jar.
func (s *SavingsService) Withdraw(id int, amount float64) (*SavingsJar, error) {
	tx := SavingsTransaction{Amount: amount}
	var jar SavingsJar
	err := s.client.post(fmt.Sprintf("/api/savings/%d/withdraw", id), &tx, &jar)
	return &jar, err
}

// Summary returns the aggregated savings summary.
func (s *SavingsService) Summary() (*SavingsSummary, error) {
	var summary SavingsSummary
	err := s.client.get("/api/savings/summary", &summary)
	return &summary, err
}
