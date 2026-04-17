"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertTriangle, Target, Info, CalendarClock } from "lucide-react";
import { useNotificationStore } from "@/stores/notification-store";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { NotificationType } from "@/types";

const typeConfig: Record<NotificationType, { icon: typeof Bell; color: string; borderColor: string }> = {
  budget_alert: { icon: AlertTriangle, color: "text-red-500", borderColor: "border-l-red-500" },
  anomaly: { icon: AlertTriangle, color: "text-amber-500", borderColor: "border-l-amber-500" },
  milestone: { icon: Target, color: "text-emerald-500", borderColor: "border-l-emerald-500" },
  bill_reminder: { icon: CalendarClock, color: "text-indigo-500", borderColor: "border-l-indigo-500" },
  info: { icon: Info, color: "text-indigo-500", borderColor: "border-l-indigo-500" },
};

const POLL_MS = 60_000;

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, syncFromServer, markRead, markAllRead, clearAll } = useNotificationStore();
  const authed = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!authed) return;
    syncFromServer();
    const id = setInterval(syncFromServer, POLL_MS);
    return () => clearInterval(id);
  }, [authed, syncFromServer]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
      >
        <Bell size={20} className="text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 w-80 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-destructive">
                    Clear
                  </button>
                )}
              </div>
            </div>
            <ScrollArea className="max-h-[360px]">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.slice(0, 20).map((n) => {
                  const config = typeConfig[n.type] || typeConfig.info;
                  const Icon = config.icon;
                  const unread = !n.read_at;
                  return (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 border-b border-border border-l-2 cursor-pointer transition-colors hover:bg-accent",
                        unread ? cn(config.borderColor, "bg-primary/5") : "border-l-transparent"
                      )}
                    >
                      <Icon size={16} className={cn("mt-0.5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", unread && "font-medium")}>{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      {unread && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
