"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Snapshot {
  id: number;
  snapshot_date: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
  savings_rate: number;
  total_debt: number;
  total_savings: number;
  net_worth: number;
  created_at: string;
}

interface TimelineItem {
  type: "snapshot" | "analysis";
  date: string;
  data: Record<string, unknown>;
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HistoryView() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [tab, setTab] = useState<"snapshots" | "timeline">("snapshots");
  const [takingSnapshot, setTakingSnapshot] = useState(false);

  useEffect(() => {
    fetchSnapshots();
    fetchTimeline();
  }, []);

  async function fetchSnapshots() {
    try {
      const res = await fetch(`${API}/api/history/snapshots`);
      setSnapshots(await res.json());
    } catch {}
  }

  async function fetchTimeline() {
    try {
      const res = await fetch(`${API}/api/history/timeline?limit=30`);
      setTimeline(await res.json());
    } catch {}
  }

  async function takeSnapshot() {
    setTakingSnapshot(true);
    try {
      await fetch(`${API}/api/history/snapshots`, { method: "POST" });
      fetchSnapshots();
      fetchTimeline();
    } catch {}
    setTakingSnapshot(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financial History</h1>
            <p className="text-sm text-zinc-500 mt-1">Track your progress over time</p>
          </div>
          <button
            onClick={takeSnapshot}
            disabled={takingSnapshot}
            className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium transition disabled:opacity-50"
          >
            {takingSnapshot ? "Saving..." : "Take Snapshot"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1 w-fit">
          {(["snapshots", "timeline"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition ${
                tab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "snapshots" ? "Snapshots" : "Timeline"}
            </button>
          ))}
        </div>

        {/* Snapshots Tab */}
        {tab === "snapshots" && (
          <div className="space-y-4">
            {snapshots.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <p className="text-lg mb-2">No snapshots yet</p>
                <p className="text-sm">Click &quot;Take Snapshot&quot; to capture your current financial state</p>
              </div>
            ) : (
              snapshots.map((s) => (
                <div key={s.id} className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-zinc-500">
                      {new Date(s.snapshot_date).toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                    <div className={`text-lg font-bold ${s.net_worth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      Net Worth: {fmt(s.net_worth)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat label="Income" value={fmt(s.total_income)} color="text-emerald-400" />
                    <Stat label="Expenses" value={fmt(s.total_expenses)} color="text-red-400" />
                    <Stat label="Savings Rate" value={`${s.savings_rate.toFixed(1)}%`} color="text-blue-400" />
                    <Stat label="Total Debt" value={fmt(s.total_debt)} color="text-orange-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <Stat label="Net Savings" value={fmt(s.net_savings)} color={s.net_savings >= 0 ? "text-emerald-400" : "text-red-400"} />
                    <Stat label="Total Savings" value={fmt(s.total_savings)} color="text-cyan-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Timeline Tab */}
        {tab === "timeline" && (
          <div className="space-y-3">
            {timeline.length === 0 ? (
              <div className="text-center py-16 text-zinc-600">
                <p className="text-lg mb-2">No history yet</p>
                <p className="text-sm">Take snapshots and run AI analyses to build your timeline</p>
              </div>
            ) : (
              timeline.map((item, i) => (
                <div
                  key={i}
                  className="flex gap-4 bg-zinc-900/80 rounded-xl border border-zinc-800 p-4"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      item.type === "snapshot"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}
                  >
                    {item.type === "snapshot" ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.type === "snapshot" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"
                      }`}>
                        {item.type === "snapshot" ? "Snapshot" : "AI Analysis"}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {item.date ? new Date(item.date).toLocaleString() : ""}
                      </span>
                    </div>
                    {item.type === "snapshot" ? (
                      <p className="text-sm text-zinc-400">
                        Net Worth: <span className="text-emerald-400 font-medium">{fmt((item.data as Record<string, unknown>).net_worth as number || 0)}</span>
                        {" | "}Savings Rate: <span className="text-blue-400 font-medium">{((item.data as Record<string, unknown>).savings_rate as number || 0).toFixed(1)}%</span>
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-400 truncate">
                        {(item.data as Record<string, unknown>).response as string || "Analysis completed"}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
