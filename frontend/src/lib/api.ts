import { useAuthStore } from "@/stores/auth-store";
import { useToastStore } from "@/stores/toast-store";
import type { NotificationListResponse, Notification, Transaction } from "@/types";

// Same-origin by default — the browser hits `/api/*` and Next.js
// rewrites (server-side) to BACKEND_INTERNAL_URL. Override with
// NEXT_PUBLIC_API_URL only if you intentionally want the browser to
// reach the backend directly (e.g. to bypass Vercel's response buffering
// for streaming AI responses). Empty string falls through to relative
// `/api/...` URLs which the rewrite handles.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export class APIError extends Error {
  status: number;
  detail?: string;

  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.detail = detail;
  }
}

const PUBLIC_ENDPOINTS = ["/api/auth/login", "/api/auth/register"];

// Dedupe the session-expired toast: when a token expires, multiple in-flight
// requests fire 401 at once. Only surface one user-facing toast per minute.
let lastSessionExpiredToastAt = 0;

function notifySessionExpired() {
  const now = Date.now();
  if (now - lastSessionExpiredToastAt < 60_000) return;
  lastSessionExpiredToastAt = now;
  try {
    useToastStore.getState().addToast({
      type: "warning",
      message: "Your session expired",
      description: "Please sign in again to continue.",
    });
  } catch {
    // Toast store not initialised yet — drop quietly.
  }
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const isPublic = PUBLIC_ENDPOINTS.some((p) => url.startsWith(p));
  const token = isPublic ? null : useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${url}`, {
    headers,
    ...init,
  });
  if (res.status === 401) {
    if (isPublic) {
      let detail: string | undefined;
      try {
        const body = await res.json();
        detail = body.detail || body.message;
      } catch {}
      throw new APIError(401, "Invalid credentials", detail);
    }
    notifySessionExpired();
    useAuthStore.getState().logout();
    throw new APIError(401, "Session expired");
  }
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = body.detail || body.message;
    } catch {}
    throw new APIError(res.status, `API error: ${res.status}`, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** DELETE helper that runs through fetchJSON's auth + error pipeline. */
function fetchDELETE(path: string): Promise<void> {
  return fetchJSON<void>(path, { method: "DELETE" });
}

interface AuthUser {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  onboarded_at: string | null;
  created_at: string;
}

export const authAPI = {
  register: (data: { email: string; username: string; password: string }) =>
    fetchJSON<AuthUser>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    fetchJSON<{ access_token: string; token_type: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify(data) }
    ),
  me: () => fetchJSON<AuthUser>("/api/auth/me"),
  markOnboarded: () => fetchJSON<AuthUser>("/api/auth/onboarded", { method: "POST" }),
};

export const dashboardAPI = {
  summary: () => fetchJSON("/api/dashboard/summary"),
  charts: () => fetchJSON("/api/dashboard/charts"),
  healthScore: () => fetchJSON("/api/dashboard/health-score"),
  cashflowForecast: (months = 6) =>
    fetchJSON(`/api/dashboard/cashflow-forecast?months=${months}`),
};

export const transactionsAPI = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJSON<Transaction[]>(`/api/transactions/${qs}`);
  },
  search: (q: string, limit = 20) =>
    fetchJSON<Transaction[]>(
      `/api/transactions/?q=${encodeURIComponent(q)}&limit=${limit}`
    ),
  create: (data: Record<string, unknown>) =>
    fetchJSON("/api/transactions/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  summary: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    return fetchJSON(`/api/transactions/summary?${params}`);
  },
  anomalies: (days = 90, threshold = 2.0) =>
    fetchJSON(`/api/transactions/anomalies?days=${days}&threshold=${threshold}`),
  recurring: () => fetchJSON("/api/transactions/recurring"),
  upcoming: (days = 30) => fetchJSON(`/api/transactions/upcoming?days=${days}`),
  delete: (id: string) => fetchDELETE(`/api/transactions/${id}`),
  importPreview: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/transactions/import/preview`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new APIError(res.status, "Import preview failed");
    return res.json();
  },
  importConfirm: (rows: unknown[]) =>
    fetchJSON("/api/transactions/import/confirm", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
};

