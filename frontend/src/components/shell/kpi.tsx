"use client";

import { cn } from "@/lib/utils";
import { CodeChip } from "./code-chip";
import { Sparkline } from "./sparkline";

interface KpiProps {
  code: string;
  label: string;
  value: React.ReactNode;
  delta?: {
    direction: "up" | "down" | "flat";
    text: React.ReactNode;
  };
  spark?: number[];
  sparkColor?: string;
  className?: string;
}

/**
 * Kpi — single KPI tile. Mono code chip + label → big display value (theme
 * font) → mono delta line → mini sparkline → decorative orbit ring in the
 * top-right corner (hidden in Observatory). Themed via the cosmic tokens.
 */
export function Kpi({
  code,
  label,
  value,
  delta,
  spark,
  sparkColor,
  className,
}: KpiProps) {
  const arrow = delta?.direction === "up" ? "▲" : delta?.direction === "down" ? "▼" : "·";

  return (
    <div className={cn("kpi", className)}>
      <div className="kpi-orbit" aria-hidden />
      <div className="kpi-label">
        <CodeChip>{code}</CodeChip>
        <span>{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <div
          className={cn(
            "kpi-delta",
            delta.direction === "up" && "up",
            delta.direction === "down" && "down"
          )}
        >
          <span className="arr">{arrow}</span>
          <span>{delta.text}</span>
        </div>
      )}
      {spark && (
        <div className="kpi-spark">
          <Sparkline
            data={spark}
            width={200}
            height={28}
            stroke={sparkColor ?? "var(--accent)"}
          />
        </div>
      )}
    </div>
  );
}

interface KpiGridProps {
  children: React.ReactNode;
  className?: string;
}

export function KpiGrid({ children, className }: KpiGridProps) {
  return <div className={cn("kpi-grid", className)}>{children}</div>;
}
