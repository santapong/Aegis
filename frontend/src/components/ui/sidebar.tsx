"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  Bot,
  Moon,
  Sun,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Menu,
  LogOut,
} from "lucide-react";

/* Aegis monogram — shield-ish hex glyph, all vector primitives. */
function AegisMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2 L21 6 V13 C21 17.5 16.5 21.2 12 22 C7.5 21.2 3 17.5 3 13 V6 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 12 H16 M12 8 V16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </svg>
  );
}

/* Inline sparkline — used in the PULSE section of the sidebar. */
function Sparkline({
  data,
  w = 96,
  h = 20,
  stroke = "currentColor",
}: {
  data: number[];
  w?: number;
  h?: number;
  stroke?: string;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(1, max - min);
  const stepX = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / span) * (h - 2) - 1;
    return [x, y] as const;
  });
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={1.8} fill={stroke} />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  code: string;
  k: string;
  tourId?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Sidebar nav — 3-column rows: monospace code · sans label · keyboard hint.
 * Codes are pulled directly from the design handoff (DSH/TXN/BDG/...).
 */
const navSections: NavSection[] = [
  {
    label: "CHANNELS",
    items: [
      { href: "/", label: "Dashboard", code: "DSH", k: "g d", tourId: "sidebar-dashboard" },
      { href: "/transactions", label: "Transactions", code: "TXN", k: "g t", tourId: "sidebar-transactions" },
      { href: "/budgets", label: "Budgets", code: "BDG", k: "g b", tourId: "sidebar-budgets" },
      { href: "/savings", label: "Savings", code: "SAV", k: "g s" },
      { href: "/debts", label: "Debt", code: "DBT", k: "g x" },
      { href: "/plans", label: "Plans", code: "PLN", k: "g p" },
      { href: "/calendar", label: "Calendar", code: "CAL", k: "g c" },
      { href: "/gantt", label: "Gantt", code: "GNT", k: "g g" },
      { href: "/reports", label: "Reports", code: "RPT", k: "g r" },
      { href: "/payments", label: "Payments", code: "PAY", k: "g y" },
      { href: "/docs", label: "Documents", code: "DOC", k: "g o" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, theme, toggleSidebar, toggleTheme, toggleAIPanel } = useAppStore();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      useAppStore.setState({ sidebarOpen: false });
    }
  }, [pathname]);

  // PULSE sparkline data — placeholder shape; the live values come from the
  // status bar/dashboard summary endpoint in production.
  const sparkA = [3, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8];
  const sparkB = [9, 8, 9, 7, 8, 6, 7, 5, 6, 4, 5, 3, 4];

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-card/90 backdrop-blur-xl border-b border-border">
        <button onClick={toggleSidebar} className="p-2 rounded hover:bg-accent transition-colors">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-primary"><AegisMark size={18} /></span>
          <span className="font-mono text-sm font-semibold tracking-[0.2em] text-foreground">AEGIS</span>
        </div>
        <button
          onClick={toggleAIPanel}
          data-tour-id="ai-advisor"
          className="p-2 rounded hover:bg-accent transition-colors"
        >
          <Bot size={20} />
        </button>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          "h-screen flex flex-col border-r border-border bg-card transition-all duration-300 z-50",
          "fixed lg:relative",
          sidebarOpen ? "w-[260px] translate-x-0" : "w-[68px] -translate-x-full lg:translate-x-0"
        )}
        style={{ background: "var(--aegis-panel)" }}
      >
        {/* Brand block — monogram + AEGIS lockup + sub-tag, dashed-border footer. */}
        <div className="flex items-center justify-between p-4 pb-3.5 border-b border-border">
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5">
              <span className="text-primary"><AegisMark size={20} /></span>
              <div className="leading-tight">
                <div className="font-mono text-[13px] font-semibold tracking-[0.22em] text-foreground">AEGIS</div>
                <div className="font-mono text-[10px] tracking-[0.04em]" style={{ color: "var(--aegis-dim)" }}>
                  money / terminal
                </div>
              </div>
            </div>
          ) : (
            <span className="text-primary mx-auto"><AegisMark size={20} /></span>
          )}
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="mx-auto my-2 p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <PanelLeft size={16} />
          </button>
        )}

        <nav className="flex-1 px-2.5 py-4 overflow-y-auto flex flex-col gap-5">
          {navSections.map((section) => (
            <div key={section.label} className="flex flex-col gap-1.5">
              {sidebarOpen && (
                <p
                  className="px-1 font-mono text-[10px] tracking-[1.4px]"
                  style={{ color: "var(--aegis-dim)" }}
                >
                  {section.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tour-id={item.tourId}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn(
                        "group grid items-center gap-2.5 px-2 py-1.5 rounded transition-all border border-transparent",
                        sidebarOpen
                          ? "grid-cols-[36px_1fr_auto] text-left"
                          : "grid-cols-1 justify-items-center",
                        isActive
                          ? "bg-[color:var(--aegis-panel-2)] border-[color:var(--aegis-line-2)]"
                          : "hover:bg-[color:var(--aegis-panel-2)]"
                      )}
                      style={
                        isActive
                          ? { boxShadow: "inset 2px 0 0 var(--primary)" }
                          : undefined
                      }
                    >
                      <span
                        className={cn(
                          "font-mono text-[10px] tracking-[1.2px]",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {item.code}
                      </span>
                      {sidebarOpen && (
                        <>
                          <span
                            className={cn(
                              "text-[13px]",
                              isActive ? "text-foreground" : "text-foreground/75"
                            )}
                          >
                            {item.label}
                          </span>
                          <span
                            className="font-mono text-[10px]"
                            style={{ color: "var(--aegis-dim-2)" }}
                          >
                            {item.k}
                          </span>
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {sidebarOpen && (
            <div className="flex flex-col gap-1.5">
              <p
                className="px-1 font-mono text-[10px] tracking-[1.4px]"
                style={{ color: "var(--aegis-dim)" }}
              >
                PULSE — 30D
              </p>
              <div className="px-1 grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5 font-mono text-[11px]">
                <span style={{ color: "var(--aegis-dim)" }}>Net worth</span>
                <span style={{ color: "var(--aegis-ok)" }}>
                  <Sparkline data={sparkA} stroke="currentColor" />
                </span>
                <span className="tabular-nums" style={{ color: "var(--aegis-ok)" }}>+8.4%</span>
              </div>
              <div className="px-1 grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5 font-mono text-[11px]">
                <span style={{ color: "var(--aegis-dim)" }}>Burn rate</span>
                <span style={{ color: "var(--aegis-warn)" }}>
                  <Sparkline data={sparkB} stroke="currentColor" />
                </span>
                <span className="tabular-nums" style={{ color: "var(--aegis-warn)" }}>−4.2%</span>
              </div>
            </div>
          )}
        </nav>

        <div className="p-2 space-y-0.5 border-t border-border">
          <button
            onClick={toggleAIPanel}
            data-tour-id="ai-advisor"
            className="grid w-full grid-cols-[36px_1fr_auto] items-center gap-2.5 px-2 py-1.5 rounded text-left transition-all hover:bg-[color:var(--aegis-panel-2)]"
          >
            <span className="font-mono text-[10px] tracking-[1.2px] text-primary">AI</span>
            {sidebarOpen && (
              <>
                <span className="text-[13px] text-foreground/75">AI Advisor</span>
                <span className="font-mono text-[10px]" style={{ color: "var(--aegis-dim-2)" }}>
                  ⌘ A
                </span>
              </>
            )}
          </button>
          <Link
            href="/settings"
            className={cn(
              "grid w-full grid-cols-[36px_1fr_auto] items-center gap-2.5 px-2 py-1.5 rounded text-left transition-all",
              pathname === "/settings"
                ? "bg-[color:var(--aegis-panel-2)] text-foreground"
                : "hover:bg-[color:var(--aegis-panel-2)]"
            )}
          >
            <span className="font-mono text-[10px] tracking-[1.2px]" style={{ color: "var(--aegis-dim)" }}>SET</span>
            {sidebarOpen && (
              <>
                <span className="text-[13px] text-foreground/75">Settings</span>
                <Settings size={12} className="text-muted-foreground" />
              </>
            )}
          </Link>
          <button
            onClick={toggleTheme}
            className="grid w-full grid-cols-[36px_1fr_auto] items-center gap-2.5 px-2 py-1.5 rounded text-left transition-all hover:bg-[color:var(--aegis-panel-2)]"
          >
            <span className="font-mono text-[10px] tracking-[1.2px]" style={{ color: "var(--aegis-dim)" }}>
              {theme === "light" ? "DRK" : "LGT"}
            </span>
            {sidebarOpen && (
              <>
                <span className="text-[13px] text-foreground/75">
                  {theme === "light" ? "Dark Mode" : "Light Mode"}
                </span>
                {theme === "light" ? (
                  <Moon size={12} className="text-muted-foreground" />
                ) : (
                  <Sun size={12} className="text-muted-foreground" />
                )}
              </>
            )}
          </button>

          {user && (
            <>
              <div className="my-1.5 border-t border-border" />
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded font-mono text-[11px] font-semibold shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 70%, var(--background)))",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0 leading-tight">
                    <p className="font-mono text-[11px] text-foreground truncate">{user.username}</p>
                    <p className="font-mono text-[10px] truncate" style={{ color: "var(--aegis-dim)" }}>
                      {user.email}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={logout}
                className="grid w-full grid-cols-[36px_1fr_auto] items-center gap-2.5 px-2 py-1.5 rounded text-left transition-all hover:bg-destructive/10 hover:text-destructive"
              >
                <span className="font-mono text-[10px] tracking-[1.2px]" style={{ color: "var(--aegis-dim)" }}>OUT</span>
                {sidebarOpen && (
                  <>
                    <span className="text-[13px]">Sign out</span>
                    <LogOut size={12} className="text-muted-foreground" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
