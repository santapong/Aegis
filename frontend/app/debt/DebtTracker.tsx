"use client";

import { useEffect, useState } from "react";

interface Debt {
  id: number;
  name: string;
  creditor: string | null;
  principal: number;
  interest_rate: number;
  minimum_payment: number;
  current_balance: number;
  due_day: number | null;
  start_date: string | null;
  color: string | null;
  status: string | null;
  created_at: string | null;
}

interface DebtSummary {
  total_debt: number;
  total_minimum_payment: number;
  weighted_avg_rate: number;
  debt_count: number;
  estimated_payoff_months: number;
}

interface PayoffDebt {
  id: number;
  name: string;
  payoff_month: number;
}

interface TimelineEntry {
  month: number;
  total_remaining: number;
}

interface PayoffPlan {
  strategy: string;
  extra_payment: number;
  total_months: number;
  total_interest_paid: number;
  debts: PayoffDebt[];
  timeline: TimelineEntry[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DebtTracker() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [payoffPlan, setPayoffPlan] = useState<PayoffPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");
  const [extraPayment, setExtraPayment] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [debtsRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/debts/`),
        fetch(`${API_URL}/api/debts/summary`),
      ]);
      const [debtsData, summaryData] = await Promise.all([
        debtsRes.json(),
        summaryRes.json(),
      ]);
      setDebts(debtsData);
      setSummary(summaryData);
    } catch (err) {
      console.error("Failed to fetch debt data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayoffPlan = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/debts/payoff-plan?strategy=${strategy}&extra=${extraPayment}`
      );
      const data = await res.json();
      setPayoffPlan(data);
    } catch (err) {
      console.error("Failed to fetch payoff plan:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (debts.length > 0) {
      fetchPayoffPlan();
    }
  }, [strategy, extraPayment, debts.length]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      name: fd.get("name"),
      creditor: fd.get("creditor") || null,
      principal: Number(fd.get("principal")),
      interest_rate: Number(fd.get("interest_rate")),
      minimum_payment: Number(fd.get("minimum_payment")),
      current_balance: Number(fd.get("current_balance")),
      due_day: fd.get("due_day") ? Number(fd.get("due_day")) : null,
      start_date: fd.get("start_date") || null,
      color: fd.get("color") || null,
    };
    await fetch(`${API_URL}/api/debts/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDebt) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      name: fd.get("name"),
      creditor: fd.get("creditor") || null,
      principal: Number(fd.get("principal")),
      interest_rate: Number(fd.get("interest_rate")),
      minimum_payment: Number(fd.get("minimum_payment")),
      current_balance: Number(fd.get("current_balance")),
      due_day: fd.get("due_day") ? Number(fd.get("due_day")) : null,
      start_date: fd.get("start_date") || null,
      color: fd.get("color") || null,
    };
    await fetch(`${API_URL}/api/debts/${editingDebt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingDebt(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/api/debts/${id}`, { method: "DELETE" });
    fetchData();
  };

  if (loading && debts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading debts...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Debt Tracker</h1>
          <p className="text-sm text-zinc-500 mt-1">Track and plan your debt payoff</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingDebt(null);
          }}
          className="btn-premium bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Debt
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Debt</p>
            <p className="financial-number text-2xl mt-2 text-red-400">
              {formatCurrency(summary.total_debt)}
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Monthly Minimum</p>
            <p className="financial-number text-2xl mt-2 text-white">
              {formatCurrency(summary.total_minimum_payment)}
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Avg Interest Rate</p>
            <p className="financial-number text-2xl mt-2 text-amber-400">
              {summary.weighted_avg_rate.toFixed(1)}%
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Est. Payoff</p>
            <p className="financial-number text-2xl mt-2 text-cyan-400">
              {summary.estimated_payoff_months} <span className="text-sm font-normal text-zinc-500">months</span>
            </p>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {(showForm || editingDebt) && (
        <div className={`card-premium p-5 mb-6 animate-fade-in ${editingDebt ? "border-blue-500/30" : ""}`}>
          <p className="text-sm font-medium mb-4 text-white">
            {editingDebt ? "Edit Debt" : "Add New Debt"}
          </p>
          <form
            onSubmit={editingDebt ? handleUpdate : handleCreate}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
          >
            <input
              name="name"
              placeholder="Debt name"
              required
              defaultValue={editingDebt?.name || ""}
              className="input-premium"
            />
            <input
              name="creditor"
              placeholder="Creditor (optional)"
              defaultValue={editingDebt?.creditor || ""}
              className="input-premium"
            />
            <input
              name="principal"
              type="number"
              step="0.01"
              min="0"
              placeholder="Principal amount"
              required
              defaultValue={editingDebt?.principal || ""}
              className="input-premium"
            />
            <input
              name="interest_rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              placeholder="Interest rate %"
              required
              defaultValue={editingDebt?.interest_rate || ""}
              className="input-premium"
            />
            <input
              name="minimum_payment"
              type="number"
              step="0.01"
              min="0"
              placeholder="Min. payment"
              required
              defaultValue={editingDebt?.minimum_payment || ""}
              className="input-premium"
            />
            <input
              name="current_balance"
              type="number"
              step="0.01"
              min="0"
              placeholder="Current balance"
              required
              defaultValue={editingDebt?.current_balance || ""}
              className="input-premium"
            />
            <input
              name="due_day"
              type="number"
              min="1"
              max="31"
              placeholder="Due day (1-31)"
              defaultValue={editingDebt?.due_day || ""}
              className="input-premium"
            />
            <input
              name="start_date"
              type="date"
              defaultValue={editingDebt?.start_date || ""}
              className="input-premium"
            />
            <input
              name="color"
              type="color"
              defaultValue={editingDebt?.color || DEFAULT_COLORS[debts.length % DEFAULT_COLORS.length]}
              className="input-premium h-[38px] w-full cursor-pointer p-1"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-premium flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {editingDebt ? "Save" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingDebt(null);
                }}
                className="px-3 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debt Cards */}
      {debts.length === 0 ? (
        <div className="card-premium p-12 text-center mb-8">
          <p className="text-zinc-500 text-lg">No debts tracked yet</p>
          <p className="text-zinc-600 text-sm mt-1">Click &quot;+ Add Debt&quot; to start tracking</p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {debts.map((debt) => {
            const paidOff = debt.principal > 0 ? ((debt.principal - debt.current_balance) / debt.principal) * 100 : 0;
            const clampedPaidOff = Math.max(0, Math.min(100, paidOff));
            const dotColor = debt.color || DEFAULT_COLORS[debt.id % DEFAULT_COLORS.length];
            const isActive = debt.status === "active" || !debt.status;

            return (
              <div
                key={debt.id}
                className="card-premium px-5 py-4 group"
              >
                <div className="flex items-center gap-4">
                  {/* Color dot */}
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />

                  {/* Name & Creditor */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{debt.name}</p>
                      {/* Status badge */}
                      {debt.status && debt.status !== "active" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">
                          {debt.status}
                        </span>
                      )}
                    </div>
                    {debt.creditor && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">{debt.creditor}</p>
                    )}
                  </div>

                  {/* Interest Rate Badge */}
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-500/15 text-amber-400 shrink-0">
                    {debt.interest_rate}% APR
                  </span>

                  {/* Due Day Badge */}
                  {debt.due_day && (
                    <span className="text-xs font-medium px-2 py-1 rounded-md bg-zinc-800 text-zinc-400 shrink-0">
                      Due: {debt.due_day}th
                    </span>
                  )}

                  {/* Balance / Principal */}
                  <div className="text-right shrink-0 min-w-[140px]">
                    <p className="financial-number text-sm text-red-400">
                      {formatCurrency(debt.current_balance)}
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      of {formatCurrency(debt.principal)}
                    </p>
                  </div>

                  {/* Actions (hover) */}
                  <div className="hidden group-hover:flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingDebt(debt);
                        setShowForm(false);
                      }}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-400"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(debt.id)}
                      className="text-xs bg-red-900/50 hover:bg-red-800 px-2 py-1 rounded text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-zinc-500">{clampedPaidOff.toFixed(1)}% paid off</span>
                    <span className="text-zinc-600 financial-number">
                      {formatCurrency(debt.principal - debt.current_balance)} paid
                    </span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                      style={{ width: `${clampedPaidOff}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Payoff Planner */}
      {debts.length > 0 && (
        <div className="card-premium p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Payoff Planner</h2>

          {/* Strategy Toggle & Extra Payment */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-sm">
              <button
                onClick={() => setStrategy("avalanche")}
                className={`px-4 py-2 font-medium transition-colors ${
                  strategy === "avalanche"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                Avalanche
              </button>
              <button
                onClick={() => setStrategy("snowball")}
                className={`px-4 py-2 font-medium transition-colors ${
                  strategy === "snowball"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                Snowball
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400">Extra monthly payment:</label>
              <input
                type="number"
                min="0"
                step="100"
                value={extraPayment}
                onChange={(e) => setExtraPayment(Number(e.target.value))}
                className="input-premium w-32"
              />
            </div>
          </div>

          {/* Strategy description */}
          <p className="text-xs text-zinc-500 mb-6">
            {strategy === "avalanche"
              ? "Avalanche: Pay highest interest rate first. Saves the most money overall."
              : "Snowball: Pay smallest balance first. Builds momentum with quick wins."}
          </p>

          {payoffPlan && (
            <>
              {/* Payoff Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Months</p>
                  <p className="financial-number text-xl mt-1 text-white">
                    {payoffPlan.total_months}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Interest</p>
                  <p className="financial-number text-xl mt-1 text-red-400">
                    {formatCurrency(payoffPlan.total_interest_paid)}
                  </p>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Extra Payment</p>
                  <p className="financial-number text-xl mt-1 text-cyan-400">
                    {formatCurrency(payoffPlan.extra_payment)}
                  </p>
                </div>
              </div>

              {/* Per-Debt Payoff Schedule */}
              <div className="space-y-2 mb-6">
                <p className="text-sm font-medium text-zinc-300 mb-2">Payoff Order</p>
                {payoffPlan.debts.map((d, i) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 bg-zinc-800/30 rounded-lg px-4 py-2.5"
                  >
                    <span className="text-xs font-bold text-zinc-500 w-6">{i + 1}</span>
                    <span className="text-sm text-white flex-1">{d.name}</span>
                    <span className="text-xs text-zinc-400">
                      Month <span className="financial-number text-cyan-400">{d.payoff_month}</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline Bar Chart */}
              {payoffPlan.timeline.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-zinc-300 mb-3">Remaining Balance Over Time</p>
                  <div className="flex items-end gap-[2px] h-32">
                    {(() => {
                      const maxRemaining = Math.max(
                        ...payoffPlan.timeline.map((t) => t.total_remaining),
                        1
                      );
                      const barCount = payoffPlan.timeline.length;
                      const step = barCount > 60 ? Math.ceil(barCount / 60) : 1;
                      const sampled = payoffPlan.timeline.filter((_, i) => i % step === 0);

                      return sampled.map((t) => {
                        const pct = (t.total_remaining / maxRemaining) * 100;
                        return (
                          <div
                            key={t.month}
                            className="flex-1 min-w-[3px] rounded-t bg-gradient-to-t from-blue-500 to-cyan-500 transition-all duration-300 relative group/bar"
                            style={{ height: `${Math.max(pct, 1)}%` }}
                          >
                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/bar:block bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-[10px] text-white whitespace-nowrap z-10">
                              Month {t.month}: {formatCurrency(t.total_remaining)}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
                    <span>Month 1</span>
                    <span>Month {payoffPlan.timeline[payoffPlan.timeline.length - 1]?.month}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
