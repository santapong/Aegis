"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import { aiAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { slideInRight } from "@/lib/animations";
import { X, TrendingUp, Check, XCircle, CornerDownLeft } from "lucide-react";
import type { AIRecommendation } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AIPanel() {
  const { aiPanelOpen, toggleAIPanel } = useAppStore();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const results = (await aiAPI.analyze(question || undefined)) as AIRecommendation[];
      setRecommendations(results);
      setQuestion("");
    } catch {
      toast.error("Failed to analyze", "Please try again later");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await aiAPI.accept(id);
      toast.success("Recommendation accepted");
      setRecommendations((prev) => prev.map((r) => (r.id === id ? { ...r, accepted: true } : r)));
    } catch {
      toast.error("Failed to accept recommendation");
    }
  };

  const actionTypeConfig: Record<string, { variant: "danger" | "success" | "info" | "warning"; label: string }> = {
    reduce: { variant: "danger", label: "Reduce" },
    increase: { variant: "success", label: "Increase" },
    reallocate: { variant: "info", label: "Reallocate" },
    alert: { variant: "warning", label: "Alert" },
  };

  return (
    <AnimatePresence>
      {aiPanelOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[49]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleAIPanel}
          />
          <motion.div
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-0 top-0 h-screen w-full sm:w-[440px] backdrop-blur-xl border-l border-border shadow-2xl z-50 flex flex-col"
            style={{ background: "color-mix(in oklab, var(--card) 96%, transparent)" }}
          >
            {/* Header — magenta CLAUDE / live badge + transmission marker */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="aegis-ai-badge">
                  <span className="aegis-dot" style={{ color: "var(--primary)" }}>
                    <span className="aegis-dot-pulse" />
                    <span className="aegis-dot-core" />
                  </span>
                  CLAUDE · live
                </span>
              </div>
              <button
                onClick={toggleAIPanel}
                className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground"
                aria-label="Close advisor"
              >
                <X size={16} />
              </button>
            </div>

            {/* Italic serif lede — "playful but grown-up" twist on a Bloomberg terminal. */}
            <div className="px-5 py-5 border-b border-border">
              <h2 className="aegis-display text-[24px] leading-[1.15] text-foreground">
                <span style={{ color: "var(--aegis-dim)" }}>›</span> three things
                <span style={{ color: "var(--primary)" }}> worth your attention </span>
                this week.
              </h2>
              <p className="mt-2 font-mono text-[10px] tracking-wider" style={{ color: "var(--aegis-dim)" }}>
                ADVISOR · POWERED BY CLAUDE
              </p>
            </div>

            {/* Quick actions — auto-analyze + forecast */}
            <div className="px-4 py-3 border-b border-border flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setQuestion("");
                  handleAnalyze();
                }}
                className="font-mono text-[11px] tracking-wide gap-1.5"
              >
                AUTO-ANALYZE
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await aiAPI.forecast();
                    toast.success("Forecast generated");
                  } catch {
                    toast.error("Failed to generate forecast");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="font-mono text-[11px] tracking-wide gap-1.5"
              >
                <TrendingUp size={12} /> FORECAST
              </Button>
            </div>

            {/* Recommendations */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {loading && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="flex gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--primary)", animation: "aegisBounce 1.2s infinite ease-in-out" }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: "var(--primary)",
                          animation: "aegisBounce 1.2s infinite ease-in-out",
                          animationDelay: "0.2s",
                        }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: "var(--primary)",
                          animation: "aegisBounce 1.2s infinite ease-in-out",
                          animationDelay: "0.4s",
                        }}
                      />
                    </div>
                    <p className="font-mono text-[11px] tracking-wider" style={{ color: "var(--aegis-dim)" }}>
                      ANALYZING TRANSMISSION…
                    </p>
                  </div>
                )}
                <AnimatePresence>
                  {!loading &&
                    recommendations.map((rec, i) => {
                      const config = actionTypeConfig[rec.action_type] ?? actionTypeConfig.alert;
                      const tint =
                        config.variant === "success"
                          ? "var(--aegis-ok)"
                          : config.variant === "warning"
                            ? "var(--aegis-warn)"
                            : config.variant === "danger"
                              ? "var(--aegis-bad)"
                              : "var(--primary)";
                      return (
                        <motion.div
                          key={rec.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="aegis-insight"
                          style={{ "--insight-tint": tint } as React.CSSProperties}
                        >
                          <div className="aegis-insight-kicker">
                            {String(i + 1).padStart(2, "0")} · {config.label.toUpperCase()}
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{rec.recommendation}</p>
                          <div className="flex items-center justify-between gap-2 mt-3 font-mono text-[11px]">
                            <span className="tabular-nums" style={{ color: tint }}>
                              {Math.round(rec.confidence * 100)}% confidence
                            </span>
                            {!rec.accepted ? (
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAccept(rec.id)}
                                  className="h-7 px-2 gap-1 text-xs"
                                  style={{ color: "var(--aegis-ok)" }}
                                >
                                  <Check size={12} /> Accept
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 gap-1 text-xs text-muted-foreground"
                                >
                                  <XCircle size={12} /> Dismiss
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="success">Accepted</Badge>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
                {!loading && recommendations.length === 0 && (
                  <div className="text-center py-10 px-4">
                    <p className="font-mono text-[10px] tracking-[1.4px] mb-3" style={{ color: "var(--aegis-dim)" }}>
                      TRANSMISSION · IDLE
                    </p>
                    <p className="text-sm text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
                      Ask Claude a question or run AUTO-ANALYZE to surface insights from your last 90 days.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input — magenta prompt arrow + blinking caret while empty */}
            <div
              className="px-4 py-3 border-t border-border flex items-center gap-2"
              style={{ background: "var(--aegis-panel)" }}
            >
              <span className="font-mono text-primary">›</span>
              <div className="flex-1 flex items-center min-w-0">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="ask claude — try “how do I save more?”"
                  className="flex-1 bg-transparent outline-none border-0 font-mono text-[12px] text-foreground placeholder:text-muted-foreground"
                />
                {!question && <span className="aegis-caret" aria-hidden />}
              </div>
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={loading}
                className="font-mono text-[11px] gap-1"
              >
                send <CornerDownLeft size={12} />
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
