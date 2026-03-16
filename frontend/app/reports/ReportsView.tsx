"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TrendMonth {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface CategoryItem {
  category: string;
  amount: number;
  percentage: number;
}

interface CategoryData {
  month: string;
  total: number;
  breakdown: CategoryItem[];
}

interface YearlyMonth {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface YearlyData {
  year: number;
  months: YearlyMonth[];
  total_income: number;
  total_expenses: number;
  total_net: number;
  best_month: string;
  worst_month: string;
}

interface NetWorthData {
  net_worth: number;
  assets: number;
  liabilities: number;
  savings_total: number;
  goals_total: number;
  debt_total: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CATEGORY_COLORS: Record<string, string> = {
  food: "#ef4444",
  transport: "#f59e0b",
  housing: "#3b82f6",
  utilities: "#8b5cf6",
  entertainment: "#ec4899",
  shopping: "#f97316",
  healthcare: "#14b8a6",
  education: "#6366f1",
  insurance: "#64748b",
  travel: "#06b6d4",
  subscriptions: "#a855f7",
  personal_care: "#f472b6",
  gifts_donations: "#fb7185",
  other_expense: "#6b7280",
};

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food & Dining",
  transport: "Transport",
  housing: "Housing & Rent",
  utilities: "Utilities",
  entertainment: "Entertainment",
  shopping: "Shopping",
  healthcare: "Healthcare",
  education: "Education",
  insurance: "Insurance",
  travel: "Travel",
  subscriptions: "Subscriptions",
  personal_care: "Personal Care",
  gifts_donations: "Gifts & Donations",
  other_expense: "Other",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

function shortMonth(monthStr: string) {
  const [y, m] = monthStr.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "short" });
}

function longMonth(monthStr: string) {
  const [y, m] = monthStr.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "long" });
}

