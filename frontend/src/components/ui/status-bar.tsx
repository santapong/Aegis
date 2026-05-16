"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { PulsingDot } from "@/components/shell/pulsing-dot";

/**
 * StatusBar — terminal-style readout pinned to the bottom of the app shell.
 *
 * Galaxy pattern (from handoff):
 *   ● AEGIS · draft Observatory · node aegis-01 · latency 42ms · ⌘K command · ⌘\ ai panel
 *
 * Live-feeling: latency jitters and the BKK clock ticks. No business data —
 * purely chrome conveying aliveness.
 */
export function StatusBar() {
  const theme = useAppStore((s) => s.theme);
  const [latency, setLatency] = useState(42);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => {
      setLatency(38 + Math.round(Math.random() * 14));
      setNow(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const bkkTime = now
    ? now.toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Bangkok" })
    : "--:--:--";

  return (
    <footer className="aegis-status" style={{ position: "relative", zIndex: 1 }}>
      <span
        className="flex items-center gap-1.5"
        style={{ color: "var(--ok)" }}
      >
        <PulsingDot />
        <b style={{ color: "var(--fg-2)" }}>AEGIS</b>
      </span>
      <span className="aegis-status-sep">·</span>
      <span>
        draft <b style={{ color: "var(--accent)", textTransform: "capitalize" }}>{theme}</b>
      </span>
      <span className="aegis-status-sep">·</span>
      <span>
        node <b>aegis-01</b>
      </span>
      <span className="aegis-status-sep">·</span>
      <span>
        latency <b className="tabular-nums">{latency}ms</b>
      </span>
      <span className="aegis-status-sep">·</span>
      <span className="hidden md:inline">
        last sync <b>just now</b>
      </span>
      <span className="ml-auto flex items-center gap-2.5">
        <span className="hidden lg:inline" style={{ color: "var(--dim)" }}>
          BKK · <span className="tabular-nums">{bkkTime}</span>
        </span>
        <span className="aegis-status-sep hidden lg:inline">·</span>
        <span style={{ color: "var(--dim)" }}>
          <span className="aegis-kbd">/</span> command · <span className="aegis-kbd">⌘\</span> ai
        </span>
      </span>
    </footer>
  );
}
