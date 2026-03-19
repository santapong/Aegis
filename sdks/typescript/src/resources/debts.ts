import type { AegisClient } from "../client";
import type {
  Debt,
  DebtCreate,
  DebtUpdate,
  DebtSummary,
  PayoffPlan,
  PayoffPlanParams,
  DeleteResponse,
} from "../types";

export class DebtResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /** List all debts. */
  async list(): Promise<Debt[]> {
    return this.client.get<Debt[]>("/api/debts/");
  }

  /** Create a new debt. */
  async create(data: DebtCreate): Promise<Debt> {
    return this.client.post<Debt>("/api/debts/", data);
  }

  /** Get a single debt by ID. */
  async get(id: number): Promise<Debt> {
    return this.client.get<Debt>(`/api/debts/${id}`);
  }

  /** Update an existing debt. */
  async update(id: number, data: DebtUpdate): Promise<Debt> {
    return this.client.put<Debt>(`/api/debts/${id}`, data);
  }

  /** Delete a debt. */
  async delete(id: number): Promise<DeleteResponse> {
    return this.client.delete<DeleteResponse>(`/api/debts/${id}`);
  }

  /** Get debt summary. */
  async getSummary(): Promise<DebtSummary> {
    return this.client.get<DebtSummary>("/api/debts/summary");
  }

  /** Get a debt payoff plan. */
  async getPayoffPlan(params?: PayoffPlanParams): Promise<PayoffPlan> {
    return this.client.get<PayoffPlan>("/api/debts/payoff-plan", {
      strategy: params?.strategy,
      extra: params?.extra,
    });
  }
}
