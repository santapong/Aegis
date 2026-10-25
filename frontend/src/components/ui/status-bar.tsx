"use client";
import Link from "next/link";
/** Navigation hints only. No invented connectivity, latency or financial data. */
export function StatusBar() {
  return <div className="aegis-status" aria-label="Workspace shortcuts" style={{ position: "relative", zIndex: 1 }}><span style={{ color: "var(--fg-2)" }}>Aegis <span style={{ color: "var(--dim)" }}>· Room to look ahead</span></span><span className="ml-auto flex items-center gap-4"><Link href="/docs" style={{ color: "var(--dim)" }}>Help & guides</Link><span className="hidden md:inline" style={{ color: "var(--dim)" }}><span className="aegis-kbd">?</span> Shortcuts</span></span></div>;
}
