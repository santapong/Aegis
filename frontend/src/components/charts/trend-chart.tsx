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
            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
        <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
          }}
        />
        <Legend />
        <ReferenceLine
          y={avgIncome}
          stroke="#22C55E"
          strokeDasharray="5 5"
          strokeOpacity={0.5}
          label={{ value: "Avg Income", position: "right", fontSize: 10, fill: "var(--text-muted)" }}
        />
        <ReferenceLine
          y={avgExpenses}
          stroke="#EF4444"
          strokeDasharray="5 5"
          strokeOpacity={0.5}
          label={{ value: "Avg Expenses", position: "right", fontSize: 10, fill: "var(--text-muted)" }}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#22C55E"
          fill="url(#incomeGrad)"
          strokeWidth={2}
          isAnimationActive
          animationDuration={1000}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke="#EF4444"
          fill="url(#expenseGrad)"
          strokeWidth={2}
          isAnimationActive
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
