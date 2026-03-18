import type { AegisClient } from "../client";
import type {
  Goal,
  GoalCreate,
  GoalUpdate,
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
  DeleteResponse,
} from "../types";

export class GoalResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  // ─── Goals ───────────────────────────────────────────────────────────────

  /** List all goals. */
  async list(): Promise<Goal[]> {
    return this.client.get<Goal[]>("/api/goals/");
  }

  /** Create a new goal. */
  async create(data: GoalCreate): Promise<Goal> {
    return this.client.post<Goal>("/api/goals/", data);
  }

  /** Get a single goal by ID. */
  async get(id: number): Promise<Goal> {
    return this.client.get<Goal>(`/api/goals/${id}`);
  }

  /** Update an existing goal. */
  async update(id: number, data: GoalUpdate): Promise<Goal> {
    return this.client.put<Goal>(`/api/goals/${id}`, data);
  }

  /** Delete a goal. */
  async delete(id: number): Promise<DeleteResponse> {
    return this.client.delete<DeleteResponse>(`/api/goals/${id}`);
  }

  // ─── Milestones ──────────────────────────────────────────────────────────

  /** Create a milestone for a goal. */
  async createMilestone(data: MilestoneCreate): Promise<Milestone> {
    return this.client.post<Milestone>("/api/milestones/", data);
  }

  /** Update an existing milestone. */
  async updateMilestone(id: number, data: MilestoneUpdate): Promise<Milestone> {
    return this.client.put<Milestone>(`/api/milestones/${id}`, data);
  }

  /** Delete a milestone. */
  async deleteMilestone(id: number): Promise<DeleteResponse> {
    return this.client.delete<DeleteResponse>(`/api/milestones/${id}`);
  }
}
