"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { transactionsAPI, dashboardAPI } from "@/lib/api";
import { SpendingChart } from "@/components/charts/spending-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { Download, Filter } from "lucide-react";

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  const { data: summary } = useQuery({
    queryKey: ["transaction-summary", dateRange],
    queryFn: () => transactionsAPI.summary(dateRange.start, dateRange.end),
  });

  const { data: charts } = useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: dashboardAPI.charts,
  });

  const categoryData = summary
    ? Object.entries(summary.by_category).map(([label, value]) => ({
        label,
        value,
        color: null as string | null,
      }))
    : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Detailed financial summaries and charts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm"
            />
            <span className="text-[var(--text-muted)]">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--bg-secondary)]">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Total Income</p>
            <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(summary.total_income)}</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(summary.total_expenses)}</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Net Savings</p>
            <p className={`text-2xl font-bold mt-1 ${summary.net >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(summary.net)}
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
          <SpendingChart data={categoryData} />
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">Income vs Expenses</h2>
          <TrendChart data={charts?.monthly_trend ?? []} />
        </div>
      </div>

      {/* Category breakdown table */}
      {summary && Object.keys(summary.by_category).length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold">Category Breakdown</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => (
                  <tr key={category} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]">
                    <td className="px-4 py-3 text-sm capitalize">{category}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(amount)}</td>
                    <td className="px-4 py-3 text-sm text-right text-[var(--text-muted)]">
                      {((amount / (summary.total_income + summary.total_expenses)) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
