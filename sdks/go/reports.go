package aegis

import "fmt"

// ReportsService handles operations on the /api/reports endpoints.
type ReportsService struct {
	client *Client
}

// MonthlyTrends returns income/expense trends for the given number of months.
func (s *ReportsService) MonthlyTrends(months int) ([]MonthlyTrend, error) {
	qs := queryString(map[string]string{
		"months": fmt.Sprintf("%d", months),
	})
	var trends []MonthlyTrend
	err := s.client.get("/api/reports/monthly-trend"+qs, &trends)
	return trends, err
}

// CategoryBreakdown returns the expense breakdown by category for the given
// month (format "YYYY-MM").
func (s *ReportsService) CategoryBreakdown(month string) (*CategoryBreakdown, error) {
	qs := queryString(map[string]string{"month": month})
	var bd CategoryBreakdown
	err := s.client.get("/api/reports/category-breakdown"+qs, &bd)
	return &bd, err
}

// YearlySummaryReport returns the yearly financial summary for the given year.
func (s *ReportsService) YearlySummaryReport(year int) (*YearlySummary, error) {
	qs := queryString(map[string]string{
		"year": fmt.Sprintf("%d", year),
	})
	var summary YearlySummary
	err := s.client.get("/api/reports/yearly-summary"+qs, &summary)
	return &summary, err
}

// NetWorthReport returns the current net worth breakdown.
func (s *ReportsService) NetWorthReport() (*NetWorth, error) {
	var nw NetWorth
	err := s.client.get("/api/reports/net-worth", &nw)
	return &nw, err
}
