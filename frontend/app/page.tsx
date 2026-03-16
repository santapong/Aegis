"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MilestoneData {
  id: number;
  goal_id: number;
  name: string;
  target_amount: number | null;
  start_date: string;
  end_date: string;
  status: string;
  progress: number;
}

interface GoalData {
  id: number;
  name: string;
  description: string | null;
  target_amount: number | null;
  current_amount: number;
  start_date: string;
  end_date: string;
  color: string;
  status: string;
  milestones: MilestoneData[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-blue-500/15", text: "text-blue-400", label: "Active" },
  completed: { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Completed" },
  paused: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Paused" },
  pending: { bg: "bg-zinc-500/15", text: "text-zinc-400", label: "Pending" },
  in_progress: { bg: "bg-violet-500/15", text: "text-violet-400", label: "In Progress" },
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().getTime();
  return Math.ceil(diff / 86400000);
}

export default function Dashboard() {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/goals/`)
      .then((res) => res.json())
      .then((data) => setGoals(data))
      .catch((err) => console.error("Failed to fetch goals:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading dashboard...
        </div>
      </div>
    );
  }

  const totalTarget = goals.reduce((s, g) => s + (g.target_amount || 0), 0);
  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const activeGoals = goals.filter((g) => g.status === "active");
  const completedGoals = goals.filter((g) => g.status === "completed");

  const allMilestones = goals.flatMap((g) =>
    g.milestones.map((m) => ({ ...m, goalName: g.name, goalColor: g.color }))
  );
  const upcomingMilestones = allMilestones
    .filter((m) => m.status !== "completed" && daysUntil(m.end_date) >= 0)
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
    .slice(0, 5);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">{today}</p>
        </div>
        <Link
          href="/gantt"
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
          </svg>
          View Gantt Chart
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Goals</p>
          <p className="text-3xl font-bold mt-2 text-white">{goals.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Active</p>
          <p className="text-3xl font-bold mt-2 text-blue-400">{activeGoals.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Completed</p>
          <p className="text-3xl font-bold mt-2 text-emerald-400">{completedGoals.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Target</p>
          <p className="text-2xl font-bold mt-2 text-white">{formatCurrency(totalTarget)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Total Saved</p>
          <p className="text-2xl font-bold mt-2 text-amber-400">{formatCurrency(totalSaved)}</p>
        </div>
      </div>

      {/* Overall Progress */}
      {totalTarget > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-zinc-300">Overall Savings Progress</p>
            <p className="text-sm font-bold text-white">{overallProgress.toFixed(1)}%</p>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-500">
            <span>{formatCurrency(totalSaved)} saved</span>
            <span>{formatCurrency(totalTarget)} target</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Goals List */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4">Goals</h2>
          {goals.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500">No goals yet.</p>
              <Link
                href="/gantt"
                className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
              >
                Create your first goal in the Gantt Chart
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => {
                const progress =
                  goal.target_amount && goal.target_amount > 0
                    ? Math.min((goal.current_amount / goal.target_amount) * 100, 100)
                    : 0;
                const days = daysUntil(goal.end_date);
                const badge = STATUS_BADGE[goal.status] || STATUS_BADGE.active;

                return (
                  <div
                    key={goal.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: goal.color }}
                        />
                        <div>
                          <h3 className="text-sm font-semibold text-white">{goal.name}</h3>
                          {goal.description && (
                            <p className="text-xs text-zinc-500 mt-0.5">{goal.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        {days >= 0 && goal.status !== "completed" && (
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            days <= 7
                              ? "bg-red-500/15 text-red-400"
                              : days <= 30
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-zinc-500/15 text-zinc-400"
                          }`}>
                            {days === 0 ? "Due today" : `${days}d left`}
                          </span>
                        )}
                        {days < 0 && goal.status !== "completed" && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                            {Math.abs(days)}d overdue
                          </span>
                        )}
                      </div>
                    </div>

                    {goal.target_amount && goal.target_amount > 0 && (
                      <>
                        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: goal.color,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>{formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}</span>
                          <span className="font-medium" style={{ color: goal.color }}>
                            {progress.toFixed(0)}%
                          </span>
                        </div>
                      </>
                    )}

                    {goal.milestones.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-zinc-800">
                        <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-2">
                          Milestones ({goal.milestones.filter((m) => m.status === "completed").length}/{goal.milestones.length})
                        </p>
                        <div className="flex gap-1.5">
                          {goal.milestones.map((m) => (
                            <div
                              key={m.id}
                              title={`${m.name} (${m.status})`}
                              className="h-1.5 flex-1 rounded-full"
                              style={{
                                backgroundColor: m.status === "completed" ? goal.color : `${goal.color}33`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Milestones */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Upcoming Milestones</h2>
          {upcomingMilestones.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
              <p className="text-zinc-500 text-sm">No upcoming milestones</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingMilestones.map((m) => {
                const days = daysUntil(m.end_date);
                return (
                  <div
                    key={m.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                        style={{ backgroundColor: m.goalColor }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{m.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{m.goalName}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            days <= 7
                              ? "bg-red-500/15 text-red-400"
                              : days <= 30
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-zinc-500/15 text-zinc-400"
                          }`}>
                            {days === 0 ? "Due today" : `${days}d left`}
                          </span>
                          {m.target_amount && (
                            <span className="text-[11px] text-zinc-500">
                              {formatCurrency(m.target_amount)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Stats */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Stats</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Total milestones</span>
                <span className="text-sm font-semibold text-white">{allMilestones.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Completed milestones</span>
                <span className="text-sm font-semibold text-emerald-400">
                  {allMilestones.filter((m) => m.status === "completed").length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Avg. progress</span>
                <span className="text-sm font-semibold text-blue-400">
                  {goals.length > 0
                    ? (
                        goals.reduce((s, g) => {
                          if (!g.target_amount || g.target_amount === 0) return s;
                          return s + Math.min((g.current_amount / g.target_amount) * 100, 100);
                        }, 0) / goals.filter((g) => g.target_amount && g.target_amount > 0).length || 0
                      ).toFixed(1)
                    : "0"}%
                </span>
              </div>
              {totalTarget > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Remaining</span>
                  <span className="text-sm font-semibold text-amber-400">
                    {formatCurrency(Math.max(totalTarget - totalSaved, 0))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
