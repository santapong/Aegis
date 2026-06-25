"use client";

import { useEffect, useId, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { marketAPI } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { SymbolResult, SymbolType } from "@/types";

interface SymbolSearchProps {
  onSelect: (result: SymbolResult) => void;
  label?: string;
  placeholder?: string;
}

const TYPE_LABEL: Record<SymbolType, string> = {
  stock: "Stock",
  etf: "ETF",
  crypto: "Crypto",
};

const TYPE_VARIANT: Record<SymbolType, "default" | "info" | "warning"> = {
  stock: "default",
  etf: "info",
  crypto: "warning",
};

/**
 * Debounced symbol typeahead reusing the command-palette combobox pattern
 * (no new shadcn `command` dependency). Controlled input → 300 ms internal
 * debounce → gated `useQuery`. Selecting a row fires `onSelect`; the parent
 * owns the chosen symbol. Falls back gracefully when the backend reports
 * `degraded` (crypto-only, no market-data key) or is unavailable entirely.
 */
export function SymbolSearch({
  onSelect,
  label = "Search symbol",
  placeholder = "Search Apple, Bitcoin, PTT…",
}: SymbolSearchProps) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const inputId = useId();

  // 300 ms internal debounce → keeps the query key (and network) calm while typing.
  useEffect(() => {
    const t = setTimeout(() => setDq(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const enabled = dq.trim().length >= 2;

  const { data, isFetching, isError } = useQuery({
    queryKey: ["mkt-search", dq],
    queryFn: () => marketAPI.search(dq),
    enabled,
    staleTime: 600_000,
    placeholderData: keepPreviousData,
  });

  const results = data?.results ?? [];
  const degraded = data?.degraded ?? false;

  // Keep the highlighted row in range as results change.
  useEffect(() => {
    setActive(0);
  }, [dq, results.length]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const choose = (r: SymbolResult) => {
    onSelect(r);
    setOpen(false);
    setQ("");
    setDq("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      if (results.length) setActive((i) => (i + 1) % results.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (results.length) setActive((i) => (i - 1 + results.length) % results.length);
      return;
    }
    if (e.key === "Enter") {
      const r = results[active];
      if (r) {
        e.preventDefault();
        choose(r);
      }
    }
  };

  const showDropdown = open && enabled;
  const activeId = results[active] ? `${listboxId}-opt-${active}` : undefined;

  return (
    <div className="space-y-1.5" ref={rootRef}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-muted/50 px-3.5 transition-colors focus-within:border-transparent focus-within:ring-2 focus-within:ring-ring hover:border-muted-foreground/30">
          <Search size={15} className="shrink-0 text-muted-foreground" />
          <input
            id={inputId}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isFetching && (
            <Loader2 size={14} className="shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>

        {showDropdown && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            {degraded && (
              <div className="flex items-center gap-2 border-b border-border bg-amber-500/10 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
                <AlertTriangle size={13} className="shrink-0" />
                Crypto only — no market-data key configured
              </div>
            )}

            <ul role="listbox" id={listboxId} aria-label="Symbol results" className="max-h-72 overflow-y-auto py-1">
              {isError ? (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  Search unavailable — enter ticker manually
                </li>
              ) : results.length > 0 ? (
                results.map((r, i) => (
                  <li
                    key={`${r.symbol}-${i}`}
                    id={`${listboxId}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      // Prevent input blur from closing the list before the click lands.
                      e.preventDefault();
                      choose(r);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm",
                      i === active ? "bg-accent" : "hover:bg-accent/60"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {r.symbol}
                        <span className="text-muted-foreground/60"> · {r.exchange}</span>
                      </p>
                    </div>
                    <Badge variant={TYPE_VARIANT[r.type]} className="shrink-0">
                      {TYPE_LABEL[r.type]}
                    </Badge>
                  </li>
                ))
              ) : isFetching ? (
                <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  Searching…
                </li>
              ) : (
                <li className="px-3 py-3 text-sm text-muted-foreground">No matches</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
