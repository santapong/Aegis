const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
  delete: (id: string) =>
    fetch(`${API_BASE}/api/transactions/${id}`, { method: "DELETE" }),
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
