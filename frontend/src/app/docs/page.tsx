"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Server,
  Rocket,
  Database,
  Code2,
  Shield,
  Terminal,
  Globe,
  Key,
  Layers,
  ArrowRight,
} from "lucide-react";

const apiEndpoints = [
  {
    group: "Transactions",
    endpoints: [
      { method: "GET", path: "/api/transactions", desc: "List transactions (filter by type, category, dates, tags, query)" },
      { method: "POST", path: "/api/transactions", desc: "Create a new transaction" },
      { method: "PUT", path: "/api/transactions/{id}", desc: "Update a transaction" },
      { method: "DELETE", path: "/api/transactions/{id}", desc: "Delete a transaction" },
      { method: "GET", path: "/api/transactions/summary", desc: "Income/expense totals + by-category" },
      { method: "GET", path: "/api/transactions/recurring", desc: "Recurring transactions + monthly equivalents" },
      { method: "GET", path: "/api/transactions/anomalies", desc: "Spending anomaly detection" },
      { method: "POST", path: "/api/transactions/import/preview", desc: "Preview a CSV import" },
      { method: "POST", path: "/api/transactions/import/confirm", desc: "Confirm a CSV import" },
    ],
  },
  {
    group: "Plans & Goals",
    endpoints: [
      { method: "GET", path: "/api/plans", desc: "List all plans" },
      { method: "POST", path: "/api/plans", desc: "Create a new plan" },
      { method: "GET", path: "/api/plans/{id}", desc: "Get plan by ID" },
      { method: "PUT", path: "/api/plans/{id}", desc: "Update a plan" },
      { method: "DELETE", path: "/api/plans/{id}", desc: "Delete a plan" },
      { method: "PATCH", path: "/api/plans/{id}/progress", desc: "Update plan progress" },
    ],
  },
  {
    group: "Budgets",
    endpoints: [
      { method: "GET", path: "/api/budgets", desc: "List all budgets" },
      { method: "POST", path: "/api/budgets", desc: "Create a new budget" },
      { method: "PUT", path: "/api/budgets/{id}", desc: "Update a budget" },
      { method: "DELETE", path: "/api/budgets/{id}", desc: "Delete a budget" },
      { method: "GET", path: "/api/budgets/comparison", desc: "Budget vs actual spending" },
    ],
  },
  {
    group: "Trips",
    endpoints: [
      { method: "GET", path: "/api/trips", desc: "List trips" },
      { method: "POST", path: "/api/trips", desc: "Create a new trip" },
      { method: "PUT", path: "/api/trips/{id}", desc: "Update a trip" },
      { method: "DELETE", path: "/api/trips/{id}", desc: "Delete a trip" },
      { method: "GET", path: "/api/trips/{id}/summary", desc: "Rolled-up budget vs spent for a trip" },
    ],
  },
  {
    group: "Reports & Dashboard",
    endpoints: [
      { method: "GET", path: "/api/reports/category-comparison", desc: "Monthly category comparison" },
      { method: "GET", path: "/api/reports/export", desc: "Export transactions as CSV" },
      { method: "GET", path: "/api/reports/export.pdf", desc: "Export a PDF report" },
      { method: "GET", path: "/api/dashboard/summary", desc: "Dashboard KPI summary" },
      { method: "GET", path: "/api/dashboard/charts", desc: "Dashboard chart data" },
      { method: "GET", path: "/api/dashboard/health-score", desc: "Financial health score (0–100)" },
      { method: "GET", path: "/api/dashboard/cashflow-forecast", desc: "6-month cash flow forecast" },
    ],
  },
  {
    group: "Calendar & Gantt",
    endpoints: [
      { method: "GET", path: "/api/calendar/events", desc: "List calendar events (derived from plans)" },
      { method: "PUT", path: "/api/calendar/events/{id}/move", desc: "Reschedule an event" },
      { method: "GET", path: "/api/gantt/tasks", desc: "List Gantt tasks (derived from plans)" },
      { method: "PUT", path: "/api/gantt/tasks/{id}", desc: "Update a Gantt task" },
    ],
  },
  {
    group: "AI",
    endpoints: [
      { method: "POST", path: "/api/ai/analyze", desc: "AI-powered financial analysis" },
      { method: "POST", path: "/api/ai/recommend", desc: "General financial recommendations" },
      { method: "POST", path: "/api/ai/forecast", desc: "AI-powered financial forecast" },
      { method: "GET", path: "/api/ai/history", desc: "Past AI recommendations" },
      { method: "GET", path: "/api/ai/weekly-summary", desc: "This-week vs last-week summary" },
      { method: "GET", path: "/api/ai/insights", desc: "Auto-generated insights" },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: "info",
  POST: "success",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "danger",
};

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("guide");

  return (
    <motion.div
      className="max-w-4xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Documents"
          subtitle="API reference, user guide, and setup instructions"
        />
      </motion.div>

      <motion.div variants={staggerItem}>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <TabList>
            <Tab value="guide">User Guide</Tab>
            <Tab value="api">API Reference</Tab>
            <Tab value="setup">Setup</Tab>
          </TabList>

          {/* ── User Guide ── */}
          <TabPanel value="guide">
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Shield size={20} className="text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold">Welcome to Aegis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Aegis is an AI-powered financial planning platform that helps you manage your money
                    with smart budgets, transaction tracking, financial goals, and intelligent recommendations
                    powered by Claude AI.
                  </p>
                </CardContent>
              </Card>

              {[
                {
                  icon: Layers,
                  title: "Dashboard",
                  desc: "Your financial overview at a glance. View KPI cards for total income, expenses, net savings, and transaction count. The health score ring shows your overall financial wellness (A–F grading). Spending charts and trend lines help you spot patterns.",
                },
                {
                  icon: ArrowRight,
                  title: "Transactions",
                  desc: "Track every income and expense. Filter by type, category, or date range. View summary cards showing totals. Add new transactions with the modal form — amount, category, date, and description are all supported.",
                },
                {
                  icon: Globe,
                  title: "Plans & Goals",
                  desc: "Set financial goals with target amounts, deadlines, and priorities. Track progress with visual rings and inline sliders. Organize plans by category (income, expense, investment, savings) and status (planned, in progress, completed).",
                },
                {
                  icon: Code2,
                  title: "Budgets",
                  desc: "Create budgets for spending categories with start/end dates. Monitor progress bars showing spent vs. allocated amounts. Budget comparison reports show how actual spending compares to your plan.",
                },
                {
                  icon: BookOpen,
                  title: "Reports & Analytics",
                  desc: "View monthly spending comparisons, anomaly detection (flags spending >2x your category average), financial health scores, and 6-month cash flow forecasts. Export data as CSV for external analysis.",
                },
                {
                  icon: Terminal,
                  title: "AI Advisor",
                  desc: "Click the AI Advisor button to open the analysis panel. Get AI-powered financial insights, spending pattern analysis, and smart recommendations. Accept suggestions directly into your plans with one click.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <Card key={title}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <Icon size={18} className="text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">{title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabPanel>

          {/* ── API Reference ── */}
          <TabPanel value="api">
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Server size={20} className="text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold">REST API</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Base URL: <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">http://localhost:8000</code>
                    {" · "}
                    Interactive docs at{" "}
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">/docs</code>
                    {" "}(Swagger UI) and{" "}
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">/redoc</code>
                  </p>
                </CardContent>
              </Card>

              {apiEndpoints.map((group) => (
                <Card key={group.group}>
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-3">{group.group}</h4>
                    <div className="space-y-2">
                      {group.endpoints.map((ep) => (
                        <div
                          key={`${ep.method}-${ep.path}`}
                          className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <Badge variant={methodColors[ep.method] as "info" | "success" | "warning" | "danger"}>
                            {ep.method}
                          </Badge>
                          <code className="text-xs font-mono text-foreground shrink-0">{ep.path}</code>
                          <span className="text-xs text-muted-foreground hidden sm:inline ml-auto">{ep.desc}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabPanel>

          {/* ── Setup Instructions ── */}
          <TabPanel value="setup">
            <div className="space-y-6">
              {/* Quick Start */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Rocket size={20} className="text-purple-500" />
                    </div>
                    <h3 className="text-lg font-semibold">Quick Start</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { step: "1", cmd: "git clone <repo-url> && cd money-management-project", label: "Clone the repository" },
                      { step: "2", cmd: "cp .env.example .env", label: "Create your environment file" },
                      { step: "3", cmd: "docker compose up --build", label: "Start with Docker Compose" },
                      { step: "4", cmd: null, label: "Open http://localhost:3000 in your browser" },
                    ].map(({ step, cmd, label }) => (
                      <div key={step} className="flex items-start gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold shrink-0 mt-0.5">
                          {step}
                        </span>
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          {cmd && (
                            <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded mt-1 inline-block">
                              {cmd}
                            </code>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Database Configuration */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Database size={20} className="text-orange-500" />
                    </div>
                    <h3 className="text-lg font-semibold">Database Configuration</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Aegis supports PostgreSQL, MySQL, and SQLite. Set the <code className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">DATABASE_URL</code> environment variable to connect to your preferred database.
                  </p>
                  <div className="space-y-3">
                    {[
                      { db: "SQLite", url: "sqlite:///./money_management.db", note: "Default — no external database needed" },
                      { db: "PostgreSQL", url: "postgresql://user:pass@host:5432/dbname", note: "Recommended for production" },
                      { db: "MySQL", url: "mysql+pymysql://user:pass@host:3306/dbname", note: "Full MySQL/MariaDB support" },
                    ].map(({ db, url, note }) => (
                      <div key={db} className="p-3 rounded-lg bg-muted">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">{db}</span>
                          <span className="text-xs text-muted-foreground">— {note}</span>
                        </div>
                        <code className="text-xs font-mono text-muted-foreground break-all">{url}</code>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    If you already have a database, simply set DATABASE_URL in your <code className="px-1 py-0.5 rounded bg-muted font-mono">.env</code> file to connect to it. Tables are auto-created on first startup.
                  </p>
                </CardContent>
              </Card>

              {/* Environment Variables */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Key size={20} className="text-green-500" />
                    </div>
                    <h3 className="text-lg font-semibold">Environment Variables</h3>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: "DATABASE_URL", desc: "Database connection string", required: true },
                      { name: "ANTHROPIC_API_KEY", desc: "Claude API key for AI features", required: false },
                      { name: "DEBUG", desc: "Enable debug mode (true/false)", required: false },
                      { name: "CORS_ORIGINS", desc: "Allowed CORS origins (JSON array)", required: false },
                      { name: "NEXT_PUBLIC_API_URL", desc: "Backend API URL for frontend", required: false },
                    ].map(({ name, desc, required }) => (
                      <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-semibold">{name}</code>
                          {required && <Badge variant="danger">Required</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Development Mode */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Code2 size={20} className="text-blue-500" />
                    </div>
                    <h3 className="text-lg font-semibold">Development Mode</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    For local development with hot reload, use the dev compose override:
                  </p>
                  <code className="text-xs font-mono bg-muted px-3 py-2 rounded-lg block">
                    docker compose -f docker-compose.yml -f docker-compose.dev.yml up
                  </code>
                  <p className="text-xs text-muted-foreground mt-3">
                    This mounts source code as volumes and enables hot reloading for both frontend and backend.
                  </p>
                </CardContent>
              </Card>

              {/* Tech Stack */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Tech Stack</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { category: "Frontend", items: "Next.js 15, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion, Recharts, Zustand, TanStack Query" },
                      { category: "Backend", items: "FastAPI, SQLAlchemy 2.0, Pydantic, Uvicorn" },
                      { category: "Database", items: "PostgreSQL, MySQL, SQLite" },
                      { category: "AI", items: "Claude API (Anthropic)" },
                      { category: "Infrastructure", items: "Docker, Docker Compose, Multi-stage builds" },
                    ].map(({ category, items }) => (
                      <div key={category} className="p-3 rounded-lg bg-muted">
                        <p className="text-sm font-semibold mb-1">{category}</p>
                        <p className="text-xs text-muted-foreground">{items}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabPanel>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
