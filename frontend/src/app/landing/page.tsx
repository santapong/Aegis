"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CosmicChart } from "@/components/shell/cosmic-chart";
import { CodeChip } from "@/components/shell/code-chip";

const STATS = [
  { l: "Latency", v: "42ms", s: "p95 · global" },
  { l: "Coverage", v: "12.4k", s: "merchants mapped" },
  { l: "Self-host", v: "100%", s: "your data, your box" },
  { l: "Open", v: "MIT", s: "source available" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ color: "var(--fg)" }}>
      <header className="front-nav">
        <Link href="/landing" className="brand-name">
          AEG<span style={{ color: "var(--accent)" }}>IS</span>
        </Link>
        <span style={{ color: "var(--dim-2)" }}>·</span>
        <Link href="/landing">Product</Link>
        <Link href="/landing">Pricing</Link>
        <Link href="/landing">Changelog</Link>
        <Link href="/docs">Docs</Link>
        <span className="ml-auto flex items-center gap-3">
          <Link href="/login">Sign in</Link>
          <Link href="/register" className="btn-galaxy">
            Get started
          </Link>
        </span>
      </header>

      <section className="landing-hero">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="font-mono text-[10px] tracking-[1.8px] uppercase mb-6 flex items-center gap-2"
            style={{ color: "var(--dim)" }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "var(--hero-glow)" }}
            />
            v1.0 · generally available
          </div>
          <h1 className="landing-title">Personal finance, mapped.</h1>
          <p className="landing-sub">
            Aegis is a calendar planner, a Gantt timeline, and an AI advisor for your
            money — all in one keyboard-first workspace. Self-hosted, open source,
            Claude-powered.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/register" className="btn-galaxy">
              Open the workspace
            </Link>
            <Link href="/login" className="btn-galaxy ghost">
              Sign in
            </Link>
          </div>
          <p className="mt-6 font-mono text-[11px]" style={{ color: "var(--dim)" }}>
            Seed:{" "}
            <CodeChip>demo@aegis.local</CodeChip>{" "}
            <CodeChip>demo-password-123</CodeChip>
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="justify-self-center"
        >
          <CosmicChart />
        </motion.div>
      </section>

      <section className="landing-stats">
        {STATS.map((s) => (
          <div key={s.l} className="landing-stat">
            <div className="l">{s.l}</div>
            <div className="v">{s.v}</div>
            <div className="s">{s.s}</div>
          </div>
        ))}
      </section>

      <footer
        className="px-14 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px]"
        style={{ color: "var(--dim)", position: "relative", zIndex: 1 }}
      >
        <span>© Aegis · MIT licensed</span>
        <span className="flex items-center gap-3">
          <Link href="/docs">Docs</Link>
          <span style={{ color: "var(--dim-2)" }}>·</span>
          <a href="https://github.com/santapong/aegis" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span style={{ color: "var(--dim-2)" }}>·</span>
          <span>v1.0.0</span>
        </span>
      </footer>
    </div>
  );
}
