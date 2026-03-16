"use client";

import { useEffect, useState } from "react";

interface BudgetEntry {
  id: number;
  entry_type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  date: string;
  is_recurring: string | null;
  created_at: string | null;
}

interface MonthlySummary {
  month: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  income_by_category: Record<string, number>;
  expense_by_category: Record<string, number>;
  entry_count: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

function formatMonth(monthStr: string) {
  const [y, m] = monthStr.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetTracker() {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"income" | "expense">("expense");
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const entryParams = new URLSearchParams({ month: selectedMonth });
      if (filterType !== "all") entryParams.set("entry_type", filterType);

      const [entriesRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/budget/?${entryParams}`),
        fetch(`${API_URL}/api/budget/summary?month=${selectedMonth}`),
      ]);
      const [entriesData, summaryData] = await Promise.all([
        entriesRes.json(),
        summaryRes.json(),
      ]);
      setEntries(entriesData);
      setSummary(summaryData);
    } catch (err) {
      console.error("Failed to fetch budget data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, filterType]);

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

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEntry) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      entry_type: fd.get("entry_type"),
      amount: Number(fd.get("amount")),
      category: fd.get("category"),
      description: fd.get("description") || null,
      date: fd.get("date"),
      is_recurring: fd.get("is_recurring") || null,
    };
    await fetch(`${API_URL}/api/budget/${editingEntry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingEntry(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/api/budget/${id}`, { method: "DELETE" });
    fetchData();
  };

  const categories = formType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  if (loading && entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading budget...
        </div>
      </div>
    );
  }

  const expenseEntries = Object.entries(summary?.expense_by_category || {}).sort(
    (a, b) => b[1] - a[1]
  );
  const incomeEntries = Object.entries(summary?.income_by_category || {}).sort(
    (a, b) => b[1] - a[1]
  );
  const maxExpense = expenseEntries.length > 0 ? expenseEntries[0][1] : 1;
  const maxIncome = incomeEntries.length > 0 ? incomeEntries[0][1] : 1;
  const incomeExpenseMax = Math.max(summary?.total_income || 0, summary?.total_expenses || 0, 1);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Budget Tracker</h1>
          <p className="text-sm text-zinc-500 mt-1">Track your income and expenses</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingEntry(null); }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Income</p>
            <p className="text-2xl font-bold mt-2 text-emerald-400">{formatCurrency(summary.total_income)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Expenses</p>
            <p className="text-2xl font-bold mt-2 text-red-400">{formatCurrency(summary.total_expenses)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Net Savings</p>
            <p className={`text-2xl font-bold mt-2 ${summary.net_savings >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(summary.net_savings)}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Savings Rate</p>
            <p className="text-2xl font-bold mt-2 text-amber-400">{summary.savings_rate}%</p>
          </div>
        </div>
      )}

      {/* Income vs Expense Bar */}
      {summary && (summary.total_income > 0 || summary.total_expenses > 0) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-white mb-4">{formatMonth(selectedMonth)} Overview</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-emerald-400 font-medium">Income</span>
                <span className="text-white font-medium">{formatCurrency(summary.total_income)}</span>
              </div>
              <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(summary.total_income / incomeExpenseMax) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-400 font-medium">Expenses</span>
                <span className="text-white font-medium">{formatCurrency(summary.total_expenses)}</span>
              </div>
              <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-500"
                  style={{ width: `${(summary.total_expenses / incomeExpenseMax) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {summary && (expenseEntries.length > 0 || incomeEntries.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Expense Breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Expense Breakdown</h2>
            {expenseEntries.length === 0 ? (
              <p className="text-sm text-zinc-500">No expenses this month</p>
            ) : (
              <div className="space-y-3">
                {expenseEntries.map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">{getCategoryLabel(cat)}</span>
                      <span className="text-zinc-400 font-medium">{formatCurrency(amount)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(amount / maxExpense) * 100}%`,
                          backgroundColor: CATEGORY_COLORS[cat] || "#6b7280",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Income Breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Income Breakdown</h2>
            {incomeEntries.length === 0 ? (
              <p className="text-sm text-zinc-500">No income this month</p>
            ) : (
              <div className="space-y-3">
                {incomeEntries.map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">{getCategoryLabel(cat)}</span>
                      <span className="text-zinc-400 font-medium">{formatCurrency(amount)}</span>
                    </div>
                    <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(amount / maxIncome) * 100}%`,
                          backgroundColor: CATEGORY_COLORS[cat] || "#6b7280",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Entry Form */}
      {showForm && !editingEntry && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setFormType("expense")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                formType === "expense"
                  ? "bg-red-500/15 text-red-400"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Expense
            </button>
            <button
              onClick={() => setFormType("income")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                formType === "income"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Income
            </button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount"
              required
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <select
              name="category"
              required
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              name="description"
              placeholder="Description (optional)"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              name="date"
              type="date"
              required
              defaultValue={new Date().toISOString().split("T")[0]}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <select
              name="is_recurring"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Not recurring</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                className={`flex-1 rounded-lg text-sm font-medium transition-colors ${
                  formType === "income"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500"
                } text-white`}
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-3 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Entry Form */}
      {editingEntry && (
        <div className="bg-zinc-900 border border-blue-500/30 rounded-xl p-5 mb-6">
          <p className="text-sm font-medium text-blue-400 mb-4">Editing entry</p>
          <form onSubmit={handleUpdate} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input type="hidden" name="entry_type" value={editingEntry.entry_type} />
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={editingEntry.amount}
              required
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <select
              name="category"
              defaultValue={editingEntry.category}
              required
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {(editingEntry.entry_type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              name="description"
              defaultValue={editingEntry.description || ""}
              placeholder="Description"
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              name="date"
              type="date"
              defaultValue={editingEntry.date}
              required
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <select
              name="is_recurring"
              defaultValue={editingEntry.is_recurring || ""}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Not recurring</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="px-3 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs + Entries List */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Entries</h2>
        <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-sm">
          {(["all", "income", "expense"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 capitalize ${
                filterType === t ? "bg-zinc-700 text-white" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-lg">No entries for {formatMonth(selectedMonth)}</p>
          <p className="text-zinc-600 text-sm mt-1">Click &quot;+ Add Entry&quot; to start tracking</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isIncome = entry.entry_type === "income";
            const catColor = CATEGORY_COLORS[entry.category] || "#6b7280";
            return (
              <div
                key={entry.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-3.5 flex items-center gap-4 hover:border-zinc-700 transition-colors group"
              >
                {/* Category indicator */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: catColor }}
                />

                {/* Category & Description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">
                      {getCategoryLabel(entry.category)}
                    </p>
                    {entry.is_recurring && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 shrink-0">
                        {entry.is_recurring}
                      </span>
                    )}
                  </div>
                  {entry.description && (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{entry.description}</p>
                  )}
                </div>

                {/* Date */}
                <p className="text-xs text-zinc-500 shrink-0">
                  {new Date(entry.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>

                {/* Amount */}
                <p
                  className={`text-sm font-semibold shrink-0 min-w-[100px] text-right ${
                    isIncome ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {isIncome ? "+" : "-"}{formatCurrency(entry.amount)}
                </p>

                {/* Actions */}
                <div className="hidden group-hover:flex gap-1 shrink-0">
                  <button
                    onClick={() => { setEditingEntry(entry); setShowForm(false); }}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-400"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-xs bg-red-900/50 hover:bg-red-800 px-2 py-1 rounded text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
