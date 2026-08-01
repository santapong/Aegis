"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { dashboardAPI } from "@/lib/api";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { CustomizeMenu } from "@/components/dashboard/customize-menu";
import { ProgressRing } from "@/components/charts/progress-ring";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { useAppStore, type DashboardWidgetId } from "@/stores/app-store";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";

// Recharts (~95 kB gz) + the two chart wrappers + the AI panel are all
// pulled out of the dashboard's static client bundle and lazy-imported.
// They render on the same page; the Skeleton fallback keeps the layout
// stable while the chunk loads. ssr:false because Recharts uses
// ResizeObserver / window APIs that aren't available during SSR.
const SpendingChart = dynamic(
  () => import("@/components/charts/spending-chart").then((m) => m.SpendingChart),
  { ssr: false, loading: () => <Skeleton height={180} /> }
);
const TrendChart = dynamic(
  () => import("@/components/charts/trend-chart").then((m) => m.TrendChart),
  { ssr: false, loading: () => <Skeleton height={180} /> }
);
const AIPanel = dynamic(
  () => import("@/components/ai/ai-panel").then((m) => m.AIPanel),
  { ssr: false }
);
const CashflowChart = dynamic(
  () => import("@/components/charts/cashflow-chart").then((m) => m.CashflowChart),
  { ssr: false, loading: () => <Skeleton height={240} /> }
);
import type {
  HealthScoreResponse,
  CashFlowForecastResponse,
  AnomaliesResponse,
  KPISummary,
  DashboardCharts,
  InsightItem,
} from "@/types";

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

/** Inline error state shown inside a dashboard card when a query fails. */
function QueryErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-8 px-4">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-destructive/10">
        <AlertTriangle size={20} className="text-destructive" />
      </div>
      <div className="text-sm font-medium text-foreground">Failed to load</div>
      <p
        className="text-[12px] leading-relaxed max-w-sm"
        style={{ color: "var(--aegis-fg-2)" }}
      >
        {message}
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onRetry}
        icon={<RefreshCw size={14} />}
      >
        Retry
      </Button>
    </div>
  );
}

/** Grid span per widget — half-width widgets pair up on lg screens. */
const WIDGET_SPAN: Record<DashboardWidgetId, string> = {
  kpi: "lg:col-span-2",
  health: "",
  anomalies: "",
  spending: "",
  trend: "",
  insights: "lg:col-span-2",
  cashflow: "lg:col-span-2",
};

