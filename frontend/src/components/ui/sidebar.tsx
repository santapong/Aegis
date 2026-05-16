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
  Settings,
  PanelLeftClose,
  PanelLeft,
  Menu,
  LogOut,
  LayoutDashboard,
  ArrowLeftRight,
  BarChart3,
  Wallet,
  PiggyBank,
  TrendingUp,
  Banknote,
  Receipt,
  Calendar as CalendarIcon,
  GanttChartSquare,
  Plane,
  Sparkles,
  BookOpen,
  Compass,
  type LucideIcon,
} from "lucide-react";
import { Sparkline } from "@/components/shell/sparkline";

/**
 * BrandMark — galaxy nebula disc. White glint top-left, accent radial fill,
 * dashed orbit ring. Replaces the previous AegisShield monogram so the brand
 * picks up the active theme's accent automatically.
 */
function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        position: "relative",
        display: "inline-block",
        background:
          "radial-gradient(circle at 30% 30%, #fff 0%, transparent 25%), radial-gradient(circle at 60% 60%, var(--accent) 0%, var(--accent-2) 60%, transparent 100%)",
        boxShadow: "0 0 0 1px var(--pane-edge-2) inset, var(--hero-glow)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: -4,
          borderRadius: "50%",
          border: "1px dashed var(--pane-edge)",
        }}
      />
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  code: string;
  icon: LucideIcon;
  k: string;
  tourId?: string;
}

interface NavCluster {
  index: string;
  label: string;
  items: NavItem[];
}

/**
 * Four navigation clusters — Overview, Money, Plan, System. Order and codes
 * come straight from the design handoff (galaxy-v2 sidebar spec). Each item
 * has a lucide icon (replaces the prototype's geometric glyphs).
 */
