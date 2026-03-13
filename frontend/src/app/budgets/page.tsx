"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { budgetsAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { Budget, BudgetComparisonResponse } from "@/types";

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "",
    period_start: new Date().toISOString().split("T")[0],
    period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      .toISOString()
      .split("T")[0],
  });

  const { data: budgets } = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: () => budgetsAPI.list({ active: "true" }) as Promise<Budget[]>,
  });

  const { data: comparison } = useQuery<BudgetComparisonResponse>({
    queryKey: ["budget-comparison"],
    queryFn: () => budgetsAPI.comparison() as Promise<BudgetComparisonResponse>,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => budgetsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-comparison"] });
      setShowForm(false);
      setForm({ name: "", amount: "", category: "", period_start: form.period_start, period_end: form.period_end });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-comparison"] });
    },
  });

  const chartData = comparison?.comparisons.map((c) => ({
    category: c.category,
    Budget: c.budget_amount,
    Actual: c.actual_spent,
    over: c.over_budget,
  })) ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name,
      amount: parseFloat(form.amount),
      category: form.category,
      period_start: form.period_start,
      period_end: form.period_end,
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget Management</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Track your spending against budget limits
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> Add Budget
        </button>
      </div>

      {/* Create Budget Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <input
            placeholder="Budget name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-sm"
          />
          <input
            type="number"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            min="0"
            step="0.01"
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-sm"
          />
          <input
            placeholder="Category (e.g. food)"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            required
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-sm"
          />
          <input
            type="date"
            value={form.period_start}
            onChange={(e) => setForm({ ...form, period_start: e.target.value })}
            className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:opacity-90"
          >
            Save
          </button>
        </form>
      )}

      {/* Summary Cards */}
      {comparison && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Total Budgeted</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(comparison.total_budgeted)}</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Total Spent</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(comparison.total_spent)}</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${comparison.total_budgeted - comparison.total_spent >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(comparison.total_budgeted - comparison.total_spent)}
            </p>
          </div>
        </div>
      )}

      {/* Budget vs Actual Chart */}
      {chartData.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">Budget vs Actual Spending</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="Budget" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Actual" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.over ? "#EF4444" : "#22C55E"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Budget List with Progress */}
      {comparison && comparison.comparisons.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold">Budget Details</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {comparison.comparisons.map((c) => (
              <div key={c.category} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">{c.category}</span>
                    {c.over_budget && (
                      <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                        <AlertTriangle size={12} /> Over budget
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">
                    {formatCurrency(c.actual_spent)} / {formatCurrency(c.budget_amount)}
                  </span>
                </div>
                <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${c.over_budget ? "bg-red-500" : c.usage_percent > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(c.usage_percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-[var(--text-muted)]">{c.usage_percent}% used</span>
                  <span className={`text-xs font-medium ${c.remaining >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {c.remaining >= 0 ? `${formatCurrency(c.remaining)} left` : `${formatCurrency(Math.abs(c.remaining))} over`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Budgets Table */}
      {budgets && budgets.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold">Active Budgets</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Period</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]">
                  <td className="px-4 py-3 text-sm">{b.name}</td>
                  <td className="px-4 py-3 text-sm capitalize">{b.category}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(b.amount)}</td>
                  <td className="px-4 py-3 text-sm text-right text-[var(--text-muted)]">
                    {b.period_start} - {b.period_end}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteMutation.mutate(b.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(!budgets || budgets.length === 0) && !showForm && (
        <div className="bg-[var(--bg-card)] rounded-xl p-10 border border-[var(--border)] text-center">
          <p className="text-[var(--text-muted)]">No budgets set yet. Click &quot;Add Budget&quot; to get started.</p>
        </div>
      )}
    </div>
  );
}