function getMonthOptions() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i);
    return {
      value: String(i + 1).padStart(2, "0"),
      label: d.toLocaleDateString("en-US", { month: "long" }),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReportsView() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [trend, setTrend] = useState<TrendMonth[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [yearlyData, setYearlyData] = useState<YearlyData | null>(null);
  const [netWorth, setNetWorth] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---- Fetch all data ---- */
  useEffect(() => {
    const controller = new AbortController();

    async function fetchAll() {
      setLoading(true);
      try {
        const [trendRes, catRes, yearRes, nwRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/monthly-trend?months=6`, { signal: controller.signal }),
          fetch(`${API_URL}/api/reports/category-breakdown?month=${selectedMonth}`, { signal: controller.signal }),
          fetch(`${API_URL}/api/reports/yearly-summary?year=${selectedYear}`, { signal: controller.signal }),
          fetch(`${API_URL}/api/reports/net-worth`, { signal: controller.signal }),
        ]);

        const [trendData, catData, yearData, nwData] = await Promise.all([
          trendRes.ok ? trendRes.json() : [],
          catRes.ok ? catRes.json() : null,
          yearRes.ok ? yearRes.json() : null,
          nwRes.ok ? nwRes.json() : null,
        ]);

        setTrend(trendData);
        setCategoryData(catData);
        setYearlyData(yearData);
        setNetWorth(nwData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to fetch reports data:", err);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
    return () => controller.abort();
  }, [selectedYear, selectedMonth]);

  /* ---- Month selector handler ---- */
  function handleMonthChange(mm: string) {
    setSelectedMonth(`${selectedYear}-${mm}`);
  }

  function handleYearChange(year: number) {
    setSelectedYear(year);
    const mm = selectedMonth.split("-")[1];
    setSelectedMonth(`${year}-${mm}`);
  }

  /* ---- Loading state ---- */
  if (loading && !netWorth && trend.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading reports...
        </div>
      </div>
    );
  }

  /* ---- Derived values for charts ---- */
  const trendMaxValue = Math.max(...trend.map((t) => Math.max(t.income, t.expenses)), 1);

  const conicSegments = categoryData?.breakdown?.length
    ? (() => {
        let acc = 0;
        const segments = categoryData.breakdown.map((item) => {
          const color = CATEGORY_COLORS[item.category] || "#6b7280";
          const start = acc;
          acc += item.percentage;
          return `${color} ${start}% ${acc}%`;
        });
        if (acc < 100) segments.push(`#27272a ${acc}% 100%`);
        return segments.join(", ");
      })()
    : "#27272a 0% 100%";

  const monthOptions = getMonthOptions();
  const selectedMM = selectedMonth.split("-")[1];

  const assetTotal = netWorth ? netWorth.assets : 0;
  const liabilityTotal = netWorth ? netWorth.liabilities : 0;
  const barTotal = Math.max(assetTotal + liabilityTotal, 1);

  return (
    <div className="p-8">
      {/* ================================================================ */}
      {/*  1. HEADER                                                       */}
      {/* ================================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Reports &amp; Analytics</h1>
          <p className="text-sm text-zinc-500 mt-1">Financial analytics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <input
            type="number"
            min={2020}
            max={2099}
            value={selectedYear}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="input-premium w-24 text-center"
          />
          {/* Month selector */}
          <select
            value={selectedMM}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="input-premium"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  2. NET WORTH                                                    */}
      {/* ================================================================ */}
      <div className="card-premium p-6 mb-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Net Worth</h2>
        {netWorth ? (
          <>
            <p
              className={`financial-number text-3xl mb-6 ${
                netWorth.net_worth >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatCurrency(netWorth.net_worth)}
            </p>

            {/* Breakdown row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Assets</p>
                <p className="financial-number text-lg text-emerald-400">{formatCurrency(netWorth.assets)}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                  <span>Savings: {formatCurrency(netWorth.savings_total)}</span>
                  <span>Goals: {formatCurrency(netWorth.goals_total)}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Liabilities</p>
                <p className="financial-number text-lg text-red-400">{formatCurrency(netWorth.liabilities)}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                  <span>Debt: {formatCurrency(netWorth.debt_total)}</span>
                </div>
              </div>
            </div>

            {/* Stacked horizontal bar */}
            <div className="w-full h-4 rounded-full overflow-hidden flex bg-zinc-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(assetTotal / barTotal) * 100}%` }}
                title={`Assets: ${formatCurrency(assetTotal)}`}
              />
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${(liabilityTotal / barTotal) * 100}%` }}
                title={`Liabilities: ${formatCurrency(liabilityTotal)}`}
              />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                Assets
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                Liabilities
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">No net worth data available</p>
        )}
      </div>

      {/* ================================================================ */}
      {/*  3. MONTHLY TREND — CSS bar chart                                */}
      {/* ================================================================ */}
      <div className="card-premium p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Income vs Expenses</h2>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              Expenses
            </span>
          </div>
        </div>

        {trend.length > 0 ? (
          <div className="flex items-end justify-between gap-3 h-52">
            {trend.map((t) => {
              const incH = (t.income / trendMaxValue) * 100;
              const expH = (t.expenses / trendMaxValue) * 100;
              return (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                  {/* Bars container */}
                  <div className="flex items-end gap-1 w-full justify-center h-full">
                    <div
                      className="w-6 rounded-t-md bg-emerald-500 transition-all duration-500"
                      style={{ height: `${incH}%`, minHeight: t.income > 0 ? "4px" : "0px" }}
                      title={`Income: ${formatCurrency(t.income)}`}
                    />
                    <div
                      className="w-6 rounded-t-md bg-red-500 transition-all duration-500"
                      style={{ height: `${expH}%`, minHeight: t.expenses > 0 ? "4px" : "0px" }}
                      title={`Expenses: ${formatCurrency(t.expenses)}`}
                    />
                  </div>
                  {/* Month label */}
                  <span className="text-[10px] text-zinc-500 mt-1">{shortMonth(t.month)}</span>
                  {/* Net badge */}
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      t.net >= 0
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {t.net >= 0 ? "+" : ""}
                    {formatCurrency(t.net)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-52 flex items-center justify-center">
            <p className="text-sm text-zinc-500">No trend data available</p>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/*  4. CATEGORY DONUT — CSS conic-gradient                          */}
      {/* ================================================================ */}
      <div className="card-premium p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">
          Category Breakdown — {longMonth(selectedMonth)} {selectedYear}
        </h2>

        {categoryData && categoryData.breakdown && categoryData.breakdown.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center">
            {/* Donut */}
            <div className="relative w-44 h-44 rounded-full mx-auto md:mx-0" style={{ background: `conic-gradient(${conicSegments})` }}>
              <div className="w-28 h-28 rounded-full bg-zinc-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <span className="financial-number text-sm text-white">{formatCurrency(categoryData.total)}</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              {categoryData.breakdown.map((item) => {
                const color = CATEGORY_COLORS[item.category] || "#6b7280";
                const label = CATEGORY_LABELS[item.category] || item.category;
                return (
                  <div key={item.category} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-zinc-300 flex-1 truncate">{label}</span>
                    <span className="text-sm text-zinc-400 financial-number shrink-0">{formatCurrency(item.amount)}</span>
                    <span className="text-xs text-zinc-500 w-12 text-right shrink-0">{item.percentage.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-44">
            <p className="text-sm text-zinc-500">No category data for this month</p>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/*  5. YEARLY SUMMARY TABLE                                         */}
      {/* ================================================================ */}
      <div className="card-premium p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Yearly Summary — {selectedYear}</h2>

        {yearlyData && yearlyData.months && yearlyData.months.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  <th className="text-left py-3 pr-4 font-medium">Month</th>
                  <th className="text-right py-3 px-4 font-medium">Income</th>
                  <th className="text-right py-3 px-4 font-medium">Expenses</th>
                  <th className="text-right py-3 pl-4 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {yearlyData.months.map((m) => {
                  const isBest = m.month === yearlyData.best_month;
                  const isWorst = m.month === yearlyData.worst_month;
                  return (
                    <tr
                      key={m.month}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3 pr-4 text-zinc-300">
                        <span className="flex items-center gap-2">
                          {longMonth(m.month)}
                          {isBest && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                              Best
                            </span>
                          )}
                          {isWorst && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                              Worst
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right financial-number text-emerald-400">
                        {formatCurrency(m.income)}
                      </td>
                      <td className="py-3 px-4 text-right financial-number text-red-400">
                        {formatCurrency(m.expenses)}
                      </td>
                      <td
                        className={`py-3 pl-4 text-right financial-number ${
                          m.net >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {m.net >= 0 ? "+" : ""}
                        {formatCurrency(m.net)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-700">
                  <td className="py-3 pr-4 text-white font-semibold">Total</td>
                  <td className="py-3 px-4 text-right financial-number text-emerald-400 font-semibold">
                    {formatCurrency(yearlyData.total_income)}
                  </td>
                  <td className="py-3 px-4 text-right financial-number text-red-400 font-semibold">
                    {formatCurrency(yearlyData.total_expenses)}
                  </td>
                  <td
                    className={`py-3 pl-4 text-right financial-number font-semibold ${
                      yearlyData.total_net >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {yearlyData.total_net >= 0 ? "+" : ""}
                    {formatCurrency(yearlyData.total_net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-zinc-500">No yearly data for {selectedYear}</p>
          </div>
        )}
      </div>
    </div>
  );
}
