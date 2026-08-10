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
          isAnimationActive={false}
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
