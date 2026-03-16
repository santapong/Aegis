"use client";

import { useEffect, useState } from "react";

interface Bill {
  id: number;
  name: string;
  amount: number;
  category: string;
  due_day: number;
  frequency: string;
  is_active: boolean;
  last_paid_date: string | null;
  next_due_date: string;
  notes: string | null;
  created_at: string;
  is_overdue?: boolean;
}

interface BillSummary {
  monthly_total: number;
  active_count: number;
  overdue_count: number;
  next_bill: { name: string; next_due_date: string } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BILL_CATEGORIES = [
  { value: "food", label: "Food & Dining" },
  { value: "transport", label: "Transport" },
  { value: "housing", label: "Housing & Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "insurance", label: "Insurance" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "other_expense", label: "Other" },
];

const CATEGORY_COLORS: Record<string, string> = {
  food: "#ef4444",
  transport: "#f59e0b",
  housing: "#3b82f6",
  utilities: "#8b5cf6",
  entertainment: "#ec4899",
  shopping: "#f97316",
  healthcare: "#14b8a6",
  education: "#6366f1",
  insurance: "#64748b",
  subscriptions: "#a855f7",
  other_expense: "#6b7280",
};

const FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

function getCategoryLabel(value: string): string {
  return BILL_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function getFrequencyLabel(value: string): string {
  return FREQUENCIES.find((f) => f.value === value)?.label || value;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDueCountdown(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `In ${days} days`;
}

function getDueColor(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days <= 3) return "bg-red-500/15 text-red-400";
  if (days <= 7) return "bg-amber-500/15 text-amber-400";
  return "bg-zinc-500/15 text-zinc-400";
}

export default function BillReminders() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [upcoming, setUpcoming] = useState<(Bill & { is_overdue: boolean })[]>([]);
  const [summary, setSummary] = useState<BillSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [billsRes, upcomingRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/bills/`),
        fetch(`${API_URL}/api/bills/upcoming?days=30`),
        fetch(`${API_URL}/api/bills/summary`),
      ]);
      const [billsData, upcomingData, summaryData] = await Promise.all([
        billsRes.json(),
        upcomingRes.json(),
        summaryRes.json(),
      ]);
      setBills(billsData);
      setUpcoming(upcomingData);
      setSummary(summaryData);
    } catch (err) {
      console.error("Failed to fetch bills data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      name: fd.get("name"),
      amount: Number(fd.get("amount")),
      category: fd.get("category"),
      due_day: Number(fd.get("due_day")),
      frequency: fd.get("frequency"),
      notes: fd.get("notes") || null,
    };
    await fetch(`${API_URL}/api/bills/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBill) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      name: fd.get("name"),
      amount: Number(fd.get("amount")),
      category: fd.get("category"),
      due_day: Number(fd.get("due_day")),
      frequency: fd.get("frequency"),
      notes: fd.get("notes") || null,
    };
    await fetch(`${API_URL}/api/bills/${editingBill.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingBill(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/api/bills/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleMarkPaid = async (id: number) => {
    await fetch(`${API_URL}/api/bills/${id}/pay`, { method: "POST" });
    fetchData();
  };

  const overdueBills = upcoming.filter((b) => b.is_overdue);

  if (loading && bills.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading bills...
        </div>
      </div>
    );
  }

  const activeBills = bills.filter((b) => b.is_active);
  const inactiveBills = bills.filter((b) => !b.is_active);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Bill Reminders</h1>
          <p className="text-sm text-zinc-500 mt-1">Never miss a payment</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingBill(null);
          }}
          className="btn-premium bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Bill
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Monthly Total</p>
            <p className="financial-number text-2xl mt-2 text-blue-400">
              {formatCurrency(summary.monthly_total)}
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Active Bills</p>
            <p className="text-2xl font-bold mt-2 text-white">{summary.active_count}</p>
          </div>
          <div
            className={`card-premium p-5 ${
              summary.overdue_count > 0
                ? "!border-red-500/20 !bg-red-500/5"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Overdue</p>
              {summary.overdue_count > 0 && (
                <span className="animate-glow-pulse bg-red-500 w-2 h-2 rounded-full" />
              )}
            </div>
            <p
              className={`text-2xl font-bold mt-2 ${
                summary.overdue_count > 0 ? "text-red-400" : "text-white"
              }`}
            >
              {summary.overdue_count}
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Next Due</p>
            {summary.next_bill ? (
              <div className="mt-2">
                <p className="text-sm font-semibold text-white truncate">{summary.next_bill.name}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {formatDueCountdown(summary.next_bill.next_due_date)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 mt-2">No upcoming bills</p>
            )}
          </div>
        </div>
      )}

      {/* Overdue Alerts */}
      {overdueBills.length > 0 && (
        <div className="card-premium !bg-red-500/5 !border-red-500/20 p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="animate-glow-pulse bg-red-500 w-2 h-2 rounded-full" />
            <h2 className="text-sm font-semibold text-red-400">Overdue Bills</h2>
          </div>
          <div className="space-y-3">
            {overdueBills.map((bill) => {
              const daysOverdue = Math.abs(daysUntil(bill.next_due_date));
              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between gap-4 bg-red-500/5 border border-red-500/10 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: CATEGORY_COLORS[bill.category] || "#6b7280",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{bill.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="financial-number text-sm text-red-400">
                      {formatCurrency(bill.amount)}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                      {daysOverdue} days overdue
                    </span>
                    <button
                      onClick={() => handleMarkPaid(bill.id)}
                      className="bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg px-3 py-1 font-medium transition-colors"
                    >
                      Pay Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      {(showForm || editingBill) && (
        <div className="card-premium p-5 mb-8 animate-fade-in">
          <p className="text-sm font-semibold text-white mb-4">
            {editingBill ? "Edit Bill" : "Add New Bill"}
          </p>
          <form
            onSubmit={editingBill ? handleUpdate : handleCreate}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name</label>
              <input
                name="name"
                required
                defaultValue={editingBill?.name || ""}
                placeholder="e.g. Netflix, Rent, Electric"
                className="input-premium w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Amount (THB)</label>
              <input
                name="amount"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={editingBill?.amount || ""}
                placeholder="0"
                className="input-premium w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Category</label>
              <select
                name="category"
                required
                defaultValue={editingBill?.category || ""}
                className="input-premium w-full"
              >
                <option value="">Select category</option>
                {BILL_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Due Day (1-31)</label>
              <input
                name="due_day"
                type="number"
                min="1"
                max="31"
                required
                defaultValue={editingBill?.due_day || ""}
                placeholder="15"
                className="input-premium w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Frequency</label>
              <select
                name="frequency"
                required
                defaultValue={editingBill?.frequency || "monthly"}
                className="input-premium w-full"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Notes (optional)</label>
              <textarea
                name="notes"
                rows={1}
                defaultValue={editingBill?.notes || ""}
                placeholder="Additional details..."
                className="input-premium w-full resize-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3 pt-2">
              <button
                type="submit"
                className="btn-premium bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {editingBill ? "Save Changes" : "Add Bill"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingBill(null);
                }}
                className="px-4 py-2 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming Bills */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Upcoming Bills</h2>
          <div className="card-premium divide-y divide-zinc-800">
            {upcoming
              .filter((b) => !b.is_overdue)
              .map((bill) => {
                const catColor = CATEGORY_COLORS[bill.category] || "#71717a";
                const dueColorClass = getDueColor(bill.next_due_date);

                return (
                  <div
                    key={bill.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800/50 transition-colors group"
                  >
                    {/* Category dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: catColor }}
                    />

                    {/* Name + notes */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{bill.name}</p>
                      {bill.notes && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{bill.notes}</p>
                      )}
                    </div>

                    {/* Amount */}
                    <span className="financial-number text-sm text-white shrink-0">
                      {formatCurrency(bill.amount)}
                    </span>

                    {/* Due countdown */}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${dueColorClass}`}
                    >
                      {formatDueCountdown(bill.next_due_date)}
                    </span>

                    {/* Frequency */}
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 shrink-0">
                      {getFrequencyLabel(bill.frequency)}
                    </span>

                    {/* Mark Paid */}
                    <button
                      onClick={() => handleMarkPaid(bill.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg px-3 py-1 font-medium transition-colors shrink-0"
                    >
                      Mark Paid
                    </button>

                    {/* Edit / Delete */}
                    <div className="hidden group-hover:flex gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setEditingBill(bill);
                          setShowForm(false);
                        }}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-400 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(bill.id)}
                        className="text-xs bg-red-900/50 hover:bg-red-800 px-2 py-1 rounded text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* All Bills */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">All Bills</h2>

        {bills.length === 0 ? (
          <div className="card-premium p-12 text-center">
            <p className="text-zinc-500 text-lg">No bills yet</p>
            <p className="text-zinc-600 text-sm mt-1">
              Click &quot;+ Add Bill&quot; to start tracking your recurring payments
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Active Bills */}
            {activeBills.map((bill) => {
              const catColor = CATEGORY_COLORS[bill.category] || "#71717a";
              return (
                <div
                  key={bill.id}
                  className="card-premium px-5 py-3.5 flex items-center gap-4 group"
                >
                  {/* Category dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: catColor }}
                  />

                  {/* Name + notes */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{bill.name}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">
                        Active
                      </span>
                    </div>
                    {bill.notes && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{bill.notes}</p>
                    )}
                  </div>

                  {/* Category label */}
                  <span className="text-xs text-zinc-500 shrink-0">
                    {getCategoryLabel(bill.category)}
                  </span>

                  {/* Due day */}
                  <span className="text-xs text-zinc-500 shrink-0">Day {bill.due_day}</span>

                  {/* Frequency */}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 shrink-0">
                    {getFrequencyLabel(bill.frequency)}
                  </span>

                  {/* Amount */}
                  <span className="financial-number text-sm text-white shrink-0 min-w-[100px] text-right">
                    {formatCurrency(bill.amount)}
                  </span>

                  {/* Mark Paid */}
                  <button
                    onClick={() => handleMarkPaid(bill.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg px-3 py-1 font-medium transition-colors shrink-0"
                  >
                    Mark Paid
                  </button>

                  {/* Edit / Delete */}
                  <div className="hidden group-hover:flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingBill(bill);
                        setShowForm(false);
                      }}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-400 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(bill.id)}
                      className="text-xs bg-red-900/50 hover:bg-red-800 px-2 py-1 rounded text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Inactive Bills */}
            {inactiveBills.map((bill) => {
              const catColor = CATEGORY_COLORS[bill.category] || "#71717a";
              return (
                <div
                  key={bill.id}
                  className="card-premium px-5 py-3.5 flex items-center gap-4 opacity-50 group"
                >
                  {/* Category dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: catColor }}
                  />

                  {/* Name + notes */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{bill.name}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 shrink-0">
                        Inactive
                      </span>
                    </div>
                    {bill.notes && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{bill.notes}</p>
                    )}
                  </div>

                  {/* Category label */}
                  <span className="text-xs text-zinc-500 shrink-0">
                    {getCategoryLabel(bill.category)}
                  </span>

                  {/* Due day */}
                  <span className="text-xs text-zinc-500 shrink-0">Day {bill.due_day}</span>

                  {/* Frequency */}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-500/15 text-zinc-400 shrink-0">
                    {getFrequencyLabel(bill.frequency)}
                  </span>

                  {/* Amount */}
                  <span className="financial-number text-sm text-white shrink-0 min-w-[100px] text-right">
                    {formatCurrency(bill.amount)}
                  </span>

                  {/* Edit / Delete */}
                  <div className="hidden group-hover:flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingBill(bill);
                        setShowForm(false);
                      }}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-400 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(bill.id)}
                      className="text-xs bg-red-900/50 hover:bg-red-800 px-2 py-1 rounded text-red-300 transition-colors"
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
    </div>
  );
}
