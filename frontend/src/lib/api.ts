const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = body.detail || body.message;
    } catch {}
    throw new APIError(res.status, `API error: ${res.status}`, detail);
  }
  return res.json();
}

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
    return fetchJSON(`/api/transactions/${qs}`);
  },
  create: (data: Record<string, unknown>) =>
    fetchJSON("/api/transactions/", { method: "POST", body: JSON.stringify(data) }),
  summary: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    return fetchJSON(`/api/transactions/summary?${params}`);
  },
  anomalies: (days = 90, threshold = 2.0) =>
    fetchJSON(`/api/transactions/anomalies?days=${days}&threshold=${threshold}`),
  recurring: () => fetchJSON("/api/transactions/recurring"),
  delete: (id: string) =>
    fetch(`${API_BASE}/api/transactions/${id}`, { method: "DELETE" }),
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
  delete: (id: string) =>
    fetch(`${API_BASE}/api/tags/${id}`, { method: "DELETE" }),
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
  delete: (id: string) =>
    fetch(`${API_BASE}/api/plans/${id}`, { method: "DELETE" }),
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
  delete: (id: string) =>
    fetch(`${API_BASE}/api/budgets/${id}`, { method: "DELETE" }),
  comparison: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("period_start", start);
    if (end) params.set("period_end", end);
    return fetchJSON(`/api/budgets/comparison?${params}`);
  },
};

export const calendarAPI = {
  events: (start: string, end: string) =>
    fetchJSON(`/api/calendar/events?start=${start}&end=${end}`),
  moveEvent: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/calendar/events/${id}/move`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export const ganttAPI = {
  tasks: () => fetchJSON("/api/gantt/tasks"),
  update: (id: string, data: Record<string, unknown>) =>
    fetchJSON(`/api/gantt/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
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
  exportCSV: (start?: string, end?: string) => {
    const params = new URLSearchParams();
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    return `${API_BASE}/api/reports/export?${params}`;
  },
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
  delete: (id: string) =>
    fetch(`${API_BASE}/api/savings-goals/${id}`, { method: "DELETE" }),
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
  delete: (id: string) =>
    fetch(`${API_BASE}/api/debts/${id}`, { method: "DELETE" }),
};
