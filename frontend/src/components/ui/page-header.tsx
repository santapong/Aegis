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
 * PageHeader — italic Instrument Serif title with monospace eyebrow + sub.
 * Mirrors the `<PageOpener>` pattern from the design handoff.
 */
export function PageHeader({ code, eyebrow, title, subtitle, action }: PageHeaderProps) {
  const eyebrowText = eyebrow ?? code;
  return (
    <div className="flex items-end justify-between gap-4 mb-2">
      <div className="min-w-0">
        {eyebrowText && (
          <div className="aegis-opener-eyebrow">{eyebrowText}</div>
        )}
        <h1 className="aegis-opener-title">{title}</h1>
        {subtitle && (
          <p className="aegis-opener-sub">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
