"use client";

import { useEffect, useState } from "react";

/**
 * StatusBar — terminal-style readout pinned to the bottom of the app shell.
 *
 * Pattern from `Aegis Frontend.html` design handoff:
 *   connected · latency 42ms · uptime 02:14:33 · build v1.0.0 · last sync just now · BKK 14:23:01
 *
 * "Live-feeling" numbers: latency jitters, BKK clock ticks, uptime increments.
 * No business data here — purely chrome that conveys aliveness.
 */
export function StatusBar() {
  const [latency, setLatency] = useState(42);
  const [uptime, setUptime] = useState(0);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => {
      setLatency(38 + Math.round(Math.random() * 14));
      setUptime((u) => u + 1);
      setNow(new Date());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const fmtUp = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${ss}`;
  };

  // Render a placeholder timestamp on the server so SSR + first hydration align.
  const bkkTime = now
    ? now.toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Bangkok" })
    : "--:--:--";

  return (
    <footer className="aegis-status">
      <span className="flex items-center gap-1.5" style={{ color: "var(--aegis-ok)" }}>
        <span className="aegis-dot">
          <span className="aegis-dot-pulse" />
          <span className="aegis-dot-core" />
        </span>
        <span>connected</span>
      </span>
      <span className="aegis-status-sep">·</span>
      <span>latency <b className="tabular-nums">{latency}ms</b></span>
      <span className="aegis-status-sep">·</span>
      <span>uptime <b className="tabular-nums">{fmtUp(uptime)}</b></span>
      <span className="aegis-status-sep">·</span>
      <span>build <b>v1.0.0</b></span>
      <span className="aegis-status-sep">·</span>
      <span>last sync <b>just now</b></span>
      <span className="ml-auto" style={{ color: "var(--aegis-dim)" }}>BKK · <span className="tabular-nums">{bkkTime}</span></span>
      <span className="aegis-status-sep">·</span>
      <span style={{ color: "var(--aegis-dim)" }}>
        press <span className="aegis-kbd">/</span> to command
      </span>
    </footer>
  );
}
