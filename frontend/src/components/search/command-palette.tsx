"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, Wallet, LayoutDashboard, Calendar, BarChart3, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { transactionsAPI } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Search;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: Wallet },
  { label: "Budgets", href: "/budgets", icon: Wallet },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Savings goals", href: "/savings", icon: Target },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const { data: txns, isFetching } = useQuery({
    queryKey: ["txn-search", q],
    queryFn: () => transactionsAPI.search(q, 8),
    enabled: open && q.trim().length >= 2,
    staleTime: 30_000,
  });

  const matchedNav = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return NAV_ITEMS;
    return NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(needle));
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

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
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="fixed left-1/2 top-[15vh] -translate-x-1/2 w-[90vw] max-w-xl bg-card border border-border rounded-xl shadow-2xl z-[70] overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search size={16} className="text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Search transactions, jump to a page…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              <kbd className="hidden sm:inline-flex px-2 py-0.5 rounded border border-border bg-muted text-[10px] font-mono text-muted-foreground">
                Esc
              </kbd>
            </div>
            <ScrollArea className="max-h-[55vh]">
              <div className="px-2 py-2">
                {matchedNav.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      Pages
                    </p>
                    {matchedNav.map((n) => {
                      const Icon = n.icon;
                      return (
                        <button
                          key={n.href}
                          onClick={() => go(n.href)}
                          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent text-left"
                        >
                          <Icon size={15} className="text-muted-foreground" />
                          <span className="flex-1">{n.label}</span>
                          <ArrowRight size={13} className="text-muted-foreground/60" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.trim().length >= 2 && (
                  <div>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      Transactions {isFetching && "…"}
                    </p>
                    {txns && txns.length > 0 ? (
                      txns.map((t: Transaction) => (
                        <button
                          key={t.id}
                          onClick={() => go(`/transactions?q=${encodeURIComponent(q)}&id=${t.id}`)}
                          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-accent text-left"
                        >
                          <div
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
                              t.type === "income"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-rose-500/10 text-rose-500"
                            )}
                          >
                            {t.type === "income" ? "+" : "−"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{t.description || t.category}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {t.category} · {t.date}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-xs font-semibold tabular-nums",
                              t.type === "income" ? "text-emerald-500" : "text-rose-500"
                            )}
                          >
                            ${t.amount.toFixed(2)}
                          </span>
                        </button>
                      ))
                    ) : !isFetching ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
                    ) : null}
                  </div>
                )}

                {!q && (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Type to search · press{" "}
                    <kbd className="mx-1 px-1.5 py-0.5 rounded border border-border bg-muted font-mono text-[10px]">?</kbd>
                    {" "}for shortcuts
                  </p>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