export const tagsAPI = {
  list: () => fetchJSON("/api/tags/"),
  create: (data: { name: string; color: string }) =>
    fetchJSON("/api/tags/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; color?: string }) =>
    fetchJSON(`/api/tags/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => fetchDELETE(`/api/tags/${id}`),
};

export const plansAPI = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJSON(`/api/plans/${qs}`);
  },
  get: (id: string) => fetchJSON(`/api/plans/${id}`),
  create: (data: Record<string, unknown>) =>
    fetchJSON("/api/plans/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/plans/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateProgress: (id: string, progress: number) =>
    fetchJSON(`/api/plans/${id}/progress`, {
      method: "PATCH",
      body: JSON.stringify({ progress }),
    }),
  delete: (id: string) => fetchDELETE(`/api/plans/${id}`),
};

export const budgetsAPI = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJSON(`/api/budgets/${qs}`);
  },
  create: (data: Record<string, unknown>) =>
    fetchJSON("/api/budgets/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/budgets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => fetchDELETE(`/api/budgets/${id}`),
  comparison: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("period_start", start);
    if (end) params.set("period_end", end);
    return fetchJSON(`/api/budgets/comparison?${params}`);
  },
};

export const tripsAPI = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJSON(`/api/trips/${qs}`);
  },
  get: (id: string) => fetchJSON(`/api/trips/${id}`),
  create: (data: Record<string, unknown>) =>
    fetchJSON("/api/trips/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/trips/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => fetchDELETE(`/api/trips/${id}`),
  summary: (id: string) => fetchJSON(`/api/trips/${id}/summary`),
};

export const calendarAPI = {
  events: (start: string, end: string) =>
    fetchJSON(`/api/calendar/events?start=${start}&end=${end}`),
  moveEvent: (
    id: string,
    data: { new_start: string; new_end?: string | null }
  ) => {
    const params = new URLSearchParams();
    params.set("new_start", data.new_start);
    if (data.new_end) params.set("new_end", data.new_end);
    return fetchJSON(`/api/calendar/events/${id}/move?${params.toString()}`, {
      method: "PUT",
    });
  },
};

export const ganttAPI = {
  tasks: () => fetchJSON("/api/gantt/tasks"),
  update: (
    id: string,
    data: { start?: string; end?: string; progress?: number }
  ) => {
    const params = new URLSearchParams();
    if (data.start) params.set("start", data.start);
    if (data.end) params.set("end", data.end);
    if (data.progress !== undefined) params.set("progress", String(data.progress));
    return fetchJSON(`/api/gantt/tasks/${id}?${params.toString()}`, {
      method: "PUT",
    });
  },
};

export const aiAPI = {
  analyze: (question?: string) =>
    fetchJSON("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
  forecast: (months = 3) =>
    fetchJSON("/api/ai/forecast", {
      method: "POST",
      body: JSON.stringify({ months_ahead: months }),
    }),
  history: () => fetchJSON("/api/ai/history"),
  accept: (id: string) =>
    fetchJSON(`/api/ai/history/${id}/accept`, { method: "PATCH" }),
  weeklySummary: () => fetchJSON("/api/ai/weekly-summary"),
  insights: () => fetchJSON("/api/ai/insights"),
};

export const reportsAPI = {
  categoryComparison: (months = 6) =>
    fetchJSON(`/api/reports/category-comparison?months=${months}`),
  /**
   * Download the CSV export through an authenticated fetch, then trigger a
   * client-side `&lt;a download&gt;` click. Mirrors `exportPDF` so a token-less
   * `window.open` doesn't 401 in a popup.
   */
  exportCSV: async (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    const res = await fetch(`${API_BASE}/api/reports/export?${params}`, {
      headers: {
        Authorization: `Bearer ${useAuthStore.getState().token || ""}`,
      },
    });
    if (!res.ok) throw new APIError(res.status, "CSV export failed");
    const blob = await res.blob();
    const filename =
      res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
      "aegis-transactions.csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  exportPDF: async (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    const res = await fetch(`${API_BASE}/api/reports/export.pdf?${params}`, {
      headers: {
        Authorization: `Bearer ${useAuthStore.getState().token || ""}`,
      },
    });
    if (!res.ok) throw new APIError(res.status, "PDF export failed");
    const blob = await res.blob();
    const filename =
      res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
      "aegis-report.pdf";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export const notificationsAPI = {
  list: (unreadOnly = false, limit = 50) =>
    fetchJSON<NotificationListResponse>(
      `/api/notifications/?unread_only=${unreadOnly}&limit=${limit}`
    ),
  markRead: (id: string) =>
    fetchJSON<Notification>(`/api/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () =>
    fetchJSON<void>("/api/notifications/read-all", { method: "POST" }),
  clearAll: () =>
    fetchJSON<void>("/api/notifications/", { method: "DELETE" }),
};

export const savingsGoalsAPI = {
  list: () => fetchJSON("/api/savings-goals/"),
  create: (data: Record<string, unknown>) =>
    fetchJSON("/api/savings-goals/", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string) => fetchJSON(`/api/savings-goals/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/savings-goals/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  contribute: (id: string, amount: number) =>
    fetchJSON(`/api/savings-goals/${id}/contribute`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),
  delete: (id: string) => fetchDELETE(`/api/savings-goals/${id}`),
};

export const paymentsAPI = {
  config: () => fetchJSON("/api/payments/config"),
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJSON(`/api/payments/${qs}`);
  },
  get: (id: string) => fetchJSON(`/api/payments/${id}`),
  createCheckout: (data: { amount: number; currency?: string; description?: string }) =>
    fetchJSON("/api/payments/create-checkout-session", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

/**
 * Wire shape for /api/preferences. Field names mirror the backend's
 * snake_case schema; the app store translates to its camelCase `AppSettings`
 * shape at the persistence boundary.
 */
export interface PreferencesPayload {
  currency: string;
  default_date_range_days: number;
  items_per_page: number;
  ai_auto_suggestions: boolean;
}

export const preferencesAPI = {
  get: () => fetchJSON<PreferencesPayload>("/api/preferences"),
  update: (data: Partial<PreferencesPayload>) =>
    fetchJSON<PreferencesPayload>("/api/preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export const investmentsAPI = {
  list: () => fetchJSON("/api/investments/"),
  get: (id: string) => fetchJSON(`/api/investments/${id}`),
  create: (data: Record<string, unknown>) =>
    fetchJSON("/api/investments/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/investments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  summary: () => fetchJSON("/api/investments/summary"),
  delete: (id: string) => fetchDELETE(`/api/investments/${id}`),
};

export const debtsAPI = {
  list: () => fetchJSON("/api/debts/"),
  create: (data: Record<string, unknown>) =>
    fetchJSON("/api/debts/", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string) => fetchJSON(`/api/debts/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/debts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  makePayment: (id: string, amount: number) =>
    fetchJSON(`/api/debts/${id}/payment`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),
  payoffPlan: (strategy = "avalanche", extraPayment = 0) =>
    fetchJSON(`/api/debts/payoff-plan?strategy=${strategy}&extra_payment=${extraPayment}`),
  delete: (id: string) => fetchDELETE(`/api/debts/${id}`),
};
