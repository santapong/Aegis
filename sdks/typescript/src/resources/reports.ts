import type { AegisClient } from "../client";
import type {
  MonthlyTrendEntry,
  CategoryBreakdown,
  YearlySummary,
  NetWorth,
} from "../types";

export class ReportsResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /** Get monthly income/expense trends. */
  async getMonthlyTrend(params?: { months?: number }): Promise<MonthlyTrendEntry[]> {
    return this.client.get<MonthlyTrendEntry[]>("/api/reports/monthly-trend", {
      months: params?.months,
    });
  }

  /** Get spending breakdown by category. */
  async getCategoryBreakdown(params?: { month?: string }): Promise<CategoryBreakdown> {
    return this.client.get<CategoryBreakdown>("/api/reports/category-breakdown", {
      month: params?.month,
    });
  }

  /** Get a yearly financial summary. */
  async getYearlySummary(params?: { year?: number }): Promise<YearlySummary> {
    return this.client.get<YearlySummary>("/api/reports/yearly-summary", {
      year: params?.year,
    });
  }

  /** Get the current net-worth calculation. */
  async getNetWorth(): Promise<NetWorth> {
    return this.client.get<NetWorth>("/api/reports/net-worth");
  }
}
