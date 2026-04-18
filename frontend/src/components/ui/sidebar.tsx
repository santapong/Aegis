"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Calendar,
  GanttChart,
  BarChart3,
  Wallet,
  Bot,
  Moon,
  Sun,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Menu,
  Shield,
  FileText,
  PiggyBank,
  CreditCard,
  LogOut,
} from "lucide-react";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, tourId: "sidebar-dashboard" },
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, tourId: "sidebar-transactions" },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/plans", label: "Plans & Goals", icon: Target },
      { href: "/budgets", label: "Budgets", icon: Wallet, tourId: "sidebar-budgets" },
      { href: "/savings", label: "Savings Goals", icon: PiggyBank },
      { href: "/debts", label: "Debt Tracker", icon: CreditCard },
      { href: "/payments", label: "Payments", icon: Wallet },
    ],
  },
  {
    label: "Visualize",
    items: [
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/gantt", label: "Gantt Chart", icon: GanttChart },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/docs", label: "Documents", icon: FileText },
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

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-xl border-b border-border">
        <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <Shield size={14} className="text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">Aegis</span>
        </div>
        <button onClick={toggleAIPanel} data-tour-id="ai-advisor" className="p-2 rounded-lg hover:bg-accent transition-colors">
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
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
                <Shield size={16} className="text-primary-foreground" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Aegis</h1>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label} className="px-2 mb-1">
              {sidebarOpen && (
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const { href, label, icon: Icon } = item;
                  const tourId = (item as { tourId?: string }).tourId;
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      data-tour-id={tourId}
                      title={!sidebarOpen ? label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                        isActive
                          ? "bg-primary/10 text-primary border-l-2 border-primary ml-0.5"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon size={18} className={isActive ? "text-primary" : ""} />
                      {sidebarOpen && label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-2 space-y-0.5 border-t border-border bg-muted/30">
          <button
            onClick={toggleAIPanel}
            data-tour-id="ai-advisor"
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            <Bot size={18} />
            {sidebarOpen && "AI Advisor"}
          </button>
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all",
              pathname === "/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Settings size={18} />
            {sidebarOpen && "Settings"}
          </Link>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            {sidebarOpen && (theme === "light" ? "Dark Mode" : "Light Mode")}
          </button>
          {user && (
            <>
              <div className="border-t border-border my-1" />
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{user.username}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                )}
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <LogOut size={18} />
                {sidebarOpen && "Sign out"}
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
