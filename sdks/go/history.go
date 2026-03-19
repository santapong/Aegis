package aegis

import "fmt"

// HistoryService handles operations on the /api/history endpoints.
type HistoryService struct {
	client *Client
}

// ListSnapshots returns all financial snapshots.
func (s *HistoryService) ListSnapshots() ([]FinancialSnapshot, error) {
	var snapshots []FinancialSnapshot
	err := s.client.get("/api/history/snapshots", &snapshots)
	return snapshots, err
}

// CreateSnapshot takes a snapshot of the current financial state.
func (s *HistoryService) CreateSnapshot() (*FinancialSnapshot, error) {
	var snapshot FinancialSnapshot
	err := s.client.post("/api/history/snapshots", nil, &snapshot)
	return &snapshot, err
}

// GetSnapshot retrieves a single snapshot by ID.
func (s *HistoryService) GetSnapshot(id int) (*FinancialSnapshot, error) {
	var snapshot FinancialSnapshot
	err := s.client.get(fmt.Sprintf("/api/history/snapshots/%d", id), &snapshot)
	return &snapshot, err
}

// Timeline returns a combined timeline of snapshots and analyses.
func (s *HistoryService) Timeline(limit int) ([]TimelineEntry, error) {
	qs := queryString(map[string]string{
		"limit": fmt.Sprintf("%d", limit),
	})
	var timeline []TimelineEntry
	err := s.client.get("/api/history/timeline"+qs, &timeline)
	return timeline, err
}
