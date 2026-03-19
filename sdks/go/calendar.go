package aegis

// CalendarService handles operations on the /api/calendar endpoints.
type CalendarService struct {
	client *Client
}

// Events returns all calendar events for the given month (format "YYYY-MM"),
// including projected recurring entries.
func (s *CalendarService) Events(month string) ([]CalendarEvent, error) {
	qs := queryString(map[string]string{"month": month})
	var events []CalendarEvent
	err := s.client.get("/api/calendar/events"+qs, &events)
	return events, err
}

// Summary returns the calendar summary for the given month (format "YYYY-MM").
func (s *CalendarService) Summary(month string) (*CalendarSummary, error) {
	qs := queryString(map[string]string{"month": month})
	var summary CalendarSummary
	err := s.client.get("/api/calendar/summary"+qs, &summary)
	return &summary, err
}
