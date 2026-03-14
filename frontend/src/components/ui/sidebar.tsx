"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
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
  X,
  Shield,
  FileText,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/plans", label: "Plans & Goals", icon: Target },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/gantt", label: "Gantt Chart", icon: GanttChart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/docs", label: "Documents", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, theme, toggleSidebar, toggleTheme, toggleAIPanel } = useAppStore();

  // Close sidebar on navigation for mobile
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      useAppStore.setState({ sidebarOpen: false });
    }
  }, [pathname]);

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-[var(--bg-card)] border-b border-[var(--border)]">
        <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-[var(--primary)]" />
          <span className="font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
            Aegis
          </span>
        </div>
        <button onClick={toggleAIPanel} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
          <Bot size={20} />
        </button>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "h-screen flex flex-col border-r border-[var(--border)] bg-[var(--bg-card)] transition-all duration-300 z-50",
          // Mobile: fixed overlay drawer
          "fixed lg:relative",
          sidebarOpen ? "w-[260px] translate-x-0" : "w-[68px] -translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-[var(--primary)]" />
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                Aegis
              </h1>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                  isActive
                    ? "bg-[var(--primary)] text-white shadow-md"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text)]"
                )}
              >
                <Icon size={20} />
                {sidebarOpen && label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-2 space-y-1 border-t border-[var(--border)]">
          <button
            onClick={toggleAIPanel}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text)] transition-all"
          >
            <Bot size={20} />
            {sidebarOpen && "AI Advisor"}
          </button>
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              pathname === "/settings"
                ? "bg-[var(--primary)] text-white shadow-md"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text)]"
            )}
          >
            <Settings size={20} />
            {sidebarOpen && "Settings"}
          </Link>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text)] transition-all"
          >
            {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            {sidebarOpen && (theme === "light" ? "Dark Mode" : "Light Mode")}
          </button>
        </div>
      </aside>
    </>
  );
}
