"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore } from "@/stores/toast-store";
import type { Toast as ToastType } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

const toastConfig = {
  success: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10 border-green-500/20" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
};

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm bg-[var(--bg-card)]",
        config.bg
      )}
    >
      <Icon size={18} className={cn("mt-0.5 shrink-0", config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.message}</p>
        {toast.description && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 p-0.5 rounded hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <X size={14} className="text-[var(--text-muted)]" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[380px] max-w-[calc(100vw-2rem)]">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
