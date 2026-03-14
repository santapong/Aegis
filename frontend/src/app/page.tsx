"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardAPI, transactionsAPI } from "@/lib/api";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { SpendingChart } from "@/components/charts/spending-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { AIPanel } from "@/components/ai/ai-panel";
import { Sparkles, AlertTriangle, Heart, TrendingUp } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { HealthScoreResponse, CashFlowForecastResponse, AnomaliesResponse } from "@/types";

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

  const { data: healthScore } = useQuery<HealthScoreResponse>({
    queryKey: ["health-score"],
    queryFn: () => dashboardAPI.healthScore() as Promise<HealthScoreResponse>,
  });

  const { data: cashflow } = useQuery<CashFlowForecastResponse>({
    queryKey: ["cashflow-forecast"],
    queryFn: () => dashboardAPI.cashflowForecast() as Promise<CashFlowForecastResponse>,
  });

  const { data: anomalies } = useQuery<AnomaliesResponse>({
    queryKey: ["anomalies"],
    queryFn: () => transactionsAPI.anomalies() as Promise<AnomaliesResponse>,
  });

  const gradeColor = (grade: string) => {
    switch (grade) {
      case "A": return "text-green-500";
      case "B": return "text-blue-500";
      case "C": return "text-yellow-500";
      case "D": return "text-orange-500";
      default: return "text-red-500";
    }
  };

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

      {/* Health Score + Anomaly Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Health Score */}
        {healthScore && (
          <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-4">
              <Heart size={20} className="text-red-500" />
              <h2 className="text-lg font-semibold">Financial Health Score</h2>
            </div>
            <div className="flex items-center gap-6 mb-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-secondary)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={healthScore.grade === "A" ? "#22C55E" : healthScore.grade === "B" ? "#3B82F6" : healthScore.grade === "C" ? "#EAB308" : "#EF4444"}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${healthScore.overall_score * 2.51} 251`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold ${gradeColor(healthScore.grade)}`}>{healthScore.grade}</span>
                  <span className="text-xs text-[var(--text-muted)]">{healthScore.overall_score}/100</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {healthScore.breakdown.map((b) => (
                  <div key={b.name}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span>{b.name}</span>
                      <span className="text-[var(--text-muted)]">{b.score}/{b.max_score}</span>
                    </div>
                    <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${(b.score / b.max_score) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Anomaly Alerts */}
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-yellow-500" />
            <h2 className="text-lg font-semibold">Spending Alerts</h2>
            {anomalies && anomalies.total_count > 0 && (
              <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {anomalies.total_count} alert{anomalies.total_count > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {anomalies && anomalies.anomalies.length > 0 ? (
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {anomalies.anomalies.slice(0, 5).map((a) => (
                <div key={a.transaction_id} className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                  <AlertTriangle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{a.category}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatCurrency(a.amount)} on {a.date} &mdash; {a.deviation_ratio}x the avg ({formatCurrency(a.average_for_category)})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">No unusual spending detected</p>
          )}
        </div>
      </div>

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

      {/* Cash Flow Forecast */}
      {cashflow && cashflow.forecast.length > 0 && (
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-indigo-500" />
            <h2 className="text-lg font-semibold">Cash Flow Forecast</h2>
            <span className="ml-auto text-sm text-[var(--text-muted)]">
              Current balance: {formatCurrency(cashflow.current_balance)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashflow.forecast}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="projected_balance" stroke="#6366F1" strokeWidth={2} name="Balance" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="projected_income" stroke="#22C55E" strokeWidth={2} name="Income" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="projected_expenses" stroke="#EF4444" strokeWidth={2} name="Expenses" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Panel */}
      <AIPanel />
    </div>
  );
}
