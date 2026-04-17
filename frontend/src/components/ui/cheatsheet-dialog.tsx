"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Keyboard } from "lucide-react";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["N"], label: "New transaction" },
  { keys: ["/"], label: "Focus search / command palette" },
  { keys: ["?"], label: "Show this cheatsheet" },
  { keys: ["g", "d"], label: "Go to dashboard" },
  { keys: ["g", "t"], label: "Go to transactions" },
  { keys: ["g", "b"], label: "Go to budgets" },
  { keys: ["g", "c"], label: "Go to calendar" },
  { keys: ["g", "r"], label: "Go to reports" },
  { keys: ["Esc"], label: "Close dialog / palette" },
];

export function CheatsheetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label="Keyboard shortcuts"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-card border border-border rounded-xl shadow-2xl z-[70] overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Keyboard size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
            </div>
            <ul className="divide-y divide-border">
              {SHORTCUTS.map((s, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-foreground">{s.label}</span>
                  <span className="flex gap-1">
                    {s.keys.map((k, j) => (
                      <kbd
                        key={j}
                        className="inline-flex items-center px-2 py-1 rounded border border-border bg-muted text-[11px] font-mono font-semibold text-muted-foreground"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
