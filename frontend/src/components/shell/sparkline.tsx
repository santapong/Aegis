"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  showLast?: boolean;
}

/**
 * Sparkline — tiny inline line chart with an optional bright last-point
 * dot. Used inside KPI cards and the sidebar pulse rows.
 */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  stroke = "var(--accent)",
  showLast = true,
}: SparklineProps) {
  if (!data.length) return null;

  // Degenerate case: a single point would produce `M0 y` and a dot pinned
  // to the left edge — render a centered dot instead.
  if (data.length === 1) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
        <circle cx={width / 2} cy={height / 2} r={1.8} fill={stroke} />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const step = width / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return [x, y] as const;
  });
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible", filter: "var(--line-glow)" }}
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLast && <circle cx={last[0]} cy={last[1]} r={1.8} fill={stroke} />}
    </svg>
  );
}
