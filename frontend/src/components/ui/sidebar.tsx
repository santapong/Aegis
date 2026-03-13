"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import {
  LayoutDashboard,
  Calendar,
  GanttChart,
  BarChart3,
  Bot,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/gantt", label: "Gantt Chart", icon: GanttChart },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, theme, toggleSidebar, toggleTheme, toggleAIPanel } = useAppStore();

  return (
    <aside
      className={cn(
        "h-screen flex flex-col border-r border-[var(--border)] bg-[var(--bg-card)] transition-all duration-300",
        sidebarOpen ? "w-[260px]" : "w-[68px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        {sidebarOpen && (
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
            MoneyAI
          </h1>
        )}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
        >
          {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-2">
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
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text)] transition-all"
        >
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
          {sidebarOpen && (theme === "light" ? "Dark Mode" : "Light Mode")}
        </button>
      </div>
    </aside>
  );
}
