"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import { aiAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { slideInRight } from "@/lib/animations";
import { Bot, X, Send, Sparkles, TrendingUp } from "lucide-react";
import type { AIRecommendation } from "@/types";
import { cn } from "@/lib/utils";

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

  const actionTypeConfig: Record<string, { color: string; label: string }> = {
    reduce: { color: "text-red-500 bg-red-500/10", label: "Reduce" },
    increase: { color: "text-green-500 bg-green-500/10", label: "Increase" },
    reallocate: { color: "text-blue-500 bg-blue-500/10", label: "Reallocate" },
    alert: { color: "text-yellow-500 bg-yellow-500/10", label: "Alert" },
  };

  return (
    <AnimatePresence>
      {aiPanelOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            className="lg:hidden fixed inset-0 bg-black/50 z-[49]"
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
            className="fixed right-0 top-0 h-screen w-full sm:w-[400px] bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Bot size={20} className="text-[var(--primary)]" />
                <h2 className="font-semibold">AI Financial Advisor</h2>
              </div>
              <button onClick={toggleAIPanel} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]">
                <X size={18} />
              </button>
            </div>

            {/* Quick actions */}
            <div className="p-4 border-b border-[var(--border)] flex gap-2">
              <button
                onClick={() => { setQuestion(""); handleAnalyze(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-sm hover:opacity-90 transition-opacity"
              >
                <Sparkles size={14} /> Auto-Analyze
              </button>
              <button
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <TrendingUp size={14} /> Forecast
              </button>
            </div>

            {/* Recommendations */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]" />
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">Analyzing your finances...</p>
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
                      transition={{ delay: i * 0.1 }}
                      className="p-3 rounded-lg border border-[var(--border)] hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", config.color)}>
                          {config.label}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">
                          {Math.round(rec.confidence * 100)}% confidence
                        </span>
                      </div>
                      <p className="text-sm">{rec.recommendation}</p>
                      <div className="flex gap-2 mt-2">
                        {!rec.accepted ? (
                          <>
                            <button
                              onClick={() => handleAccept(rec.id)}
                              className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
                            >
                              Accept
                            </button>
                            <button className="text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--border)] transition-colors">
                              Dismiss
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-green-500 font-medium">Accepted</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {!loading && recommendations.length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)]">
                  <Bot size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Ask a question or click Auto-Analyze to get AI-powered financial insights.</p>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[var(--border)]">
              <div className="flex gap-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="Ask about your finances..."
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="p-2 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
