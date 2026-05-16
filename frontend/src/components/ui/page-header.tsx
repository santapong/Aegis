"use client";

import { ReactNode } from "react";

interface PageHeaderProps {
  /** Optional 3-letter monospace code (DSH, TXN, BDG…). */
  code?: string;
  /** Optional eyebrow line — e.g. "DSH · 2026-04-27 · Mon". Falls back to <code> alone. */
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}

/**
 * PageHeader — display title (theme font: sans Observatory, roman serif
 * Constellation, italic serif Supernova) with monospace eyebrow + sub + a
 * leading accent pip. Mirrors the `<PageHead>` pattern in the galaxy
 * handoff; kept here as the older API for compatibility.
 */
export function PageHeader({ code, eyebrow, title, subtitle, action }: PageHeaderProps) {
  const eyebrowText = eyebrow ?? code;
  return (
    <div className="flex items-end justify-between gap-4 pb-3.5 mb-1" style={{ borderBottom: "1px dashed var(--pane-edge)" }}>
      <div className="min-w-0">
        {eyebrowText && (
          <div className="aegis-opener-eyebrow flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "var(--hero-glow)" }}
            />
            {eyebrowText}
          </div>
        )}
        <h1 className="aegis-opener-title">{title}</h1>
        {subtitle && (
          <p className="aegis-opener-sub mt-3">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
