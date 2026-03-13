"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardAPI } from "@/lib/api";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { SpendingChart } from "@/components/charts/spending-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { AIPanel } from "@/components/ai/ai-panel";
import { Sparkles } from "lucide-react";
import { useAppStore } from "@/stores/app-store";

export default function DashboardPage() {
  const { toggleAIPanel } = useAppStore();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardAPI.summary,
  });

  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ["dashboard-charts"],
    queryFn: dashboardAPI.charts,
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Overview of your financial health
          </p>
        </div>
        <button
          onClick={toggleAIPanel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-medium hover:opacity-90 shadow-md"
        >
          <Sparkles size={16} /> AI Insights
        </button>
      </div>

      {/* KPI Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : summary ? (
        <KPICards data={summary} />
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
          {chartsLoading ? (
            <div className="h-[300px] animate-pulse bg-[var(--bg-secondary)] rounded-lg" />
          ) : (
            <SpendingChart data={charts?.spending_by_category ?? []} />
          )}
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h2 className="text-lg font-semibold mb-4">Monthly Trend</h2>
          {chartsLoading ? (
            <div className="h-[300px] animate-pulse bg-[var(--bg-secondary)] rounded-lg" />
          ) : (
            <TrendChart data={charts?.monthly_trend ?? []} />
          )}
        </div>
      </div>

      {/* AI Panel */}
      <AIPanel />
    </div>
  );
}
