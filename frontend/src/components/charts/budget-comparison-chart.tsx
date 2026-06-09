"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export interface BudgetComparisonDatum {
  category: string;
  Budget: number;
  Actual: number;
  over: boolean;
}

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

export function BudgetComparisonChart({ data }: { data: BudgetComparisonDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="category" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={glassTooltipStyle} />
        <Legend />
        <Bar dataKey="Budget" fill="#6366f1" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Actual" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.over ? "#EF4444" : "#22C55E"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
