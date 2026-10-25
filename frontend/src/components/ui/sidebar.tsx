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
  Calendar as CalendarIcon,
  GanttChartSquare,
  Plane,
  Sparkles,
  BookOpen,
  Compass,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AegisBrand, AegisMark } from "@/components/brand";

function BrandMark({ size = 28 }: { size?: number }) { return <AegisMark size={size} />; }

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
      { href: "/cashflow", label: "Cash planning", code: "CSH", icon: Wallet, k: "" },
      { href: "/accounts", label: "Tracked accounts", code: "ACC", icon: Wallet, k: "" },
      { href: "/review", label: "Review & activity", code: "REV", icon: ArrowLeftRight, k: "" },
      { href: "/", label: "Dashboard", code: "DSH", icon: LayoutDashboard, k: "⌘⇧1", tourId: "sidebar-dashboard" },
      { href: "/transactions", label: "Unassigned records", code: "TXN", icon: ArrowLeftRight, k: "⌘⇧2", tourId: "sidebar-transactions" },
      { href: "/reports", label: "Reports", code: "RPT", icon: BarChart3, k: "⌘⇧3" },
    ],
  },
  {
    index: "02",
    label: "Money",
    items: [
      { href: "/budgets", label: "Budgets", code: "BDG", icon: Wallet, k: "⌘⇧4", tourId: "sidebar-budgets" },
      { href: "/savings", label: "Savings", code: "SAV", icon: PiggyBank, k: "⌘⇧5" },
      { href: "/investments", label: "Investments", code: "INV", icon: TrendingUp, k: "⌘⇧6" },
      { href: "/debts", label: "Debts", code: "DBT", icon: Banknote, k: "⌘⇧7" },
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
      { href: "/settings", label: "Settings", code: "SET", icon: Settings, k: "⌘⇧," },
      { href: "/welcome", label: "Onboarding", code: "WEL", icon: Compass, k: "⇧W" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  // Discrete selectors — subscribing to the whole store re-renders the
  // sidebar (with motion + sparklines) on every unrelated state change.
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const collapsedClusters = useAppStore((s) => s.collapsedClusters);
  const toggleCluster = useAppStore((s) => s.toggleCluster);
  const toggleAIPanel = useAppStore((s) => s.toggleAIPanel);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      useAppStore.setState({ sidebarOpen: false });
    }
  }, [pathname]);

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
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <AegisBrand />
        </div>
        <div className="flex items-center gap-1"><ThemeToggle />
        <button
          onClick={toggleAIPanel}
          data-tour-id="ai-advisor"
          className="p-2 rounded transition-colors"
          style={{ color: "var(--fg-2)" }}
          aria-label="Open AI advisor"
        >
          <Bot size={20} />
        </button>
        </div>
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
          "aegis-sidebar h-screen flex flex-col transition-all duration-300 z-50",
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
          style={{ borderBottom: "1px solid var(--pane-edge)" }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5">
              <div className="leading-tight">
                <div
                  className="text-[14px] font-medium tracking-[0.02em]"
                  style={{
                    fontFamily: "var(--display-font)",
                    fontStyle: "var(--display-style)",
                    color: "var(--fg)",
                  }}
                >
                  <AegisBrand />
                </div>
                <div
                  className="font-mono text-[10px] tracking-[1.4px] uppercase"
                  style={{ color: "var(--dim)" }}
                >
                  Room to look ahead
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
          {clusters.map((cluster) => {
            // A collapsed cluster stays open while it holds the active route,
            // so the current location is never hidden from the user.
            const hasActive = cluster.items.some((i) => i.href === pathname);
            const collapsed =
              sidebarOpen && !hasActive && collapsedClusters.includes(cluster.label);
            return (
            <div key={cluster.label} className="flex flex-col gap-1">
              {sidebarOpen && (
                <button
                  onClick={() => toggleCluster(cluster.label)}
                  aria-expanded={!collapsed}
                  className="flex items-center justify-between px-2 pb-1.5 font-mono uppercase transition-colors"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "1.8px",
                    color: "var(--dim-2)",
                  }}
                >
                  <span>{cluster.index} · {cluster.label}</span>
                  <ChevronDown
                    size={12}
                    style={{
                      transition: "transform 0.2s",
                      transform: collapsed ? "rotate(-90deg)" : "none",
                    }}
                  />
                </button>
              )}
              {!collapsed && (
              <div className="flex flex-col gap-0.5">
                {cluster.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      data-tour-id={item.tourId}
                      title={!sidebarOpen ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center transition-colors font-mono",
                        sidebarOpen ? "gap-2.5 px-2.5 py-1.5" : "justify-center px-2 py-2"
                      )}
                      style={{
                        fontSize: "12px",
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
              )}
            </div>
            );
          })}

        </nav>

        <div
          className="p-2 space-y-0.5"
          style={{ borderTop: "1px dashed var(--pane-edge)" }}
        >
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            {sidebarOpen && <span className="text-xs" style={{color:"var(--dim)"}}>Appearance</span>}
            <ThemeToggle />
          </div>
          <button
            onClick={toggleAIPanel}
            data-tour-id="ai-advisor"
            aria-label={!sidebarOpen ? "AI advisor" : undefined}
            className={cn(
              "w-full grid items-center gap-2.5 px-2.5 py-1.5 rounded text-left transition-colors",
              sidebarOpen ? "grid-cols-[14px_1fr_auto]" : "grid-cols-1 justify-items-center"
            )}
            style={{ color: "var(--accent)" }}
          >
            <Bot size={14} />
            {sidebarOpen && (
              <span className="text-xs font-mono">AI Advisor</span>
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
                aria-label={!sidebarOpen ? "Sign out" : undefined}
                className={cn(
                  "w-full grid items-center gap-2.5 px-2.5 py-1.5 rounded text-left transition-colors",
                  sidebarOpen ? "grid-cols-[14px_1fr_auto]" : "grid-cols-1 justify-items-center"
                )}
                style={{ color: "var(--dim)" }}
              >
                <LogOut size={14} />
                {sidebarOpen && (
                  <span className="text-xs font-mono">Sign out</span>
                )}
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
