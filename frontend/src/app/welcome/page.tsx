"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Sparkles,
  LineChart,
  Calendar,
  GanttChart,
  FileText,
  KeyRound,
  Bell,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: LineChart,
    title: "Financial health score",
    body: "0–100 gauge plus breakdown. Cash-flow forecast up to 12 months ahead.",
  },
  {
    icon: Calendar,
    title: "Calendar + Gantt planning",
    body: "See every income, expense, and plan on a timeline. Drag to reschedule.",
  },
  {
    icon: GanttChart,
    title: "AI advisor powered by Claude",
    body: "Tool-use structured output for spending analysis, recommendations, and weekly summaries.",
  },
  {
    icon: FileText,
    title: "PDF + CSV exports",
    body: "Server-side WeasyPrint renders a print-ready monthly report. CSV for spreadsheets.",
  },
  {
    icon: Bell,
    title: "Server-backed notifications",
    body: "Budget overruns, upcoming bills, goal milestones, and anomaly alerts with dedupe keys.",
  },
  {
    icon: KeyRound,
    title: "Keyboard-first",
    body: "N for new, / for the command palette, ? for the cheatsheet, g-chords for nav.",
  },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Shield size={16} className="text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight">Aegis</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link href="/register">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      <main>
        <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground mb-6"
          >
            <Sparkles size={12} className="text-primary" />
            v1.0 — generally available
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
          >
            Money management that{" "}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">
              plans itself
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Aegis combines a calendar planner, a Gantt timeline, and an AI advisor into one
            keyboard-first workspace. Self-hosted, open source, Claude-powered.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link href="/register">
              <Button size="lg" icon={<ArrowRight size={16} />} iconPosition="right">
                Create an account
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Try the demo
              </Button>
            </Link>
          </motion.div>

          <p className="mt-6 text-xs text-muted-foreground">
            Seed data:{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">demo@aegis.local</code>{" "}
            /{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px]">demo-password-123</code>{" "}
            (after running <code>make seed</code>).
          </p>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </motion.div>
            );
          })}
        </section>

        <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-3">Self-hosted, your data stays yours</h2>
          <p className="text-muted-foreground mb-8">
            SQLite out of the box. PostgreSQL or MySQL via <code>DATABASE_URL</code>. Docker
            Compose, one-command deploy, open source.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://github.com/santapong/aegis"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="lg">View on GitHub</Button>
            </a>
            <Link href="/docs">
              <Button size="lg">Read the docs</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-border text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>© Aegis — MIT licensed</span>
        <span>v1.0.0</span>
      </footer>
    </div>
  );
}
