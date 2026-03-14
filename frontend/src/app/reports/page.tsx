"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { transactionsAPI, dashboardAPI, reportsAPI } from "@/lib/api";
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
import { Download, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { CategoryComparisonMonth } from "@/types";

const CATEGORY_COLORS = [
  "#EF4444", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#6366F1", "#10B981", "#6B7280",
];

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

  const { data: categoryComparison } = useQuery<CategoryComparisonMonth[]>({
    queryKey: ["category-comparison"],
    queryFn: () => reportsAPI.categoryComparison(6) as Promise<CategoryComparisonMonth[]>,
  });

  const categoryData = summary
    ? Object.entries(summary.by_category).map(([label, value]) => ({
        label,
        value,
        color: null as string | null,
      }))
    : [];

  // Build grouped bar chart data from category comparison
  const allCategories = useMemo(() => {
    if (!categoryComparison) return [];
    const cats = new Set<string>();
    categoryComparison.forEach((m) => {
      Object.keys(m.categories).forEach((c) => cats.add(c));
    });
    return Array.from(cats);
  }, [categoryComparison]);

  const comparisonChartData = useMemo(() => {
    if (!categoryComparison) return [];
    return categoryComparison.map((m) => {
      const row: Record<string, string | number> = { month: m.month };
      allCategories.forEach((cat) => {
        row[cat] = m.categories[cat] || 0;
      });
      return row;
    });
  }, [categoryComparison, allCategories]);

  const handleExport = () => {
    const url = reportsAPI.exportCSV(dateRange.start, dateRange.end);
    window.open(url as unknown as string, "_blank");
  };

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
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--bg-secondary)]"
          >
            <Download size={14} /> Export CSV
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

      {/* Monthly Category Comparison Chart */}
      {comparisonChartData.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">Monthly Category Comparison</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={comparisonChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              {allCategories.map((cat, i) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                  radius={[2, 2, 0, 0]}
                  name={cat.charAt(0).toUpperCase() + cat.slice(1)}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Month-over-Month Changes Table */}
      {categoryComparison && categoryComparison.length > 1 && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold">Month-over-Month Changes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Category</th>
                  {categoryComparison.map((m) => (
                    <th key={m.month} className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">{m.month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allCategories.map((cat) => (
                  <tr key={cat} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]">
                    <td className="px-4 py-3 text-sm font-medium capitalize">{cat}</td>
                    {categoryComparison.map((m, i) => {
                      const amount = m.categories[cat] || 0;
                      const change = i > 0 ? m.changes?.[cat] : undefined;
                      return (
                        <td key={m.month} className="px-4 py-3 text-sm text-right">
                          <div>{formatCurrency(amount)}</div>
                          {change !== undefined && change !== null && (
                            <div className={`flex items-center justify-end gap-0.5 text-xs ${change > 0 ? "text-red-500" : change < 0 ? "text-green-500" : "text-[var(--text-muted)]"}`}>
                              {change > 0 ? <ArrowUp size={10} /> : change < 0 ? <ArrowDown size={10} /> : <Minus size={10} />}
                              {Math.abs(change)}%
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
