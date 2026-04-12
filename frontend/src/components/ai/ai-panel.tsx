"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import { aiAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { slideInRight } from "@/lib/animations";
import { Bot, X, Send, Sparkles, TrendingUp, Check, XCircle } from "lucide-react";
import type { AIRecommendation } from "@/types";
import { cn } from "@/lib/utils";
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
      const results = await aiAPI.analyze(question || undefined) as AIRecommendation[];
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
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, accepted: true } : r))
      );
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
            className="fixed right-0 top-0 h-screen w-full sm:w-[420px] bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Bot size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">AI Financial Advisor</h2>
                  <p className="text-[11px] text-muted-foreground">Powered by Claude</p>
                </div>
              </div>
              <button onClick={toggleAIPanel} className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            {/* Quick actions */}
            <div className="p-4 border-b border-border flex gap-2">
              <Button
                size="sm"
                onClick={() => { setQuestion(""); handleAnalyze(); }}
                className="gap-1.5"
              >
                <Sparkles size={14} /> Auto-Analyze
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
                className="gap-1.5"
              >
                <TrendingUp size={14} /> Forecast
              </Button>
            </div>

            {/* Recommendations */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {loading && (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="relative h-10 w-10">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <p className="text-sm text-muted-foreground">Analyzing your finances...</p>
                  </div>
                )}
                <AnimatePresence>
                  {!loading && recommendations.map((rec, i) => {
                    const config = actionTypeConfig[rec.action_type] ?? actionTypeConfig.alert;
                    return (
                      <motion.div
                        key={rec.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="p-4 rounded-xl border border-border bg-card hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <Badge variant={config.variant}>{config.label}</Badge>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {Math.round(rec.confidence * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{rec.recommendation}</p>
                        <div className="flex gap-2 mt-3">
                          {!rec.accepted ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAccept(rec.id)}
                                className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 gap-1"
                              >
                                <Check size={14} /> Accept
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground gap-1"
                              >
                                <XCircle size={14} /> Dismiss
                              </Button>
                            </>
                          ) : (
                            <Badge variant="success">Accepted</Badge>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {!loading && recommendations.length === 0 && (
                  <div className="text-center py-12">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                      <Bot size={24} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">
                      Ask a question or click Auto-Analyze to get AI-powered financial insights.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="Ask about your finances..."
                  className="flex-1 px-3.5 py-2 rounded-lg bg-card border border-border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                />
                <Button
                  size="icon"
                  onClick={handleAnalyze}
                  disabled={loading}
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
