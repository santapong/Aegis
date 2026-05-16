"use client";

/**
 * CosmicChart — 420×420 SVG "constellation of your money" for the landing
 * page hero. 4 concentric orbital rings (one solid, three dashed), central
 * core dot, 4 satellite dots labeled NTW/INC/EXP/DEB, perpendicular dashed
 * axes, and a faux 8-point balance trendline tucked in the upper-left
 * corner. Labels in 9px mono with 1.4px tracking.
 */
export function CosmicChart() {
  // Faux trendline coords (upper-left corner, 8 points)
  const trend = [
    [22, 92], [38, 80], [52, 84], [70, 68], [88, 74], [108, 56], [126, 62], [144, 48],
  ];
  const trendPath = trend
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`)
    .join(" ");

  return (
    <svg
      viewBox="0 0 420 420"
      role="img"
      aria-label="Cosmic chart"
      style={{ width: "100%", maxWidth: 420, height: "auto", filter: "var(--line-glow)" }}
    >
      {/* Trendline */}
      <g>
        <text
          x="22" y="40"
          fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.4"
          fill="var(--dim)"
        >
          BAL · 12M
        </text>
        <path
          d={trendPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
          opacity="0.65"
        />
      </g>

      {/* Perpendicular axes */}
      <line x1="210" y1="40" x2="210" y2="380" stroke="var(--pane-edge)" strokeDasharray="2 4" />
      <line x1="40" y1="210" x2="380" y2="210" stroke="var(--pane-edge)" strokeDasharray="2 4" />

      {/* Orbital rings */}
      <circle cx="210" cy="210" r="50" fill="none" stroke="var(--pane-edge-2)" strokeWidth="1" />
      <circle cx="210" cy="210" r="95" fill="none" stroke="var(--pane-edge)" strokeWidth="0.8" strokeDasharray="2 4" />
      <circle cx="210" cy="210" r="138" fill="none" stroke="var(--pane-edge)" strokeWidth="0.8" strokeDasharray="2 4" />
      <circle cx="210" cy="210" r="178" fill="none" stroke="var(--pane-edge)" strokeWidth="0.8" strokeDasharray="2 4" />

      {/* Central core */}
      <circle cx="210" cy="210" r="6" fill="var(--accent)" style={{ filter: "var(--ring-glow)" }} />
      <circle cx="210" cy="210" r="14" fill="none" stroke="var(--accent)" strokeOpacity="0.4" />
      <text
        x="222" y="206"
        fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.4"
        fill="var(--fg-2)"
      >
        NTW · $148.9k
      </text>

      {/* Satellites */}
      {[
        { x: 305, y: 168, label: "INC · 12.4k" },
        { x: 260, y: 304, label: "EXP · 7.3k" },
        { x: 102, y: 252, label: "SAV · 41.0k" },
        { x: 138, y: 138, label: "DEB · 18.2k" },
      ].map((s) => (
        <g key={s.label}>
          <circle cx={s.x} cy={s.y} r="3.5" fill="var(--accent-2)" />
          <circle cx={s.x} cy={s.y} r="8" fill="none" stroke="var(--accent-2)" strokeOpacity="0.35" />
          <text
            x={s.x + 10} y={s.y + 4}
            fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.4"
            fill="var(--dim)"
          >
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
