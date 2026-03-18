import type { AegisClient } from "../client";
import type {
  BillReminder,
  BillReminderCreate,
  BillReminderUpdate,
  UpcomingBill,
  BillsSummary,
  DeleteResponse,
} from "../types";

export class BillResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /** List all bill reminders. */
  async list(): Promise<BillReminder[]> {
    return this.client.get<BillReminder[]>("/api/bills/");
  }

  /** Create a new bill reminder. */
  async create(data: BillReminderCreate): Promise<BillReminder> {
    return this.client.post<BillReminder>("/api/bills/", data);
  }

  /** Update an existing bill reminder. */
  async update(id: number, data: BillReminderUpdate): Promise<BillReminder> {
    return this.client.put<BillReminder>(`/api/bills/${id}`, data);
  }

  /** Delete a bill reminder. */
  async delete(id: number): Promise<DeleteResponse> {
    return this.client.delete<DeleteResponse>(`/api/bills/${id}`);
  }

  /** Mark a bill as paid. */
  async pay(id: number): Promise<BillReminder> {
    return this.client.post<BillReminder>(`/api/bills/${id}/pay`);
  }

  /** List upcoming bills. */
  async getUpcoming(): Promise<UpcomingBill[]> {
    return this.client.get<UpcomingBill[]>("/api/bills/upcoming");
  }

  /** Get bills summary. */
  async getSummary(): Promise<BillsSummary> {
    return this.client.get<BillsSummary>("/api/bills/summary");
  }
}
