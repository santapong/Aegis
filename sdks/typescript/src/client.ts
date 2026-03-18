import { AegisClientOptions } from "./types";
import {
  BudgetResource,
  GoalResource,
  DebtResource,
  SavingsResource,
  BillResource,
  ReportsResource,
  CalendarResource,
  AIResource,
  HistoryResource,
} from "./resources";

export class AegisError extends Error {
  public status: number;
  public body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "AegisError";
    this.status = status;
    this.body = body;
  }
}

export class AegisClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  public budget: BudgetResource;
  public goals: GoalResource;
  public debts: DebtResource;
  public savings: SavingsResource;
  public bills: BillResource;
  public reports: ReportsResource;
  public calendar: CalendarResource;
  public ai: AIResource;
  public history: HistoryResource;

  constructor(options: AegisClientOptions | string = "http://localhost:8000") {
    if (typeof options === "string") {
      this.baseUrl = options.replace(/\/+$/, "");
      this.headers = {};
    } else {
      this.baseUrl = (options.baseUrl ?? "http://localhost:8000").replace(/\/+$/, "");
      this.headers = options.headers ?? {};
    }

    this.budget = new BudgetResource(this);
    this.goals = new GoalResource(this);
    this.debts = new DebtResource(this);
    this.savings = new SavingsResource(this);
    this.bills = new BillResource(this);
    this.reports = new ReportsResource(this);
    this.calendar = new CalendarResource(this);
    this.ai = new AIResource(this);
    this.history = new HistoryResource(this);
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | undefined>;
    }
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    // Append query parameters
    if (options?.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
    };

    if (options?.body !== undefined) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
      throw new AegisError(
        `Request failed: ${method} ${path} (${response.status})`,
        response.status,
        body
      );
    }

    return (await response.json()) as T;
  }

  async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>
  ): Promise<T> {
    return this.request<T>("GET", path, { params });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
