import type { AegisClient } from "../client";
import type {
  BudgetEntry,
  BudgetEntryCreate,
  BudgetEntryUpdate,
  BudgetSummary,
  BudgetCategories,
  BudgetListParams,
  DeleteResponse,
} from "../types";

export class BudgetResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /** List budget entries with optional filters. */
  async list(params?: BudgetListParams): Promise<BudgetEntry[]> {
    return this.client.get<BudgetEntry[]>("/api/budget/", {
      month: params?.month,
      entry_type: params?.entry_type,
      category: params?.category,
    });
  }

  /** Create a new budget entry. */
  async create(data: BudgetEntryCreate): Promise<BudgetEntry> {
    return this.client.post<BudgetEntry>("/api/budget/", data);
  }

  /** Update an existing budget entry. */
  async update(id: number, data: BudgetEntryUpdate): Promise<BudgetEntry> {
    return this.client.put<BudgetEntry>(`/api/budget/${id}`, data);
  }

  /** Delete a budget entry. */
  async delete(id: number): Promise<DeleteResponse> {
    return this.client.delete<DeleteResponse>(`/api/budget/${id}`);
  }

  /** Get budget summary for a given month (format: "YYYY-MM"). */
  async getSummary(month: string): Promise<BudgetSummary> {
    return this.client.get<BudgetSummary>("/api/budget/summary", { month });
  }

  /** Get available budget categories. */
  async getCategories(): Promise<BudgetCategories> {
    return this.client.get<BudgetCategories>("/api/budget/categories");
  }
}
