"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { KPISummary } from "@/types";

interface KPICardsProps {
  data: KPISummary;
}

interface KpiSpec {
  code: string;
  label: string;
  value: string;
  delta: number;
  deltaSuffix?: string;
  /** When true, a positive delta is bad (e.g. expenses going up). */
  positiveBad?: boolean;
  spark: number[];
  sparkColor: string;
}

/* Inline sparkline for the KPI rail. */
function Spark({
  data,
  color,
  w = 64,
  h = 18,
}: {
  data: number[];
  color: string;
  w?: number;
  h?: number;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const stepX = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / span) * (h - 2) - 1;
    return [x, y] as const;
  });
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible", color }}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={1.8} fill="currentColor" />
    </svg>
  );
}

function Delta({
  value,
  suffix = "%",
  positiveIsGood = true,
}: {
  value: number;
  suffix?: string;
  positiveIsGood?: boolean;
}) {
  const good = positiveIsGood ? value >= 0 : value <= 0;
  const color = good ? "var(--aegis-ok)" : "var(--aegis-warn)";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "·";
  return (
    <span
      className="font-mono text-[11px] tabular-nums"
      style={{ color, letterSpacing: "0.2px" }}
    >
      {arrow} {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

export function KPICards({ data }: KPICardsProps) {
  // Deltas are not yet on KPISummary; render the design's signature placeholders.
  // When the API exposes them, swap the literal numbers below.
  const items: KpiSpec[] = [
    {
      code: "BAL",
      label: "Total balance",
      value: formatCurrency(data.total_balance),
      delta: 3.4,
      spark: [4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10],
      sparkColor: "var(--aegis-ok)",
    },
    {
      code: "INC",
      label: "Monthly income",
      value: formatCurrency(data.monthly_income),
      delta: 12.1,
      spark: [3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9],
      sparkColor: "var(--aegis-ok)",
    },
    {
      code: "EXP",
      label: "Monthly expenses",
      value: formatCurrency(data.monthly_expenses),
      delta: -4.2,
      positiveBad: true,
      spark: [7, 8, 8, 7, 7, 6, 6, 7, 6, 6, 5, 5],
      sparkColor: "var(--aegis-warn)",
    },
    {
      code: "SAV",
      label: "Savings rate",
      value: `${data.savings_rate.toFixed(1)}%`,
      delta: 5.1,
      deltaSuffix: "pp",
      spark: [3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8],
      sparkColor: "var(--aegis-ok)",
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-md"
      style={{
        gap: "1px",
        background: "var(--aegis-line)",
        border: "1px solid var(--aegis-line)",
      }}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {items.map((it) => (
        <motion.div
          key={it.code}
          variants={staggerItem}
          className="px-5 py-[18px] min-w-0"
          style={{ background: "var(--aegis-panel)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="font-mono text-[10px] text-primary"
              style={{ letterSpacing: "1.6px" }}
            >
              {it.code}
            </span>
            <Spark data={it.spark} color={it.sparkColor} />
          </div>
          <div
            className="aegis-display whitespace-nowrap text-foreground mb-2"
            style={{ fontSize: "clamp(24px, 2.4vw, 36px)", lineHeight: 1.1 }}
          >
            {it.value}
          </div>
          <div className="flex items-center justify-between gap-2 font-mono text-[11px]" style={{ color: "var(--aegis-dim)" }}>
            <span>{it.label}</span>
            <Delta value={it.delta} suffix={it.deltaSuffix} positiveIsGood={!it.positiveBad} />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
