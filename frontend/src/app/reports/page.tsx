"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { transactionsAPI, dashboardAPI, reportsAPI } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { formatCurrency } from "@/lib/utils";
import { Download, FileText, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { CategoryComparisonMonth } from "@/types";

// Recharts (via these chart components) stays out of this page's static
// bundle — same split as the dashboard. ssr:false because Recharts needs
// ResizeObserver / window APIs unavailable during SSR.
const SpendingChart = dynamic(
  () => import("@/components/charts/spending-chart").then((m) => m.SpendingChart),
  { ssr: false, loading: () => <Skeleton height={300} /> }
);
const TrendChart = dynamic(
  () => import("@/components/charts/trend-chart").then((m) => m.TrendChart),
  { ssr: false, loading: () => <Skeleton height={300} /> }
);
const CategoryComparisonChart = dynamic(
  () =>
    import("@/components/charts/category-comparison-chart").then(
      (m) => m.CategoryComparisonChart
    ),
  { ssr: false, loading: () => <Skeleton height={350} /> }
);

export default function ReportsPage() {
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  interface TransactionSummary {
    total_income: number;
    total_expenses: number;
    net: number;
    by_category: Record<string, number>;
  }

  const { data: summary, isLoading: summaryLoading } = useQuery<TransactionSummary>({
    queryKey: ["transaction-summary", dateRange],
    queryFn: () => transactionsAPI.summary(dateRange.start, dateRange.end) as Promise<TransactionSummary>,
  });

  const { data: charts, isLoading: chartsLoading } = useQuery<{ spending_by_category: { label: string; value: number; color: string | null }[]; monthly_trend: { month: string; income: number; expenses: number }[] }>({
    queryKey: ["dashboard-charts"],
    queryFn: () => dashboardAPI.charts() as Promise<any>,
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

  const sortedBreakdown = useMemo(
    () =>
      summary
        ? Object.entries(summary.by_category).sort(([, a], [, b]) => b - a)
        : [],
    [summary]
  );

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await reportsAPI.exportCSV(dateRange.start, dateRange.end);
    } catch {
      toast.error("CSV export failed. Check server logs.");
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await reportsAPI.exportPDF(dateRange.start, dateRange.end);
    } catch {
      toast.error("PDF export failed. Check server logs.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Reports & Analytics"
          subtitle="Detailed financial summaries and charts"
          action={
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={14} />}
                onClick={handleExportCsv}
                loading={exportingCsv}
              >
                CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileText size={14} />}
                onClick={handleExportPdf}
                loading={exportingPdf}
              >
                PDF
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={staggerItem}>
        {summaryLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} height={100} />)}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(summary.total_income)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(summary.total_expenses)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Net Savings</p>
              <p className={`text-2xl font-bold mt-1 ${summary.net >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatCurrency(summary.net)}
              </p>
            </CardContent></Card>
          </div>
        ) : null}
      </motion.div>

      {/* Charts */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
          {chartsLoading ? <Skeleton height={300} /> : <SpendingChart data={categoryData} />}
        </CardContent></Card>
        <Card><CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Income vs Expenses</h2>
          {chartsLoading ? <Skeleton height={300} /> : <TrendChart data={charts?.monthly_trend ?? []} />}
        </CardContent></Card>
      </motion.div>

      {/* Monthly Category Comparison Chart */}
      {comparisonChartData.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card><CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Monthly Category Comparison</h2>
            <CategoryComparisonChart data={comparisonChartData} categories={allCategories} />
          </CardContent></Card>
        </motion.div>
      )}

      {/* Month-over-Month Changes Table */}
      {categoryComparison && categoryComparison.length > 1 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Month-over-Month Changes</h2></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                    {categoryComparison.map((m) => (
                      <th key={m.month} className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">{m.month}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allCategories.map((cat) => (
                    <tr key={cat} className="border-b border-border hover:bg-muted">
                      <td className="px-4 py-3 text-sm font-medium capitalize">{cat}</td>
                      {categoryComparison.map((m, i) => {
                        const amount = m.categories[cat] || 0;
                        const change = i > 0 ? m.changes?.[cat] : undefined;
                        return (
                          <td key={m.month} className="px-4 py-3 text-sm text-right">
                            <div>{formatCurrency(amount)}</div>
                            {change !== undefined && change !== null && (
                              <div className={`flex items-center justify-end gap-0.5 text-xs ${change > 0 ? "text-red-500" : change < 0 ? "text-green-500" : "text-muted-foreground"}`}>
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
          </Card>
        </motion.div>
      )}

      {/* Category breakdown table */}
      {summary && Object.keys(summary.by_category).length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Category Breakdown</h2></CardHeader>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedBreakdown.map(([category, amount]) => (
                    <tr key={category} className="border-b border-border hover:bg-muted">
                      <td className="px-4 py-3 text-sm capitalize">{category}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(amount)}</td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {((amount / (summary.total_income + summary.total_expenses)) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
