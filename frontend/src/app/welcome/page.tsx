"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { Search, ArrowLeft, ArrowRight } from "lucide-react";
import { CodeChip } from "@/components/shell/code-chip";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: "01", label: "Verify identity" },
  { num: "02", label: "Connect institutions" },
  { num: "03", label: "Import history" },
  { num: "04", label: "Calibrate AI" },
];

const BANKS: Array<{ name: string; sub: string; color: string }> = [
  { name: "Chase", sub: "US · retail", color: "#117ACA" },
  { name: "Bank of America", sub: "US · retail", color: "#E61030" },
  { name: "Wells Fargo", sub: "US · retail", color: "#D71E28" },
  { name: "Citi", sub: "US · retail", color: "#003B70" },
  { name: "Capital One", sub: "US · retail", color: "#004977" },
  { name: "Apple Card", sub: "US · card", color: "#1B1B1B" },
  { name: "Robinhood", sub: "US · broker", color: "#00C805" },
  { name: "Fidelity", sub: "US · broker", color: "#368727" },
  { name: "Coinbase", sub: "Global · crypto", color: "#0052FF" },
  { name: "Revolut", sub: "EU · fintech", color: "#0075EB" },
  { name: "Wise", sub: "Global · fx", color: "#9FE870" },
  { name: "SCB", sub: "TH · retail", color: "#4F2682" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function WelcomePage() {
  const [filter, setFilter] = useState("");
  const filtered = BANKS.filter((b) =>
    b.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div
      className="min-h-screen relative z-[1]"
      style={{ color: "var(--fg)" }}
    >
      {/* Step indicator */}
      <header className="welcome-steps">
        <CodeChip>WEL</CodeChip>
        <span style={{ color: "var(--dim-2)" }}>·</span>
        {STEPS.map((s, i) => (
          <div
            key={s.num}
            className={cn("welcome-step", i === 1 && "active")}
          >
            <span className="num">{s.num}</span>
            <span>{s.label}</span>
            {i < STEPS.length - 1 && (
              <span className="ml-3" style={{ color: "var(--dim-2)" }}>
                →
              </span>
            )}
          </div>
        ))}
        <Link
          href="/"
          className="ml-auto font-mono text-[11px] tracking-[1.4px]"
          style={{ color: "var(--dim)" }}
        >
          skip onboarding →
        </Link>
      </header>

      <motion.main
        className="max-w-5xl mx-auto px-8 py-12"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div
          className="font-mono text-[10px] tracking-[1.8px] uppercase mb-3 flex items-center gap-2"
          style={{ color: "var(--dim)" }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--accent)", boxShadow: "var(--hero-glow)" }}
          />
          step 02 of 04 · connect institutions
        </div>
        <h1
          className="text-[44px] leading-[1.05] mb-4"
          style={{
            fontFamily: "var(--display-font)",
            fontStyle: "var(--display-style)",
            fontWeight: "var(--display-weight)",
            letterSpacing: "var(--display-tracking)",
            color: "var(--fg)",
          }}
        >
          Where should Aegis read from?
        </h1>
        <p
          className="font-mono text-[13px] leading-[1.65] max-w-[60ch] mb-8"
          style={{ color: "var(--fg-2)" }}
        >
          Pick the accounts you want mapped. Read-only by default. You can add or
          revoke any institution from <b style={{ color: "var(--fg)" }}>Settings →
          Integrations</b> later.
        </p>

        <div className="relative max-w-[420px] mb-8">
          <label htmlFor="welcome-institution-search" className="sr-only">
            Search supported institutions
          </label>
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--dim)" }}
            aria-hidden
          />
          <input
            id="welcome-institution-search"
            placeholder="Search 12 supported institutions…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex h-11 w-full px-3 pl-10 text-sm focus-visible:outline-none"
            style={{
              background: "var(--pane-2)",
              color: "var(--fg)",
              border: "1px solid var(--pane-edge)",
              borderRadius: "var(--card-radius)",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((b) => (
            <button
              key={b.name}
              className="flex items-center gap-3 p-3 text-left transition-all hover:translate-y-[-1px]"
              style={{
                border: "1px solid var(--pane-edge)",
                background: "var(--pane)",
                borderRadius: "var(--card-radius)",
                backdropFilter: "blur(var(--card-blur))",
              }}
            >
              <span
                className="flex items-center justify-center font-mono text-[10px] tracking-[0.8px] flex-shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: b.color,
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {initials(b.name)}
              </span>
              <div className="min-w-0">
                <div
                  className="font-medium text-[13px] truncate"
                  style={{ color: "var(--fg)" }}
                >
                  {b.name}
                </div>
                <div
                  className="font-mono text-[10px] tracking-[1.2px] uppercase truncate"
                  style={{ color: "var(--dim)" }}
                >
                  {b.sub}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p
          className="mt-10 font-mono text-[11px] max-w-[60ch] leading-[1.6]"
          style={{ color: "var(--dim)" }}
        >
          Aegis uses bank-grade aggregators with read-only OAuth scopes. Aegis never
          stores your bank credentials — only the tokens the aggregator hands back, and
          those can be revoked at any time. By continuing you agree to the{" "}
          <Link href="/docs" style={{ color: "var(--accent)" }}>
            data-handling notes
          </Link>
          .
        </p>

        <div className="mt-10 flex items-center justify-between gap-3">
          <Link href="/login" className="btn-galaxy ghost">
            <ArrowLeft size={14} /> Back
          </Link>
          <Link href="/" className="btn-galaxy">
            Continue <ArrowRight size={14} />
          </Link>
        </div>
      </motion.main>
    </div>
  );
}