const clusters: NavCluster[] = [
  {
    index: "01",
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", code: "DSH", icon: LayoutDashboard, k: "⌘1", tourId: "sidebar-dashboard" },
      { href: "/transactions", label: "Transactions", code: "TXN", icon: ArrowLeftRight, k: "⌘2", tourId: "sidebar-transactions" },
      { href: "/reports", label: "Reports", code: "RPT", icon: BarChart3, k: "⌘3" },
    ],
  },
  {
    index: "02",
    label: "Money",
    items: [
      { href: "/budgets", label: "Budgets", code: "BDG", icon: Wallet, k: "⌘4", tourId: "sidebar-budgets" },
      { href: "/savings", label: "Savings", code: "SAV", icon: PiggyBank, k: "⌘5" },
      { href: "/investments", label: "Investments", code: "INV", icon: TrendingUp, k: "⌘6" },
      { href: "/debts", label: "Debts", code: "DBT", icon: Banknote, k: "⌘7" },
      { href: "/payments", label: "Payments", code: "PAY", icon: Receipt, k: "⌘8" },
    ],
  },
  {
    index: "03",
    label: "Plan",
    items: [
      { href: "/calendar", label: "Calendar", code: "CAL", icon: CalendarIcon, k: "⇧C" },
      { href: "/gantt", label: "Gantt", code: "GNT", icon: GanttChartSquare, k: "⇧G" },
      { href: "/trips", label: "Trips", code: "TRP", icon: Plane, k: "⇧T" },
      { href: "/plans", label: "Scenarios", code: "PLN", icon: Sparkles, k: "⇧P" },
    ],
  },
  {
    index: "04",
    label: "System",
    items: [
      { href: "/docs", label: "Docs", code: "DOC", icon: BookOpen, k: "⇧/" },
      { href: "/settings", label: "Settings", code: "SET", icon: Settings, k: "⌘," },
      { href: "/welcome", label: "Onboarding", code: "WEL", icon: Compass, k: "⇧W" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, toggleAIPanel } = useAppStore();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      useAppStore.setState({ sidebarOpen: false });
    }
  }, [pathname]);

  const sparkA = [3, 4, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8];
  const sparkB = [9, 8, 9, 7, 8, 6, 7, 5, 6, 4, 5, 3, 4];

  return (
    <>
      {/* Mobile header */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b"
        style={{
          background: "color-mix(in oklab, var(--void) 90%, transparent)",
          borderColor: "var(--pane-edge)",
          backdropFilter: "blur(20px)",
        }}
      >
        <button
          onClick={toggleSidebar}
          className="p-2 rounded transition-colors"
          style={{ color: "var(--fg-2)" }}
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <BrandMark size={18} />
          <span className="font-mono text-sm tracking-[0.2em]" style={{ color: "var(--fg)" }}>
            AEGIS
          </span>
        </div>
        <button
          onClick={toggleAIPanel}
          data-tour-id="ai-advisor"
          className="p-2 rounded transition-colors"
          style={{ color: "var(--fg-2)" }}
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
          "h-screen flex flex-col transition-all duration-300 z-50",
          "fixed lg:relative",
          sidebarOpen ? "w-[260px] translate-x-0" : "w-[68px] -translate-x-full lg:translate-x-0"
        )}
        style={{
          borderRight: "1px solid var(--pane-edge)",
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--void) 88%, transparent), color-mix(in oklab, var(--void) 70%, transparent))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* Brand block */}
        <div
          className="flex items-center justify-between px-4 pt-4 pb-3.5"
          style={{ borderBottom: "1px dashed var(--pane-edge)" }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5">
              <BrandMark size={22} />
              <div className="leading-tight">
                <div
                  className="text-[14px] font-medium tracking-[0.02em]"
                  style={{
                    fontFamily: "var(--display-font)",
                    fontStyle: "var(--display-style)",
                    color: "var(--fg)",
                  }}
                >
                  AEG<span style={{ color: "var(--accent)" }}>IS</span>
                </div>
                <div
                  className="font-mono text-[9.5px] tracking-[1.4px] uppercase"
                  style={{ color: "var(--dim)" }}
                >
                  money / galaxy
                </div>
              </div>
            </div>
          ) : (
            <BrandMark size={22} />
          )}
          {sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded transition-colors"
              style={{ color: "var(--dim)" }}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="mx-auto my-2 p-1.5 rounded transition-colors"
            style={{ color: "var(--dim)" }}
            aria-label="Expand sidebar"
          >
            <PanelLeft size={16} />
          </button>
        )}

        <nav className="flex-1 px-2.5 py-4 overflow-y-auto flex flex-col gap-5">
          {clusters.map((cluster) => (
            <div key={cluster.label} className="flex flex-col gap-1">
              {sidebarOpen && (
                <p
                  className="px-2 pb-1.5 font-mono uppercase"
                  style={{
                    fontSize: "9.5px",
                    letterSpacing: "1.8px",
                    color: "var(--dim-2)",
                  }}
                >
                  Cluster · {cluster.index} · {cluster.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {cluster.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tour-id={item.tourId}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center transition-colors font-mono",
                        sidebarOpen ? "gap-2.5 px-2.5 py-1.5" : "justify-center px-2 py-2"
                      )}
                      style={{
                        fontSize: "12.5px",
                        letterSpacing: "0.2px",
                        borderRadius: "4px",
                        color: isActive ? "var(--accent)" : "var(--fg-2)",
                        background: isActive ? "var(--accent-soft)" : "transparent",
                        boxShadow: isActive ? "inset 0 0 0 1px var(--pane-edge-2)" : "none",
                      }}
                    >
                      {isActive && (
                        <span
                          aria-hidden
                          style={{
                            position: "absolute",
                            left: -1,
                            top: 8,
                            bottom: 8,
                            width: 2,
                            background: "var(--accent)",
                            boxShadow: "var(--hero-glow)",
                          }}
                        />
                      )}
                      <Icon
                        size={14}
                        style={{ color: isActive ? "var(--accent)" : "var(--dim)" }}
                      />
                      {sidebarOpen && (
                        <>
                          <span className="flex-1 truncate" style={{ color: "inherit" }}>
                            {item.label}
                          </span>
                          <span className="kbd">{item.k}</span>
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {sidebarOpen && (
            <div className="flex flex-col gap-1 mt-2">
              <p
                className="px-2 pb-1.5 font-mono uppercase"
                style={{
                  fontSize: "9.5px",
                  letterSpacing: "1.8px",
                  color: "var(--dim-2)",
                }}
              >
                Pulse · 30d
              </p>
              <div className="px-2 grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5 font-mono text-[11px]">
                <span style={{ color: "var(--dim)" }}>Net worth</span>
                <span style={{ color: "var(--ok)" }}>
                  <Sparkline data={sparkA} stroke="currentColor" width={70} height={18} />
                </span>
                <span className="tabular-nums" style={{ color: "var(--ok)" }}>+8.4%</span>
              </div>
              <div className="px-2 grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5 font-mono text-[11px]">
                <span style={{ color: "var(--dim)" }}>Burn rate</span>
                <span style={{ color: "var(--warn)" }}>
                  <Sparkline data={sparkB} stroke="currentColor" width={70} height={18} />
                </span>
                <span className="tabular-nums" style={{ color: "var(--warn)" }}>−4.2%</span>
              </div>
            </div>
          )}
        </nav>

        <div
          className="p-2 space-y-0.5"
          style={{ borderTop: "1px dashed var(--pane-edge)" }}
        >
          <button
            onClick={toggleAIPanel}
            data-tour-id="ai-advisor"
            className={cn(
              "w-full grid items-center gap-2.5 px-2.5 py-1.5 rounded text-left transition-colors",
              sidebarOpen ? "grid-cols-[14px_1fr_auto]" : "grid-cols-1 justify-items-center"
            )}
            style={{ color: "var(--accent)" }}
          >
            <Bot size={14} />
            {sidebarOpen && (
              <>
                <span className="text-[12.5px] font-mono">AI Advisor</span>
                <span className="kbd">⌘A</span>
              </>
            )}
          </button>

          {user && (
            <>
              <div className="my-1.5" style={{ borderTop: "1px dashed var(--pane-edge)" }} />
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded font-mono text-[11px] font-semibold shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 70%, var(--void)))",
                    color: "var(--void)",
                  }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0 leading-tight">
                    <p className="font-mono text-[11px] truncate" style={{ color: "var(--fg)" }}>
                      {user.username}
                    </p>
                    <p
                      className="font-mono text-[10px] truncate"
                      style={{ color: "var(--dim)" }}
                    >
                      {user.email}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={logout}
                className={cn(
                  "w-full grid items-center gap-2.5 px-2.5 py-1.5 rounded text-left transition-colors",
                  sidebarOpen ? "grid-cols-[14px_1fr_auto]" : "grid-cols-1 justify-items-center"
                )}
                style={{ color: "var(--dim)" }}
              >
                <LogOut size={14} />
                {sidebarOpen && (
                  <>
                    <span className="text-[12.5px] font-mono">Sign out</span>
                    <span className="kbd">⌘Q</span>
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
