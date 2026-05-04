"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUp } from "lucide-react";

interface TrendChartProps {
  data: { month: string; income: number; expenses: number }[];
}

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  padding: "8px 12px",
};

const COL_INCOME = "oklch(0.78 0.14 145)";
const COL_EXPENSE = "oklch(0.78 0.16 75)";

export function TrendChart({ data }: TrendChartProps) {
  if (data.length === 0) {
    return <EmptyState icon={TrendingUp} title="No trend data yet" className="h-64" />;
  }

  const avgIncome = data.reduce((sum, d) => sum + d.income, 0) / data.length;
  const avgExpenses = data.reduce((sum, d) => sum + d.expenses, 0) / data.length;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COL_INCOME} stopOpacity={0.22} />
            <stop offset="95%" stopColor={COL_INCOME} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COL_EXPENSE} stopOpacity={0.22} />
            <stop offset="95%" stopColor={COL_EXPENSE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" strokeOpacity={0.6} />
        <XAxis
          dataKey="month"
          stroke="var(--border)"
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--border)"
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
          tickFormatter={(v) => `$${v}`}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={glassTooltipStyle}
          cursor={{ stroke: "var(--border)", strokeDasharray: "2 4" }}
        />
        <Legend wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1 }} />
        <ReferenceLine
          y={avgIncome}
          stroke={COL_INCOME}
          strokeDasharray="3 3"
          strokeOpacity={0.4}
          label={{ value: "avg", position: "right", fontSize: 9, fontFamily: "var(--font-mono)", fill: "var(--muted-foreground)" }}
        />
        <ReferenceLine
          y={avgExpenses}
          stroke={COL_EXPENSE}
          strokeDasharray="3 3"
          strokeOpacity={0.4}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke={COL_INCOME}
          fill="url(#incomeGrad)"
          strokeWidth={1.75}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 4, fill: COL_INCOME }}
          isAnimationActive
          animationDuration={1000}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke={COL_EXPENSE}
          fill="url(#expenseGrad)"
          strokeWidth={1.75}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 4, fill: COL_EXPENSE }}
          isAnimationActive
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
