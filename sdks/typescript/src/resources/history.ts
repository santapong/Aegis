import type { AegisClient } from "../client";
import type { FinancialSnapshot, TimelineEntry } from "../types";

export class HistoryResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /** List all financial snapshots. */
  async getSnapshots(): Promise<FinancialSnapshot[]> {
    return this.client.get<FinancialSnapshot[]>("/api/history/snapshots");
  }

  /** Create a new financial snapshot. */
  async createSnapshot(): Promise<FinancialSnapshot> {
    return this.client.post<FinancialSnapshot>("/api/history/snapshots");
  }

  /** Get a single snapshot by ID. */
  async getSnapshot(id: number): Promise<FinancialSnapshot> {
    return this.client.get<FinancialSnapshot>(`/api/history/snapshots/${id}`);
  }

  /** Get a combined timeline of snapshots and analyses. */
  async getTimeline(): Promise<TimelineEntry[]> {
    return this.client.get<TimelineEntry[]>("/api/history/timeline");
  }
}
