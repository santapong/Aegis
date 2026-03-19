// Package aegis provides a Go client for the Aegis Money Management API.
package aegis

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is the top-level Aegis API client.  Access each resource through its
// corresponding service field (e.g. client.Budget, client.Goals, ...).
type Client struct {
	// BaseURL is the root URL of the Aegis API (e.g. "http://localhost:8000").
	BaseURL    string
	HTTPClient *http.Client

	Budget   *BudgetService
	Goals    *GoalService
	Debts    *DebtService
	Savings  *SavingsService
	Bills    *BillService
	Reports  *ReportsService
	Calendar *CalendarService
	AI       *AIService
	History  *HistoryService
}

// NewClient creates a new Aegis API client pointing at the given base URL.
func NewClient(baseURL string) *Client {
	c := &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	c.Budget = &BudgetService{client: c}
	c.Goals = &GoalService{client: c}
	c.Debts = &DebtService{client: c}
	c.Savings = &SavingsService{client: c}
	c.Bills = &BillService{client: c}
	c.Reports = &ReportsService{client: c}
	c.Calendar = &CalendarService{client: c}
	c.AI = &AIService{client: c}
	c.History = &HistoryService{client: c}
	return c
}

// ---------- internal helpers ----------

// doRequest performs an HTTP request and decodes the JSON response into dest.
// If dest is nil the response body is discarded.
func (c *Client) doRequest(method, path string, body interface{}, dest interface{}) error {
	fullURL := c.BaseURL + path

	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("aegis: marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return fmt.Errorf("aegis: create request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("aegis: %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("aegis: %s %s returned status %d: %s", method, path, resp.StatusCode, string(respBody))
	}

	if dest != nil {
		if err := json.NewDecoder(resp.Body).Decode(dest); err != nil {
			return fmt.Errorf("aegis: decode response: %w", err)
		}
	}
	return nil
}

func (c *Client) get(path string, dest interface{}) error {
	return c.doRequest(http.MethodGet, path, nil, dest)
}

func (c *Client) post(path string, body interface{}, dest interface{}) error {
	return c.doRequest(http.MethodPost, path, body, dest)
}

func (c *Client) put(path string, body interface{}, dest interface{}) error {
	return c.doRequest(http.MethodPut, path, body, dest)
}

func (c *Client) delete(path string, dest interface{}) error {
	return c.doRequest(http.MethodDelete, path, nil, dest)
}

// queryString builds a URL query string from key/value pairs, skipping empty values.
func queryString(params map[string]string) string {
	vals := url.Values{}
	for k, v := range params {
		if v != "" {
			vals.Set(k, v)
		}
	}
	encoded := vals.Encode()
	if encoded == "" {
		return ""
	}
	return "?" + encoded
}
