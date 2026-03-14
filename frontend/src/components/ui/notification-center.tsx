"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, Trash2, AlertTriangle, TrendingUp, Target, Info } from "lucide-react";
import { useNotificationStore } from "@/stores/notification-store";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  budget_alert: { icon: AlertTriangle, color: "text-red-500" },
  anomaly: { icon: AlertTriangle, color: "text-yellow-500" },
  milestone: { icon: Target, color: "text-green-500" },
  info: { icon: Info, color: "text-blue-500" },
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, markRead, markAllRead, clearAll, unreadCount } = useNotificationStore();
  const count = unreadCount();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <Bell size={20} className="text-[var(--text-muted)]" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold">Notifications</h3>
              <div className="flex gap-2">
                {count > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-[var(--text-muted)] hover:text-red-500"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--text-muted)]">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const config = typeConfig[n.type] || typeConfig.info;
                  const Icon = config.icon;
                  return (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] cursor-pointer transition-colors hover:bg-[var(--bg-secondary)]",
                        !n.read && "bg-[var(--primary)]/5"
                      )}
                    >
                      <Icon size={16} className={cn("mt-0.5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-[var(--primary)] mt-1.5 shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
