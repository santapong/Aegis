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
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const CATEGORY_COLORS = [
  "#E8913C", // amber — the accent
  "#2E6B72", // teal — the counter-accent
  "#C9A87A", // sand
  "#4E9BA4", // teal, lifted
  "#9EA5A8", // secondary ink
  "#B26B24", // amber, deepened
  "#6C7378", // muted
  "#8FB8A8", // sage
];

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

export function CategoryComparisonChart({
  data,
  categories,
}: {
  data: Record<string, string | number>[];
  categories: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={glassTooltipStyle} />
        <Legend />
        {categories.map((cat, i) => (
          <Bar
            key={cat}
            dataKey={cat}
            fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
            radius={[2, 2, 0, 0]}
            name={cat.charAt(0).toUpperCase() + cat.slice(1)}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
