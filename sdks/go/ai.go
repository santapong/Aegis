package aegis

// AIService handles operations on the /api/ai endpoints.
type AIService struct {
	client *Client
}

// Analyze runs a full AI financial analysis.  Pass an optional custom prompt
// or nil for the default analysis.
func (s *AIService) Analyze(customPrompt *string) (*AnalysisHistory, error) {
	req := AnalyzeRequest{CustomPrompt: customPrompt}
	var result AnalysisHistory
	err := s.client.post("/api/ai/analyze", &req, &result)
	return &result, err
}

// Chat sends a message to the AI chat assistant.  Pass an empty sessionID to
// start a new session.
func (s *AIService) Chat(message, sessionID string) (*ChatResponse, error) {
	req := ChatRequest{Message: message}
	if sessionID != "" {
		req.SessionID = &sessionID
	}
	var resp ChatResponse
	err := s.client.post("/api/ai/chat", &req, &resp)
	return &resp, err
}

// ChatHistory returns the message history for the given session.
func (s *AIService) ChatHistory(sessionID string) ([]ChatMessage, error) {
	qs := queryString(map[string]string{"session_id": sessionID})
	var messages []ChatMessage
	err := s.client.get("/api/ai/chat/history"+qs, &messages)
	return messages, err
}

// ChatSessions returns all chat sessions.
func (s *AIService) ChatSessions() ([]ChatSession, error) {
	var sessions []ChatSession
	err := s.client.get("/api/ai/chat/sessions", &sessions)
	return sessions, err
}

// Analyses returns past AI analysis results.
func (s *AIService) Analyses() ([]AnalysisHistory, error) {
	var analyses []AnalysisHistory
	err := s.client.get("/api/ai/analyses", &analyses)
	return analyses, err
}

// Status returns the AI service connection status.
func (s *AIService) Status() (*AIStatus, error) {
	var status AIStatus
	err := s.client.get("/api/ai/status", &status)
	return &status, err
}
