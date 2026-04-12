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

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04)",
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
