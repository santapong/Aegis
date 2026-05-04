"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Sector,
} from "recharts";
import type { ChartDataPoint } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { PieChart as PieChartIcon } from "lucide-react";

interface SpendingChartProps {
  data: ChartDataPoint[];
}

/* Terminal-aesthetic palette — magenta, phosphor green, amber, claret. */
const COLORS = [
  "oklch(0.78 0.16 305)", // magenta — primary
  "oklch(0.78 0.14 145)", // phosphor green
  "oklch(0.78 0.16 75)",  // amber
  "oklch(0.72 0.18 25)",  // claret
  "oklch(0.7 0.14 250)",  // dim blue
  "oklch(0.68 0.16 200)", // teal
  "oklch(0.7 0.14 340)",  // pink
  "oklch(0.65 0.14 110)", // olive
  "oklch(0.72 0.12 280)", // lavender
  "oklch(0.75 0.12 50)",  // sand
];

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  padding: "8px 12px",
};

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: `drop-shadow(0 0 6px ${fill}40)` }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--foreground)" fontSize={14} fontWeight="bold">
        {payload.label}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--muted-foreground)" fontSize={12}>
        {formatCurrency(value)} ({(percent * 100).toFixed(0)}%)
      </text>
    </g>
  );
};

export function SpendingChart({ data }: SpendingChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  if (data.length === 0) {
    return <EmptyState icon={PieChartIcon} title="No spending data yet" className="h-64" />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={4}
          dataKey="value"
          nameKey="label"
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(undefined)}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={glassTooltipStyle}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
