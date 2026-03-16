"use client";

import { useEffect, useRef, useState } from "react";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_COLORS: Record<string, string> = {
  active: "#3b82f6",
  completed: "#10b981",
  paused: "#f59e0b",
  pending: "#6b7280",
  in_progress: "#8b5cf6",
};

function daysBetween(a: string, b: string) {
  const msPerDay = 86400000;
  return Math.max(
    1,
    Math.round(
      (new Date(b).getTime() - new Date(a).getTime()) / msPerDay
    )
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function GanttChart() {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "quarter">("month");

  const fetchGoals = async () => {
    try {
      const res = await fetch(`${API_URL}/api/goals/`);
      const data = await res.json();
      setGoals(data);
    } catch (err) {
      console.error("Failed to fetch goals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const allDates = goals.flatMap((g) => [
    new Date(g.start_date),
    new Date(g.end_date),
    ...g.milestones.flatMap((m) => [new Date(m.start_date), new Date(m.end_date)]),
  ]);

  const today = new Date();
  const timelineStart = allDates.length
    ? new Date(Math.min(...allDates.map((d) => d.getTime()), today.getTime()))
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const timelineEnd = allDates.length
    ? new Date(Math.max(...allDates.map((d) => d.getTime())))
    : new Date(today.getFullYear(), today.getMonth() + 6, 0);

  // Add padding
  const paddedStart = new Date(timelineStart);
  paddedStart.setDate(paddedStart.getDate() - 14);
  const paddedEnd = new Date(timelineEnd);
  paddedEnd.setDate(paddedEnd.getDate() + 14);

  const totalDays = daysBetween(
    paddedStart.toISOString(),
    paddedEnd.toISOString()
  );

  function getBarStyle(startDate: string, endDate: string) {
    const startOffset = daysBetween(
      paddedStart.toISOString(),
      startDate
    );
    const duration = daysBetween(startDate, endDate);
    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 1)}%` };
  }

  function getTodayPosition() {
    const offset = daysBetween(
      paddedStart.toISOString(),
      today.toISOString()
    );
    return `${(offset / totalDays) * 100}%`;
  }

  // Generate month labels
  const months: { label: string; left: string; width: string }[] = [];
  const cursor = new Date(paddedStart.getFullYear(), paddedStart.getMonth(), 1);
  while (cursor <= paddedEnd) {
    const monthStart = new Date(Math.max(cursor.getTime(), paddedStart.getTime()));
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const monthEnd = new Date(Math.min(nextMonth.getTime(), paddedEnd.getTime()));
    const left =
      (daysBetween(paddedStart.toISOString(), monthStart.toISOString()) /
        totalDays) *
      100;
    const width =
      (daysBetween(monthStart.toISOString(), monthEnd.toISOString()) /
        totalDays) *
      100;
    months.push({
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      left: `${left}%`,
      width: `${width}%`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const handleCreateGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      name: formData.get("name"),
      description: formData.get("description") || null,
      target_amount: formData.get("target_amount")
        ? Number(formData.get("target_amount"))
        : null,
      current_amount: Number(formData.get("current_amount") || 0),
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
      color: formData.get("color") || "#3b82f6",
    };
    await fetch(`${API_URL}/api/goals/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    fetchGoals();
  };

  const handleCreateMilestone = async (
    e: React.FormEvent<HTMLFormElement>,
    goalId: number
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body = {
      goal_id: goalId,
      name: formData.get("name"),
      target_amount: formData.get("target_amount")
        ? Number(formData.get("target_amount"))
        : null,
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
    };
    await fetch(`${API_URL}/api/milestones/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowMilestoneForm(null);
    fetchGoals();
  };

  const handleDeleteGoal = async (id: number) => {
    await fetch(`${API_URL}/api/goals/${id}`, { method: "DELETE" });
    fetchGoals();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-white">
        <p className="text-zinc-400">Loading goals...</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Financial Gantt Chart
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Goal-oriented timeline for wealth targets
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-sm">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 ${viewMode === "month" ? "bg-zinc-700" : "bg-zinc-900 hover:bg-zinc-800"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode("quarter")}
              className={`px-3 py-1.5 ${viewMode === "quarter" ? "bg-zinc-700" : "bg-zinc-900 hover:bg-zinc-800"}`}
            >
              Quarterly
            </button>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + New Goal
          </button>
        </div>
      </div>

      {/* New Goal Form */}
      {showForm && (
        <form
          onSubmit={handleCreateGoal}
          className="mb-6 p-4 rounded-xl bg-zinc-900 border border-zinc-800 grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <input
            name="name"
            placeholder="Goal name"
            required
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            name="description"
            placeholder="Description"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            name="target_amount"
            type="number"
            placeholder="Target amount"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            name="current_amount"
            type="number"
            placeholder="Current amount"
            defaultValue={0}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            name="start_date"
            type="date"
            required
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            name="end_date"
            type="date"
            required
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <input
            name="color"
            type="color"
            defaultValue="#3b82f6"
            className="bg-zinc-800 border border-zinc-700 rounded-lg h-10 w-full cursor-pointer"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            Create Goal
          </button>
        </form>
      )}

      {/* Gantt Chart */}
      {goals.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg">No goals yet</p>
          <p className="text-sm mt-1">
            Create your first financial goal to see it on the timeline
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          {/* Timeline header */}
          <div className="relative h-10 bg-zinc-900 border-b border-zinc-800 flex">
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 h-full flex items-center border-l border-zinc-800 px-2 text-xs text-zinc-500"
                style={{ left: m.left, width: m.width }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Today marker */}
            <div
              className="absolute top-0 bottom-0 w-px bg-red-500/60 z-10"
              style={{ left: getTodayPosition() }}
            >
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-[10px] px-1.5 py-0.5 rounded-b font-medium">
                Today
              </div>
            </div>

            {goals.map((goal) => {
              const progress =
                goal.target_amount && goal.target_amount > 0
                  ? Math.min(
                      (goal.current_amount / goal.target_amount) * 100,
                      100
                    )
                  : 0;

              return (
                <div key={goal.id}>
                  {/* Goal row */}
                  <div className="relative h-16 border-b border-zinc-800 hover:bg-zinc-900/50 group flex items-center">
                    {/* Label */}
                    <div className="w-56 shrink-0 px-4 flex items-center gap-2 z-10">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: goal.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {goal.name}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {formatDate(goal.start_date)} -{" "}
                          {formatDate(goal.end_date)}
                          {goal.target_amount
                            ? ` | ${formatCurrency(goal.target_amount)}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {/* Bar area */}
                    <div className="flex-1 relative h-full">
                      {/* Background bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md opacity-20"
                        style={{
                          ...getBarStyle(goal.start_date, goal.end_date),
                          backgroundColor: goal.color,
                        }}
                      />
                      {/* Progress bar */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md transition-all"
                        style={{
                          ...getBarStyle(goal.start_date, goal.end_date),
                          width: `${parseFloat(getBarStyle(goal.start_date, goal.end_date).width) * (progress / 100)}%`,
                          backgroundColor: goal.color,
                        }}
                      />
                      {/* Progress label */}
                      {goal.target_amount && goal.target_amount > 0 && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 text-[11px] font-medium px-2"
                          style={{
                            left: getBarStyle(goal.start_date, goal.end_date)
                              .left,
                          }}
                        >
                          {progress.toFixed(0)}%
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="hidden group-hover:flex gap-1 pr-3 z-10">
                      <button
                        onClick={() =>
                          setShowMilestoneForm(
                            showMilestoneForm === goal.id ? null : goal.id
                          )
                        }
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded"
                      >
                        + Milestone
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal.id)}
                        className="text-xs bg-red-900/50 hover:bg-red-800 px-2 py-1 rounded text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Milestone form */}
                  {showMilestoneForm === goal.id && (
                    <form
                      onSubmit={(e) => handleCreateMilestone(e, goal.id)}
                      className="flex gap-2 p-2 bg-zinc-900/80 border-b border-zinc-800"
                    >
                      <input
                        name="name"
                        placeholder="Milestone name"
                        required
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        name="target_amount"
                        type="number"
                        placeholder="Amount"
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        name="start_date"
                        type="date"
                        required
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <input
                        name="end_date"
                        type="date"
                        required
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-500 rounded px-3 py-1 text-xs font-medium"
                      >
                        Add
                      </button>
                    </form>
                  )}

                  {/* Milestones */}
                  {goal.milestones.map((ms) => (
                    <div
                      key={ms.id}
                      className="relative h-10 border-b border-zinc-800/50 flex items-center bg-zinc-950/50"
                    >
                      <div className="w-56 shrink-0 px-4 pl-10">
                        <p className="text-xs text-zinc-400 truncate">
                          {ms.name}
                        </p>
                      </div>
                      <div className="flex-1 relative h-full">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm"
                          style={{
                            ...getBarStyle(ms.start_date, ms.end_date),
                            backgroundColor: goal.color,
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary cards */}
      {goals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Total Goals
            </p>
            <p className="text-2xl font-bold mt-1">{goals.length}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Active
            </p>
            <p className="text-2xl font-bold mt-1 text-blue-400">
              {goals.filter((g) => g.status === "active").length}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Total Target
            </p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">
              {formatCurrency(
                goals.reduce((s, g) => s + (g.target_amount || 0), 0)
              )}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">
              Saved So Far
            </p>
            <p className="text-2xl font-bold mt-1 text-amber-400">
              {formatCurrency(
                goals.reduce((s, g) => s + g.current_amount, 0)
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