export default function DashboardPage() {
  // After the page first mounts, suppress per-item entry animations so
  // React Query refetches don't re-fire the staggered fade-in on
  // anomaly + insight cards. The first paint still gets the full
  // animation; subsequent refetches snap-in instantly.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Selectors — without these the dashboard re-renders on every unrelated
  // app-store write (theme change, panel toggle, settings hydrate).
  const toggleAIPanel = useAppStore((s) => s.toggleAIPanel);
  const widgetOrder = useAppStore((s) => s.dashboardOrder);
  const hiddenWidgets = useAppStore((s) => s.dashboardHidden);

  // ONE round-trip for the entire dashboard. Replaces 6 separate
  // useQuery calls (summary + charts + health + cashflow + anomalies +
  // insights). Backend bundles them server-side and caches the bundle
  // as a single key; mutations invalidate everything atomically via
  // _GLOBAL_USER_SCOPES.
  type DashboardBundle = {
    summary: KPISummary;
    charts: DashboardCharts;
    health_score: HealthScoreResponse;
    cashflow_forecast: CashFlowForecastResponse;
    anomalies: AnomaliesResponse;
    weekly_summary: unknown | null;
    insights: InsightItem[];
  };
  const {
    data: bundle,
    isLoading: bundleLoading,
    error: bundleError,
    refetch: refetchBundle,
  } = useQuery<DashboardBundle>({
    queryKey: ["dashboard-bundle"],
    queryFn: () => dashboardAPI.bundle() as Promise<DashboardBundle>,
  });

  const summary = bundle?.summary;
  const charts = bundle?.charts;
  const healthScore = bundle?.health_score;
  const cashflow = bundle?.cashflow_forecast;
  const anomalies = bundle?.anomalies;
  const insights = bundle?.insights;

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

  /* ===== Widget renderers ==================================================
     Each returns the widget's content, or null to skip its grid cell
     entirely (e.g. no insights yet). Order/visibility come from the app
     store; the CustomizeMenu in the header edits both. */

  const renderKPI = () =>
    bundleError ? (
      <Card>
        <CardContent className="p-6">
          <QueryErrorCard
            message={bundleError.message || "Failed to load summary."}
            onRetry={() => refetchBundle()}
          />
        </CardContent>
      </Card>
    ) : bundleLoading ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} height={120} />
        ))}
      </div>
    ) : summary ? (
      <KPICards data={summary} />
    ) : null;

  const renderHealth = () =>
    bundleError ? (
      <Card>
        <CardContent className="p-6">
          <CardHead code="HLT" title="Financial health" />
          <QueryErrorCard
            message={bundleError.message || "Failed to load health score."}
            onRetry={() => refetchBundle()}
          />
        </CardContent>
      </Card>
    ) : bundleLoading ? (
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
    ) : null;

  const renderAnomalies = () => (
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
        {bundleError ? (
          <QueryErrorCard
            message={bundleError.message || "Failed to load anomalies."}
            onRetry={() => refetchBundle()}
          />
        ) : anomalies && anomalies.anomalies.length > 0 ? (
          <div className="flex flex-col">
            {anomalies.anomalies.slice(0, 5).map((a, i) => (
              <motion.div
                key={a.transaction_id}
                initial={hasMounted ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={hasMounted ? { duration: 0 } : { delay: i * 0.06 }}
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
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">No unusual spending detected</p>
        )}
      </CardContent>
    </Card>
  );

  const renderSpending = () => (
    <Card>
      <CardContent className="p-6">
        <CardHead code="SPD" title="Spending · this month" action={<>by category</>} />
        {bundleError ? (
          <QueryErrorCard
            message={bundleError.message || "Failed to load spending chart."}
            onRetry={() => refetchBundle()}
          />
        ) : bundleLoading ? (
          <Skeleton height={300} />
        ) : (
          <SpendingChart data={charts?.spending_by_category ?? []} />
        )}
      </CardContent>
    </Card>
  );

  const renderTrend = () => (
    <Card>
      <CardContent className="p-6">
        <CardHead code="TRD" title="Monthly trend" action={<>income vs expenses</>} />
        {bundleError ? (
          <QueryErrorCard
            message={bundleError.message || "Failed to load trend chart."}
            onRetry={() => refetchBundle()}
          />
        ) : bundleLoading ? (
          <Skeleton height={300} />
        ) : (
          <TrendChart data={charts?.monthly_trend ?? []} />
        )}
      </CardContent>
    </Card>
  );

  const renderInsights = () => {
    if (bundleError) {
      return (
        <Card>
          <CardContent className="p-6">
            <CardHead code="INS" title="Insights" />
            <QueryErrorCard
              message={bundleError.message || "Failed to load insights."}
              onRetry={() => refetchBundle()}
            />
          </CardContent>
        </Card>
      );
    }
    if (!insights || insights.length === 0) return null;
    return (
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
                  initial={hasMounted ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={hasMounted ? { duration: 0 } : { delay: i * 0.08 }}
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
    );
  };

  const renderCashflow = () => {
    if (bundleError) {
      return (
        <Card>
          <CardContent className="p-6">
            <CardHead code="CFL" title="Cash flow forecast" />
            <QueryErrorCard
              message={bundleError.message || "Failed to load cash flow forecast."}
              onRetry={() => refetchBundle()}
            />
          </CardContent>
        </Card>
      );
    }
    if (!cashflow || cashflow.forecast.length === 0) return null;
    return (
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
          <CashflowChart data={cashflow.forecast} />
        </CardContent>
      </Card>
    );
  };

  const widgetRenderers: Record<DashboardWidgetId, () => React.ReactNode> = {
    kpi: renderKPI,
    health: renderHealth,
    anomalies: renderAnomalies,
    spending: renderSpending,
    trend: renderTrend,
    insights: renderInsights,
    cashflow: renderCashflow,
  };

  return (
    <motion.div
      className="max-w-7xl mx-auto"
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
            <div className="flex items-center gap-2">
              <CustomizeMenu order={widgetOrder} />
              <Button
                onClick={toggleAIPanel}
                className="font-mono text-[11px] tracking-wide"
              >
                ASK CLAUDE
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Widget grid — order and visibility are user-configurable. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-7">
        {widgetOrder
          .filter((id) => !hiddenWidgets.includes(id))
          .map((id) => {
            const content = widgetRenderers[id]();
            if (!content) return null;
            return (
              <motion.div key={id} variants={staggerItem} className={WIDGET_SPAN[id]}>
                {content}
              </motion.div>
            );
          })}
      </div>

      <AIPanel />
    </motion.div>
  );
}
