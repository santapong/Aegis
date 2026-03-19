import type { AegisClient } from "../client";
import type { CalendarEvent, CalendarSummary } from "../types";

export class CalendarResource {
  private client: AegisClient;

  constructor(client: AegisClient) {
    this.client = client;
  }

  /** Get calendar events for a given month (format: "YYYY-MM"). */
  async getEvents(month: string): Promise<CalendarEvent[]> {
    return this.client.get<CalendarEvent[]>("/api/calendar/events", { month });
  }

  /** Get a calendar summary for a given month (format: "YYYY-MM"). */
  async getSummary(month: string): Promise<CalendarSummary> {
    return this.client.get<CalendarSummary>("/api/calendar/summary", { month });
  }
}
