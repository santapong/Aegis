"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { dashboardAPI, transactionsAPI } from "@/lib/api";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { SpendingChart } from "@/components/charts/spending-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { AIPanel } from "@/components/ai/ai-panel";
import { ProgressRing } from "@/components/charts/progress-ring";
import { Card, CardBody } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { staggerContainer, staggerItem } from "@/lib/animations";
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
import type { HealthScoreResponse, CashFlowForecastResponse, AnomaliesResponse, KPISummary, DashboardCharts } from "@/types";

export default function DashboardPage() {
  const { toggleAIPanel } = useAppStore();

  const { data: summary, isLoading: summaryLoading } = useQuery<KPISummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardAPI.summary() as Promise<KPISummary>,
  });

  const { data: charts, isLoading: chartsLoading } = useQuery<DashboardCharts>({
    queryKey: ["dashboard-charts"],
    queryFn: () => dashboardAPI.charts() as Promise<DashboardCharts>,
  });

  const { data: healthScore, isLoading: healthLoading } = useQuery<HealthScoreResponse>({
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
      case "A": return "#22C55E";
      case "B": return "#3B82F6";
      case "C": return "#EAB308";
      case "D": return "#F97316";
      default: return "#EF4444";
    }
  };

  return (
    <motion.div
      className="space-y-6 max-w-7xl mx-auto"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Dashboard"
          subtitle="Overview of your financial health"
          action={
            <Button
              onClick={toggleAIPanel}
              icon={<Sparkles size={16} />}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md"
            >
              AI Insights
            </Button>
          }
        />
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={staggerItem}>
        {summaryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={112} />
            ))}
          </div>
        ) : summary ? (
          <KPICards data={summary} />
        ) : null}
      </motion.div>

      {/* Health Score + Anomaly Alerts */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Health Score */}
        {healthLoading ? (
          <Skeleton height={220} />
        ) : healthScore ? (
          <Card>
            <CardBody>
              <div className="flex items-center gap-2 mb-4">
                <Heart size={20} className="text-red-500" />
                <h2 className="text-lg font-semibold">Financial Health Score</h2>
              </div>
              <div className="flex items-center gap-6 mb-4">
                <ProgressRing
                  value={healthScore.overall_score}
                  max={100}
                  size={96}
                  strokeWidth={8}
                  color={gradeColor(healthScore.grade)}
                  label={healthScore.grade}
                  sublabel={`${healthScore.overall_score}/100`}
                />
                <div className="flex-1 space-y-2">
                  {healthScore.breakdown.map((b) => (
                    <div key={b.name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span>{b.name}</span>
                        <span className="text-[var(--text-muted)]">{b.score}/{b.max_score}</span>
                      </div>
                      <div className="w-full bg-[var(--bg-secondary)] rounded-full h-1.5">
                        <motion.div
                          className="h-1.5 rounded-full bg-blue-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${(b.score / b.max_score) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        ) : null}

        {/* Anomaly Alerts */}
        <Card>
          <CardBody>
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
                {anomalies.anomalies.slice(0, 5).map((a, i) => (
                  <motion.div
                    key={a.transaction_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg"
                  >
                    <AlertTriangle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{a.category}</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {formatCurrency(a.amount)} on {a.date} &mdash; {a.deviation_ratio}x the avg ({formatCurrency(a.average_for_category)})
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">No unusual spending detected</p>
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Charts */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
            {chartsLoading ? (
              <Skeleton height={300} />
            ) : (
              <SpendingChart data={charts?.spending_by_category ?? []} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold mb-4">Monthly Trend</h2>
            {chartsLoading ? (
              <Skeleton height={300} />
            ) : (
              <TrendChart data={charts?.monthly_trend ?? []} />
            )}
          </CardBody>
        </Card>
      </motion.div>

      {/* Cash Flow Forecast */}
      {cashflow && cashflow.forecast.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardBody>
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
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* AI Panel */}
      <AIPanel />
    </motion.div>
  );
}
