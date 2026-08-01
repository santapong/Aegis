"use client";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useAppStore,
  DASHBOARD_WIDGET_IDS,
  type DashboardWidgetId,
} from "@/stores/app-store";
import { ChevronUp, ChevronDown, SlidersHorizontal, RotateCcw } from "lucide-react";

const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  kpi: "KPI rail",
  health: "Financial health",
  anomalies: "Anomalies",
  spending: "Spending by category",
  trend: "Monthly trend",
  insights: "Insights",
  cashflow: "Cash flow forecast",
};

/**
 * Customize — popover listing every dashboard widget with a visibility
 * switch and up/down reorder arrows. State persists via the app store.
 */
export function CustomizeMenu({ order }: { order: DashboardWidgetId[] }) {
  const hidden = useAppStore((s) => s.dashboardHidden);
  const moveWidget = useAppStore((s) => s.moveWidget);
  const toggleWidget = useAppStore((s) => s.toggleWidget);
  const resetWidgets = useAppStore((s) => s.resetWidgets);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="font-mono text-[11px] tracking-wide"
          icon={<SlidersHorizontal size={13} />}
        >
          CUSTOMIZE
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between mb-3">
          <span
            className="font-mono text-[10px] uppercase"
            style={{ letterSpacing: "1.6px", color: "var(--dim-2)" }}
          >
            Dashboard widgets
          </span>
          <button
            onClick={resetWidgets}
            className="flex items-center gap-1 font-mono text-[10px] uppercase transition-colors"
            style={{ color: "var(--dim)" }}
            aria-label="Reset widget layout"
          >
            <RotateCcw size={11} /> Reset
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {order.map((id, i) => (
            <div
              key={id}
              className="flex items-center gap-2 rounded px-1.5 py-1.5"
              style={{ opacity: hidden.includes(id) ? 0.55 : 1 }}
            >
              <span className="flex-1 text-xs" style={{ color: "var(--fg-2)" }}>
                {WIDGET_LABELS[id]}
              </span>
              <button
                onClick={() => moveWidget(id, -1)}
                disabled={i === 0}
                className="p-1 rounded disabled:opacity-25 transition-colors"
                style={{ color: "var(--dim)" }}
                aria-label={`Move ${WIDGET_LABELS[id]} up`}
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => moveWidget(id, 1)}
                disabled={i === DASHBOARD_WIDGET_IDS.length - 1}
                className="p-1 rounded disabled:opacity-25 transition-colors"
                style={{ color: "var(--dim)" }}
                aria-label={`Move ${WIDGET_LABELS[id]} down`}
              >
                <ChevronDown size={14} />
              </button>
              <Switch
                checked={!hidden.includes(id)}
                onCheckedChange={() => toggleWidget(id)}
                aria-label={`Toggle ${WIDGET_LABELS[id]}`}
              />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
