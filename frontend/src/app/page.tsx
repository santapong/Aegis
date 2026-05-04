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
import { staggerContainer, staggerItem } from "@/lib/animations";
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
import type {
  HealthScoreResponse,
  CashFlowForecastResponse,
  AnomaliesResponse,
  KPISummary,
  DashboardCharts,
  InsightItem,
} from "@/types";

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  padding: "8px 12px",
};

/** Card head — magenta 3-letter code badge + sans title + optional action. */
function CardHead({
  code,
  title,
  action,
}: {
  code: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="aegis-card-head">
      <span className="aegis-code">{code}</span>
      <h3 className="text-[14px] font-medium text-foreground m-0">{title}</h3>
      {action && (
        <span className="ml-auto font-mono text-[11px] flex items-center gap-1.5" style={{ color: "var(--aegis-dim)" }}>
          {action}
        </span>
      )}
    </div>
  );
}

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
      case "A":
        return "var(--aegis-ok)";
      case "B":
        return "var(--primary)";
      case "C":
        return "var(--aegis-warn)";
      case "D":
        return "var(--aegis-warn)";
      default:
        return "var(--aegis-bad)";
    }
  };

  // Eyebrow date — kept stable across SSR / hydration.
  const today = new Date();
  const eyebrow = `DSH · ${today.toISOString().slice(0, 10)} · ${today.toLocaleDateString("en-US", { weekday: "short" })}`;

  return (
    <motion.div
      className="space-y-7 max-w-7xl mx-auto"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* Hero opener — italic serif headline + monospace eyebrow + sub. */}
      <motion.div variants={staggerItem}>
        <PageHeader
          eyebrow={eyebrow}
          title="Good morning."
          subtitle={
            summary ? (
              <>
                Net worth <b>{formatCurrency(summary.total_balance)}</b> · monthly net{" "}
                <b style={{ color: "var(--aegis-ok)" }}>
                  {formatCurrency(summary.monthly_income - summary.monthly_expenses)}
                </b>{" "}
                · all systems nominal.
              </>
            ) : (
              <>Loading the latest read on your finances…</>
            )
          }
          action={
            <Button
              onClick={toggleAIPanel}
              className="font-mono text-[11px] tracking-wide"
            >
              ASK CLAUDE
            </Button>
          }
        />
      </motion.div>

      {/* KPI rail — single grid, hairline dividers, italic serif numerals. */}
      <motion.div variants={staggerItem}>
        {summaryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={120} />
            ))}
          </div>
        ) : summary ? (
          <KPICards data={summary} />
        ) : null}
      </motion.div>

      {/* Health Score + Anomaly Alerts */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {healthLoading ? (
          <Skeleton height={240} />
        ) : healthScore ? (
          <Card>
            <CardContent className="p-6">
              <CardHead code="HLT" title="Financial health" action={<>overall · {healthScore.grade}</>} />
              <div className="grid grid-cols-[140px_1fr] gap-6 items-center">
                <div className="flex flex-col items-center gap-1 p-3 rounded-md" style={{ border: "1px dashed var(--aegis-line)" }}>
                  <ProgressRing
                    value={healthScore.overall_score}
                    max={100}
                    size={96}
                    strokeWidth={6}
                    color={gradeColor(healthScore.grade)}
                    label={
                      <span className="aegis-display" style={{ fontSize: 48, lineHeight: 1, color: gradeColor(healthScore.grade) }}>
                        {healthScore.grade}
                      </span>
                    }
                    sublabel={
                      <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--foreground)" }}>
                        {healthScore.overall_score}
                        <span style={{ color: "var(--aegis-dim)" }}>/100</span>
                      </span>
                    }
                  />
                </div>
                <div className="space-y-2">
                  {healthScore.breakdown.map((b) => (
                    <div
                      key={b.name}
                      className="grid items-center gap-2.5 font-mono text-[11px]"
                      style={{ gridTemplateColumns: "130px 1fr 50px" }}
                    >
                      <span style={{ color: "var(--aegis-fg-2)" }}>{b.name}</span>
                      <div className="h-1 overflow-hidden rounded" style={{ background: "var(--aegis-panel-2)" }}>
                        <motion.div
                          className="h-full"
                          style={{ background: "var(--aegis-ok)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(b.score / b.max_score) * 100}%` }}
                          transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
                        />
                      </div>
                      <span className="text-right tabular-nums" style={{ color: "var(--aegis-dim)" }}>
                        {b.score}/{b.max_score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Anomaly Alerts — dashed-bottom row dividers, no zebra. */}
        <Card>
          <CardContent className="p-6">
            <CardHead
              code="ALT"
              title="Anomalies"
              action={
                <>
                  <span
                    className="aegis-dot"
                    style={{ color: "var(--aegis-warn)" }}
                  >
                    <span className="aegis-dot-core" />
                  </span>
                  {anomalies?.total_count ?? 0} signals
                </>
              }
            />
            {anomalies && anomalies.anomalies.length > 0 ? (
              <div className="flex flex-col">
                {anomalies.anomalies.slice(0, 5).map((a, i) => (
                  <motion.div
                    key={a.transaction_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="grid items-start gap-3.5 py-2.5"
                    style={{
                      gridTemplateColumns: "70px 1fr auto",
                      borderBottom: i < anomalies.anomalies.slice(0, 5).length - 1 ? "1px dashed var(--aegis-line)" : "none",
                    }}
                  >
                    <span className="font-mono text-[11px] pt-0.5" style={{ color: "var(--aegis-dim)" }}>
                      {a.date.slice(5)}
                    </span>
                    <div>
                      <div className="flex items-baseline gap-3 font-mono text-[12px] text-foreground">
                        <span className="capitalize">{a.category}</span>
                        <span className="tabular-nums" style={{ color: "var(--aegis-warn)" }}>
                          {formatCurrency(a.amount)}
                        </span>
                        <span className="ml-auto tabular-nums" style={{ color: "var(--aegis-warn)" }}>
                          {a.deviation_ratio.toFixed(1)}×
                        </span>
                      </div>
                      <p className="mt-1 text-[12px]" style={{ color: "var(--aegis-fg-2)" }}>
                        {a.description ?? `${a.deviation_ratio.toFixed(1)}× the average for this category (${formatCurrency(a.average_for_category)}).`}
                      </p>
                    </div>
                    <button
                      className="font-mono text-[10px] px-2 py-1 rounded transition-colors hover:text-foreground"
                      style={{
                        color: "var(--aegis-dim)",
                        border: "1px solid var(--aegis-line-2)",
                        background: "transparent",
                      }}
                    >
                      review
                    </button>
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
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardContent className="p-6">
            <CardHead code="SPD" title="Spending · this month" action={<>by category</>} />
            {chartsLoading ? (
              <Skeleton height={300} />
            ) : (
              <SpendingChart data={charts?.spending_by_category ?? []} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <CardHead code="TRD" title="Monthly trend" action={<>income vs expenses</>} />
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
              <CardHead
                code="INS"
                title="Insights"
                action={<>auto-generated · last refresh just now</>}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.map((insight, i) => {
                  const tint =
                    insight.type === "positive"
                      ? "var(--aegis-ok)"
                      : insight.type === "warning"
                        ? "var(--aegis-warn)"
                        : "var(--primary)";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="aegis-insight"
                      style={{ "--insight-tint": tint } as React.CSSProperties}
                    >
                      <div className="aegis-insight-kicker">
                        {String(i + 1).padStart(2, "0")} · {insight.type.toUpperCase()}
                      </div>
                      <div className="text-sm font-medium text-foreground mb-1.5">{insight.title}</div>
                      <div className="text-[13px] leading-relaxed" style={{ color: "var(--aegis-fg-2)" }}>
                        {insight.message}
                      </div>
                      <div className="flex items-center justify-between font-mono text-[11px] mt-2.5">
                        <span className="tabular-nums" style={{ color: tint }}>
                          {insight.metric}
                        </span>
                        <span style={{ color: "var(--aegis-dim)" }}>act on this →</span>
                      </div>
                    </motion.div>
                  );
                })}
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
              <CardHead
                code="CFL"
                title="Cash flow forecast"
                action={
                  <>
                    current balance ·{" "}
                    <span style={{ color: "var(--foreground)" }} className="tabular-nums">
                      {formatCurrency(cashflow.current_balance)}
                    </span>
                  </>
                }
              />
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cashflow.forecast}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--aegis-dim)" }}
                    stroke="var(--border)"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--aegis-dim)" }}
                    stroke="var(--border)"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={glassTooltipStyle}
                    cursor={{ stroke: "var(--aegis-line-2)", strokeDasharray: "2 4" }}
                  />
                  <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1 }} />
                  <Line
                    type="monotone"
                    dataKey="projected_balance"
                    stroke="var(--primary)"
                    strokeWidth={1.75}
                    name="balance"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--primary)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected_income"
                    stroke="var(--aegis-ok)"
                    strokeWidth={1.5}
                    name="income"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--aegis-ok)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected_expenses"
                    stroke="var(--aegis-warn)"
                    strokeWidth={1.5}
                    name="expenses"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--aegis-warn)" }}
                  />
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
