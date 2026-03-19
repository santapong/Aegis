import type { AegisClient } from "../client";
import type {
  SavingsJar,
  SavingsJarCreate,
  SavingsJarUpdate,
  SavingsTransaction,
  SavingsSummary,
  DeleteResponse,
} from "../types";

export class SavingsResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /** List all savings jars. */
  async list(): Promise<SavingsJar[]> {
    return this.client.get<SavingsJar[]>("/api/savings/");
  }

  /** Create a new savings jar. */
  async create(data: SavingsJarCreate): Promise<SavingsJar> {
    return this.client.post<SavingsJar>("/api/savings/", data);
  }

  /** Update an existing savings jar. */
  async update(id: number, data: SavingsJarUpdate): Promise<SavingsJar> {
    return this.client.put<SavingsJar>(`/api/savings/${id}`, data);
  }

  /** Delete a savings jar. */
  async delete(id: number): Promise<DeleteResponse> {
    return this.client.delete<DeleteResponse>(`/api/savings/${id}`);
  }

  /** Deposit funds into a savings jar. */
  async deposit(id: number, amount: number): Promise<SavingsJar> {
    const body: SavingsTransaction = { amount };
    return this.client.post<SavingsJar>(`/api/savings/${id}/deposit`, body);
  }

  /** Withdraw funds from a savings jar. */
  async withdraw(id: number, amount: number): Promise<SavingsJar> {
    const body: SavingsTransaction = { amount };
    return this.client.post<SavingsJar>(`/api/savings/${id}/withdraw`, body);
  }

  /** Get a summary of all savings jars. */
  async getSummary(): Promise<SavingsSummary> {
    return this.client.get<SavingsSummary>("/api/savings/summary");
  }
}
