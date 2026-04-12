"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertTriangle, TrendingUp, Target, Info } from "lucide-react";
import { useNotificationStore } from "@/stores/notification-store";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const typeConfig: Record<string, { icon: typeof Bell; color: string; borderColor: string }> = {
  budget_alert: { icon: AlertTriangle, color: "text-red-500", borderColor: "border-l-red-500" },
  anomaly: { icon: AlertTriangle, color: "text-amber-500", borderColor: "border-l-amber-500" },
  milestone: { icon: Target, color: "text-emerald-500", borderColor: "border-l-emerald-500" },
  info: { icon: Info, color: "text-indigo-500", borderColor: "border-l-indigo-500" },
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
        className="relative p-2 rounded-lg hover:bg-accent transition-colors"
      >
        <Bell size={20} className="text-muted-foreground" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 w-80 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              <div className="flex gap-2">
                {count > 0 && (
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
                <div className="py-8 text-center text-sm text-muted-foreground">
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
                        "flex items-start gap-3 px-4 py-3 border-b border-border border-l-2 cursor-pointer transition-colors hover:bg-accent",
                        !n.read ? cn(config.borderColor, "bg-primary/5") : "border-l-transparent"
                      )}
                    >
                      <Icon size={16} className={cn("mt-0.5 shrink-0", config.color)} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
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
