"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { dashboardAPI, transactionsAPI, aiAPI } from "@/lib/api";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { SpendingChart } from "@/components/charts/spending-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { AIPanel } from "@/components/ai/ai-panel";
import { ProgressRing } from "@/components/charts/progress-ring";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { Sparkles, AlertTriangle, Heart, TrendingUp, Lightbulb, CheckCircle, Info, TriangleAlert } from "lucide-react";
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
import type { HealthScoreResponse, CashFlowForecastResponse, AnomaliesResponse, KPISummary, DashboardCharts, InsightItem } from "@/types";

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

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

  const { data: insights } = useQuery<InsightItem[]>({
    queryKey: ["insights"],
    queryFn: () => aiAPI.insights() as Promise<InsightItem[]>,
  });

  const gradeColor = (grade: string) => {
    switch (grade) {
      case "A": return "#10b981";
      case "B": return "#6366f1";
      case "C": return "#eab308";
      case "D": return "#f97316";
      default: return "#ef4444";
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
              className="bg-gradient-to-r from-indigo-500 to-violet-500 shadow-md"
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
        {healthLoading ? (
          <Skeleton height={220} />
        ) : healthScore ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Heart size={20} className="text-rose-500" />
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
                        <span className="text-foreground">{b.name}</span>
                        <span className="text-muted-foreground">{b.score}/{b.max_score}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <motion.div
                          className="h-1.5 rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${(b.score / b.max_score) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Anomaly Alerts */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-amber-500" />
              <h2 className="text-lg font-semibold">Spending Alerts</h2>
              {anomalies && anomalies.total_count > 0 && (
                <Badge variant="danger" className="ml-auto">
                  {anomalies.total_count} alert{anomalies.total_count > 1 ? "s" : ""}
                </Badge>
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
                    className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                  >
                    <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{a.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(a.amount)} on {a.date} &mdash; {a.deviation_ratio}x the avg ({formatCurrency(a.average_for_category)})
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No unusual spending detected</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
            {chartsLoading ? (
              <Skeleton height={300} />
            ) : (
              <SpendingChart data={charts?.spending_by_category ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Monthly Trend</h2>
            {chartsLoading ? (
              <Skeleton height={300} />
            ) : (
              <TrendChart data={charts?.monthly_trend ?? []} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Financial Insights */}
      {insights && insights.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb size={20} className="text-amber-500" />
                <h2 className="text-lg font-semibold">Financial Insights</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.map((insight, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                  >
                    {insight.type === "positive" ? (
                      <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    ) : insight.type === "warning" ? (
                      <TriangleAlert size={16} className="text-amber-500 mt-0.5 shrink-0" />
                    ) : (
                      <Info size={16} className="text-indigo-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{insight.title}</p>
                        <Badge variant={
                          insight.type === "positive" ? "success" :
                          insight.type === "warning" ? "warning" : "info"
                        }>
                          {insight.metric}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{insight.message}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Cash Flow Forecast */}
      {cashflow && cashflow.forecast.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={20} className="text-primary" />
                <h2 className="text-lg font-semibold">Cash Flow Forecast</h2>
                <span className="ml-auto text-sm text-muted-foreground">
                  Current balance: {formatCurrency(cashflow.current_balance)}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cashflow.forecast}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={glassTooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="projected_balance" stroke="#6366f1" strokeWidth={2.5} name="Balance" dot={false} activeDot={{ r: 5, fill: "#6366f1", stroke: "white", strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="projected_income" stroke="#10b981" strokeWidth={2.5} name="Income" dot={false} activeDot={{ r: 5, fill: "#10b981", stroke: "white", strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="projected_expenses" stroke="#f43f5e" strokeWidth={2.5} name="Expenses" dot={false} activeDot={{ r: 5, fill: "#f43f5e", stroke: "white", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <AIPanel />
    </motion.div>
  );
}
