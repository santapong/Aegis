package aegis

import "fmt"

// GoalService handles operations on the /api/goals and /api/milestones endpoints.
type GoalService struct {
	client *Client
}

// List returns all goals.
func (s *GoalService) List() ([]Goal, error) {
	var goals []Goal
	err := s.client.get("/api/goals/", &goals)
	return goals, err
}

// Create adds a new goal.
func (s *GoalService) Create(goal GoalCreate) (*Goal, error) {
	var created Goal
	err := s.client.post("/api/goals/", &goal, &created)
	return &created, err
}

// Get retrieves a single goal by ID.
func (s *GoalService) Get(id int) (*Goal, error) {
	var goal Goal
	err := s.client.get(fmt.Sprintf("/api/goals/%d", id), &goal)
	return &goal, err
}

// Update modifies an existing goal by ID.
func (s *GoalService) Update(id int, goal GoalUpdate) (*Goal, error) {
	var updated Goal
	err := s.client.put(fmt.Sprintf("/api/goals/%d", id), &goal, &updated)
	return &updated, err
}

// Delete removes a goal by ID.
func (s *GoalService) Delete(id int) (*MessageResponse, error) {
	var resp MessageResponse
	err := s.client.delete(fmt.Sprintf("/api/goals/%d", id), &resp)
	return &resp, err
}

// ---------- Milestones ----------

// ListMilestones returns all milestones.
func (s *GoalService) ListMilestones() ([]Milestone, error) {
	var milestones []Milestone
	err := s.client.get("/api/milestones/", &milestones)
	return milestones, err
}

// CreateMilestone adds a new milestone.
func (s *GoalService) CreateMilestone(ms MilestoneCreate) (*Milestone, error) {
	var created Milestone
	err := s.client.post("/api/milestones/", &ms, &created)
	return &created, err
}

// UpdateMilestone modifies an existing milestone by ID.
func (s *GoalService) UpdateMilestone(id int, ms MilestoneUpdate) (*Milestone, error) {
	var updated Milestone
	err := s.client.put(fmt.Sprintf("/api/milestones/%d", id), &ms, &updated)
	return &updated, err
}

// DeleteMilestone removes a milestone by ID.
func (s *GoalService) DeleteMilestone(id int) (*MessageResponse, error) {
	var resp MessageResponse
	err := s.client.delete(fmt.Sprintf("/api/milestones/%d", id), &resp)
	return &resp, err
}
