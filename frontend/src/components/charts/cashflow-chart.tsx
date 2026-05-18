"use client";

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
import { formatCurrency } from "@/lib/utils";

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  padding: "8px 12px",
};

interface ForecastPoint {
  month: string;
  projected_balance: number;
  projected_income: number;
  projected_expenses: number;
}

/**
 * 6-month cashflow forecast. Lives in its own module so the dashboard
 * route can lazy-import it via `next/dynamic`, keeping ~95 kB of
 * Recharts out of the static client bundle until the user actually
 * scrolls the chart into view (or near it).
 */
export function CashflowChart({ data }: { data: ForecastPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
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
  );
}
