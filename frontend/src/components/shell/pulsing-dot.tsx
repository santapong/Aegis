"use client";

import { cn } from "@/lib/utils";

interface PulsingDotProps {
  className?: string;
  color?: string;
}

/**
 * PulsingDot — 6px dot with a 1.6s pulse halo. Used in the status bar's
 * "live" indicator and anywhere we need a "this thing is alive" cue.
 * Default color is the OK green; override via `color` prop.
 */
export function PulsingDot({ className, color }: PulsingDotProps) {
  return (
    <span
      className={cn("aegis-dot", className)}
      style={color ? { color } : { color: "var(--ok)" }}
    >
      <span className="aegis-dot-pulse" />
      <span className="aegis-dot-core" />
    </span>
  );
}
