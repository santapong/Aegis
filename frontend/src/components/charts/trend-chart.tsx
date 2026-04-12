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
  borderRadius: "12px",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
  padding: "8px 12px",
};

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
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" strokeOpacity={0.5} />
        <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={glassTooltipStyle}
        />
        <Legend />
        <ReferenceLine
          y={avgIncome}
          stroke="#10b981"
          strokeDasharray="5 5"
          strokeOpacity={0.4}
          label={{ value: "Avg", position: "right", fontSize: 10, fill: "var(--muted-foreground)" }}
        />
        <ReferenceLine
          y={avgExpenses}
          stroke="#f43f5e"
          strokeDasharray="5 5"
          strokeOpacity={0.4}
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#10b981"
          fill="url(#incomeGrad)"
          strokeWidth={2.5}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 5, fill: "#10b981", stroke: "white", strokeWidth: 2 }}
          isAnimationActive
          animationDuration={1000}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke="#f43f5e"
          fill="url(#expenseGrad)"
          strokeWidth={2.5}
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 5, fill: "#f43f5e", stroke: "white", strokeWidth: 2 }}
          isAnimationActive
          animationDuration={1000}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
