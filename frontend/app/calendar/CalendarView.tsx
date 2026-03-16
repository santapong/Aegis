"use client";

import { useEffect, useState } from "react";

interface CalendarEvent {
  id: number;
  entry_type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  date: string;
  is_recurring: string | null;
  projected: boolean;
}

interface CalendarSummary {
  month: string;
  actual_entries: number;
  projected_recurring: number;
  total_events: number;
  actual_income: number;
  actual_expense: number;
  projected_income: number;
  projected_expense: number;
  total_income: number;
  total_expense: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const INCOME_CATEGORIES = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "investment", label: "Investment" },
  { value: "gift", label: "Gift" },
  { value: "refund", label: "Refund" },
  { value: "side_hustle", label: "Side Hustle" },
  { value: "other_income", label: "Other" },
];

const EXPENSE_CATEGORIES = [
  { value: "food", label: "Food & Dining" },
  { value: "transport", label: "Transport" },
  { value: "housing", label: "Housing & Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "insurance", label: "Insurance" },
  { value: "travel", label: "Travel" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "personal_care", label: "Personal Care" },
  { value: "gifts_donations", label: "Gifts & Donations" },
  { value: "other_expense", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  salary: "#10b981",
  freelance: "#06b6d4",
  investment: "#8b5cf6",
  gift: "#f472b6",
  refund: "#a3e635",
  side_hustle: "#fb923c",
  other_income: "#6b7280",
  food: "#ef4444",
  transport: "#f59e0b",
  housing: "#3b82f6",
  utilities: "#8b5cf6",
  entertainment: "#ec4899",
  shopping: "#f97316",
  healthcare: "#14b8a6",
  education: "#6366f1",
  insurance: "#64748b",
  travel: "#06b6d4",
  subscriptions: "#a855f7",
  personal_care: "#f472b6",
  gifts_donations: "#fb7185",
  other_expense: "#6b7280",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

function getCategoryLabel(value: string): string {
  const all = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
  return all.find((c) => c.value === value)?.label || value;
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days: { day: number; inMonth: boolean; dateStr: string }[] = [];

  // Previous month padding
  const prevLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = prevLastDay - i;
    const prevMonth = month - 1 <= 0 ? 12 : month - 1;
    const prevYear = month - 1 <= 0 ? year - 1 : year;
    days.push({
      day: d,
      inMonth: false,
      dateStr: `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    days.push({
      day: d,
      inMonth: true,
      dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  // Next month padding (fill to 42 cells = 6 rows)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month + 1 > 12 ? 1 : month + 1;
    const nextYear = month + 1 > 12 ? year + 1 : year;
    days.push({
      day: d,
      inMonth: false,
      dateStr: `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }

  return days;
}

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"income" | "expense">("expense");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/calendar/events?month=${selectedMonth}`),
        fetch(`${API_URL}/api/calendar/summary?month=${selectedMonth}`),
      ]);
      const [eventsData, summaryData] = await Promise.all([
        eventsRes.json(),
        summaryRes.json(),
      ]);
      setEvents(eventsData);
      setSummary(summaryData);
    } catch (err) {
      console.error("Failed to fetch calendar data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      entry_type: formType,
      amount: Number(fd.get("amount")),
      category: fd.get("category"),
      description: fd.get("description") || null,
      date: fd.get("date"),
      is_recurring: fd.get("is_recurring") || null,
    };
    await fetch(`${API_URL}/api/budget/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/api/budget/${id}`, { method: "DELETE" });
    fetchData();
  };

  const [year, month] = selectedMonth.split("-").map(Number);
  const calendarDays = getCalendarDays(year, month);
  const todayStr = new Date().toISOString().split("T")[0];

  // Group events by date
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  for (const evt of events) {
    if (!eventsByDate[evt.date]) eventsByDate[evt.date] = [];
    eventsByDate[evt.date].push(evt);
  }

  // Selected date events
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  const categories = formType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const monthLabel = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (loading && events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading calendar...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Calendar</h1>
          <p className="text-sm text-zinc-500 mt-1">Plan subscriptions, bills & scheduled payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const now = new Date();
              setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
            }}
            className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Today
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="text-white font-semibold text-lg px-4 min-w-[200px] text-center">{monthLabel}</span>
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Events</p>
            <p className="text-xl font-bold mt-1 text-white">{summary.total_events}</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              {summary.actual_entries} actual + {summary.projected_recurring} recurring
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Expected Income</p>
            <p className="text-xl font-bold mt-1 text-emerald-400">{formatCurrency(summary.total_income)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Expected Expenses</p>
            <p className="text-xl font-bold mt-1 text-red-400">{formatCurrency(summary.total_expense)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Net</p>
            <p className={`text-xl font-bold mt-1 ${summary.total_income - summary.total_expense >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(summary.total_income - summary.total_expense)}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-zinc-800">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-3 text-center text-xs font-medium text-zinc-500 uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((cell, i) => {
                const dayEvents = eventsByDate[cell.dateStr] || [];
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedDate;
                const hasExpense = dayEvents.some((e) => e.entry_type === "expense");
                const hasIncome = dayEvents.some((e) => e.entry_type === "income");
                const hasProjected = dayEvents.some((e) => e.projected);
                const dayTotal = dayEvents.reduce(
                  (sum, e) => sum + (e.entry_type === "expense" ? -e.amount : e.amount),
                  0
                );

                return (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedDate(cell.dateStr);
                      setShowForm(false);
                    }}
                    className={`relative min-h-[100px] p-2 border-b border-r border-zinc-800/50 text-left transition-colors ${
                      cell.inMonth ? "hover:bg-zinc-800/50" : "bg-zinc-950/50"
                    } ${isSelected ? "bg-blue-600/10 ring-1 ring-blue-500/30" : ""}`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-medium ${
                          isToday
                            ? "bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center"
                            : cell.inMonth
                            ? "text-zinc-300"
                            : "text-zinc-600"
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5">
                          {hasIncome && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                          {hasExpense && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                          {hasProjected && <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                        </div>
                      )}
                    </div>

                    {/* Event pills (show max 3) */}
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((evt, j) => (
                        <div
                          key={j}
                          className={`text-[10px] truncate rounded px-1 py-0.5 ${
                            evt.projected ? "opacity-60 border border-dashed border-zinc-700" : ""
                          }`}
                          style={{
                            backgroundColor: `${CATEGORY_COLORS[evt.category] || "#6b7280"}20`,
                            color: CATEGORY_COLORS[evt.category] || "#6b7280",
                          }}
                        >
                          {evt.entry_type === "expense" ? "-" : "+"}{formatCurrency(evt.amount).replace("THB", "").trim()}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-zinc-500 px-1">+{dayEvents.length - 3} more</p>
                      )}
                    </div>

                    {/* Day total */}
                    {dayEvents.length > 0 && cell.inMonth && (
                      <div className={`absolute bottom-1 right-2 text-[10px] font-medium ${
                        dayTotal >= 0 ? "text-emerald-500/60" : "text-red-500/60"
                      }`}>
                        {dayTotal >= 0 ? "+" : ""}{formatCurrency(dayTotal).replace("THB", "").trim()}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar - Selected Day Detail */}
        <div>
          {selectedDate ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                  })}
                </h2>
                <button
                  onClick={() => { setShowForm(!showForm); }}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  + Add
                </button>
              </div>

              {/* Quick Add Form */}
              {showForm && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setFormType("expense")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        formType === "expense"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      Expense
                    </button>
                    <button
                      onClick={() => setFormType("income")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        formType === "income"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      Income
                    </button>
                  </div>
                  <form onSubmit={handleCreate} className="space-y-2">
                    <input type="hidden" name="date" value={selectedDate} />
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Amount"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <select
                      name="category"
                      required
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      name="description"
                      placeholder="Description (optional)"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <select
                      name="is_recurring"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="">One-time</option>
                      <option value="weekly">Repeats Weekly</option>
                      <option value="monthly">Repeats Monthly</option>
                      <option value="yearly">Repeats Yearly</option>
                    </select>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors text-white ${
                          formType === "income"
                            ? "bg-emerald-600 hover:bg-emerald-500"
                            : "bg-red-600 hover:bg-red-500"
                        }`}
                      >
                        Add {formType === "income" ? "Income" : "Expense"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="px-3 py-2 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Events for selected day */}
              {selectedEvents.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  <p className="text-zinc-500 text-sm">No events on this day</p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="text-blue-400 hover:text-blue-300 text-sm mt-2"
                  >
                    Add a payment or income
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((evt) => {
                    const isIncome = evt.entry_type === "income";
                    const catColor = CATEGORY_COLORS[evt.category] || "#6b7280";
                    return (
                      <div
                        key={`${evt.id}-${evt.date}-${evt.projected}`}
                        className={`bg-zinc-900 border rounded-xl p-4 group ${
                          evt.projected
                            ? "border-dashed border-zinc-700"
                            : "border-zinc-800"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                              style={{ backgroundColor: catColor }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {getCategoryLabel(evt.category)}
                              </p>
                              {evt.description && (
                                <p className="text-xs text-zinc-500 truncate mt-0.5">{evt.description}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {evt.is_recurring && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">
                                    {evt.is_recurring}
                                  </span>
                                )}
                                {evt.projected && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400">
                                    projected
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${isIncome ? "text-emerald-400" : "text-red-400"}`}>
                              {isIncome ? "+" : "-"}{formatCurrency(evt.amount)}
                            </p>
                            {!evt.projected && (
                              <button
                                onClick={() => handleDelete(evt.id)}
                                className="hidden group-hover:block text-[10px] text-red-400 hover:text-red-300 mt-1"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Day total */}
              {selectedEvents.length > 0 && (
                <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Day total</span>
                    <span className={`font-semibold ${
                      selectedEvents.reduce((s, e) => s + (e.entry_type === "expense" ? -e.amount : e.amount), 0) >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}>
                      {formatCurrency(
                        selectedEvents.reduce(
                          (s, e) => s + (e.entry_type === "expense" ? -e.amount : e.amount),
                          0
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Upcoming Payments</h2>
              {events.filter((e) => e.date >= todayStr && e.entry_type === "expense").length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                  <p className="text-zinc-500 text-sm">No upcoming payments</p>
                  <p className="text-zinc-600 text-[11px] mt-1">Click a day to add events</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events
                    .filter((e) => e.date >= todayStr && e.entry_type === "expense")
                    .slice(0, 10)
                    .map((evt, i) => {
                      const catColor = CATEGORY_COLORS[evt.category] || "#6b7280";
                      return (
                        <div
                          key={`${evt.id}-${evt.date}-${i}`}
                          className={`bg-zinc-900 border rounded-xl p-3 cursor-pointer hover:border-zinc-700 transition-colors ${
                            evt.projected ? "border-dashed border-zinc-700" : "border-zinc-800"
                          }`}
                          onClick={() => { setSelectedDate(evt.date); setShowForm(false); }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: catColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {getCategoryLabel(evt.category)}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {new Date(evt.date + "T00:00:00").toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                                {evt.is_recurring && ` · ${evt.is_recurring}`}
                                {evt.projected && " · projected"}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-red-400 shrink-0">
                              -{formatCurrency(evt.amount)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
