"use client";

import { useEffect, useState } from "react";

interface SavingsJar {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  icon: string | null;
  color: string | null;
  deadline: string | null;
  auto_save_amount: number | null;
  auto_save_frequency: string | null;
  created_at: string | null;
}

interface SavingsSummary {
  total_saved: number;
  total_target: number;
  overall_progress: number;
  jar_count: number;
  nearest_deadline: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDeadlineCountdown(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  if (days < 30) return `${days} days left`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month left" : `${months} months left`;
}

export default function SavingsJars() {
  const [jars, setJars] = useState<SavingsJar[]>([]);
  const [summary, setSummary] = useState<SavingsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingJar, setEditingJar] = useState<SavingsJar | null>(null);
  const [activeAction, setActiveAction] = useState<{
    jarId: number;
    type: "deposit" | "withdraw";
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [jarsRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/savings/`),
        fetch(`${API_URL}/api/savings/summary`),
      ]);
      const [jarsData, summaryData] = await Promise.all([
        jarsRes.json(),
        summaryRes.json(),
      ]);
      setJars(jarsData);
      setSummary(summaryData);
    } catch (err) {
      console.error("Failed to fetch savings data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      target_amount: Number(fd.get("target_amount")),
      current_amount: Number(fd.get("current_amount")) || 0,
      icon: fd.get("icon") || null,
      color: fd.get("color") || "#10b981",
      deadline: fd.get("deadline") || null,
      auto_save_amount: fd.get("auto_save_amount")
        ? Number(fd.get("auto_save_amount"))
        : null,
      auto_save_frequency:
        fd.get("auto_save_frequency") === "none"
          ? null
          : fd.get("auto_save_frequency"),
    };
    await fetch(`${API_URL}/api/savings/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setShowForm(false);
    fetchData();
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingJar) return;
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name"),
      target_amount: Number(fd.get("target_amount")),
      current_amount: Number(fd.get("current_amount")) || 0,
      icon: fd.get("icon") || null,
      color: fd.get("color") || "#10b981",
      deadline: fd.get("deadline") || null,
      auto_save_amount: fd.get("auto_save_amount")
        ? Number(fd.get("auto_save_amount"))
        : null,
      auto_save_frequency:
        fd.get("auto_save_frequency") === "none"
          ? null
          : fd.get("auto_save_frequency"),
    };
    await fetch(`${API_URL}/api/savings/${editingJar.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingJar(null);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/api/savings/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleDeposit = async (jarId: number, amount: number) => {
    await fetch(`${API_URL}/api/savings/${jarId}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    setActiveAction(null);
    fetchData();
  };

  const handleWithdraw = async (jarId: number, amount: number) => {
    await fetch(`${API_URL}/api/savings/${jarId}/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    setActiveAction(null);
    fetchData();
  };

  const handleActionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeAction) return;
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    if (!amount || amount <= 0) return;
    if (activeAction.type === "deposit") {
      handleDeposit(activeAction.jarId, amount);
    } else {
      handleWithdraw(activeAction.jarId, amount);
    }
  };

  if (loading && jars.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg
            className="w-5 h-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading savings jars...
        </div>
      </div>
    );
  }

  const renderJarForm = (jar: SavingsJar | null, onSubmit: (e: React.FormEvent<HTMLFormElement>) => void, onCancel: () => void) => (
    <div className="card-premium p-6 mb-6 animate-fade-in">
      <h2 className="text-lg font-semibold text-white mb-4">
        {jar ? "Edit Jar" : "Create New Jar"}
      </h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
              Jar Name
            </label>
            <input
              name="name"
              required
              defaultValue={jar?.name || ""}
              placeholder="e.g. Emergency Fund"
              className="input-premium w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
              Target Amount
            </label>
            <input
              name="target_amount"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={jar?.target_amount || ""}
              placeholder="100000"
              className="input-premium w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
              Current Amount
            </label>
            <input
              name="current_amount"
              type="number"
              min="0"
              step="1"
              defaultValue={jar?.current_amount || 0}
              placeholder="0"
              className="input-premium w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
              Icon
            </label>
            <input
              name="icon"
              defaultValue={jar?.icon || ""}
              placeholder="e.g. piggy-bank"
              className="input-premium w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                name="color"
                type="color"
                defaultValue={jar?.color || "#10b981"}
                className="w-10 h-10 rounded-lg border border-zinc-700 bg-zinc-800 cursor-pointer p-0.5"
              />
              <span className="text-xs text-zinc-500">Pick a jar color</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
              Deadline
            </label>
            <input
              name="deadline"
              type="date"
              defaultValue={jar?.deadline || ""}
              className="input-premium w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
              Auto-save Amount
            </label>
            <input
              name="auto_save_amount"
              type="number"
              min="0"
              step="1"
              defaultValue={jar?.auto_save_amount || ""}
              placeholder="0"
              className="input-premium w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider font-medium mb-1.5">
              Auto-save Frequency
            </label>
            <select
              name="auto_save_frequency"
              defaultValue={jar?.auto_save_frequency || "none"}
              className="input-premium w-full"
            >
              <option value="none">None</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="btn-premium bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
          >
            {jar ? "Save Changes" : "Create Jar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
          >
            Cancel
          </button>
          {jar && (
            <button
              type="button"
              onClick={() => {
                handleDelete(jar.id);
                onCancel();
              }}
              className="ml-auto px-4 py-2.5 rounded-lg text-sm bg-red-900/30 hover:bg-red-900/60 text-red-400 transition-colors"
            >
              Delete Jar
            </button>
          )}
        </div>
      </form>
    </div>
  );

  return (
    <div className="p-8 bg-zinc-950 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Savings Jars
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Visual savings goals to grow your wealth
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingJar(null);
          }}
          className="btn-premium bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          + New Jar
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              Total Saved
            </p>
            <p className="financial-number text-2xl mt-2 text-emerald-400">
              {formatCurrency(summary.total_saved)}
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              Total Target
            </p>
            <p className="financial-number text-2xl mt-2 text-white">
              {formatCurrency(summary.total_target)}
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              Overall Progress
            </p>
            <p className="financial-number text-2xl mt-2 text-emerald-400">
              {summary.overall_progress}%
            </p>
          </div>
          <div className="card-premium p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
              Nearest Deadline
            </p>
            <p className="financial-number text-2xl mt-2 text-amber-400">
              {summary.nearest_deadline
                ? formatDeadlineCountdown(summary.nearest_deadline)
                : "No deadline"}
            </p>
          </div>
        </div>
      )}

      {/* Add Jar Form */}
      {showForm &&
        !editingJar &&
        renderJarForm(null, handleCreate, () => setShowForm(false))}

      {/* Edit Jar Form */}
      {editingJar &&
        renderJarForm(editingJar, handleUpdate, () => setEditingJar(null))}

      {/* Jars Grid */}
      {jars.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <p className="text-zinc-500 text-lg">No savings jars yet</p>
          <p className="text-zinc-600 text-sm mt-1">
            Click &quot;+ New Jar&quot; to create your first savings goal
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jars.map((jar) => {
            const percentage =
              jar.target_amount > 0
                ? Math.min(
                    Math.round((jar.current_amount / jar.target_amount) * 100),
                    100
                  )
                : 0;
            const jarColor = jar.color || "#10b981";
            const isActionActive =
              activeAction && activeAction.jarId === jar.id;

            return (
              <div key={jar.id} className="card-premium p-6 animate-fade-in">
                {/* Visual Fill Indicator */}
                <div className="w-full h-32 rounded-xl bg-zinc-800 relative overflow-hidden mb-4">
                  <div
                    className="absolute bottom-0 w-full transition-all duration-700"
                    style={{
                      height: `${percentage}%`,
                      background: `linear-gradient(to top, ${jarColor}66, ${jarColor})`,
                      borderRadius: "0.5rem 0.5rem 0 0",
                    }}
                  >
                    {/* Wave/curve at the top of the fill */}
                    <div
                      className="absolute top-0 left-0 w-full h-3 -translate-y-1.5"
                      style={{
                        background: `radial-gradient(ellipse at 50% 100%, ${jarColor}88 0%, transparent 70%)`,
                        borderRadius: "50%",
                      }}
                    />
                  </div>
                  {/* Percentage overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="financial-number text-3xl text-white drop-shadow-lg">
                      {percentage}%
                    </span>
                  </div>
                </div>

                {/* Jar Name and Icon */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {jar.icon && (
                      <span className="text-lg">{jar.icon}</span>
                    )}
                    <h3 className="text-base font-semibold text-white truncate">
                      {jar.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setEditingJar(jar);
                      setShowForm(false);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Edit
                  </button>
                </div>

                {/* Progress: current / target */}
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm text-zinc-400">
                    <span className="financial-number text-emerald-400">
                      {formatCurrency(jar.current_amount)}
                    </span>
                    <span className="text-zinc-600 mx-1">/</span>
                    <span className="financial-number text-zinc-400">
                      {formatCurrency(jar.target_amount)}
                    </span>
                  </p>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${jarColor}20`,
                      color: jarColor,
                    }}
                  >
                    {percentage}%
                  </span>
                </div>

                {/* Deadline Countdown */}
                {jar.deadline && (
                  <div className="mb-2">
                    <span
                      className={`text-xs font-medium ${
                        daysUntil(jar.deadline) < 0
                          ? "text-red-400"
                          : daysUntil(jar.deadline) <= 7
                            ? "text-amber-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {formatDeadlineCountdown(jar.deadline)}
                    </span>
                  </div>
                )}

                {/* Auto-save Badge */}
                {jar.auto_save_frequency && (
                  <div className="mb-3">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 uppercase tracking-wider">
                      Auto-save {jar.auto_save_frequency}
                      {jar.auto_save_amount
                        ? ` - ${formatCurrency(jar.auto_save_amount)}`
                        : ""}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() =>
                      setActiveAction(
                        isActionActive && activeAction.type === "deposit"
                          ? null
                          : { jarId: jar.id, type: "deposit" }
                      )
                    }
                    className="btn-premium flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() =>
                      setActiveAction(
                        isActionActive && activeAction.type === "withdraw"
                          ? null
                          : { jarId: jar.id, type: "withdraw" }
                      )
                    }
                    className="btn-premium flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Withdraw
                  </button>
                </div>

                {/* Inline Deposit/Withdraw Form */}
                {isActionActive && (
                  <form
                    onSubmit={handleActionSubmit}
                    className="mt-3 flex gap-2 animate-fade-in"
                  >
                    <input
                      name="amount"
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder={
                        activeAction.type === "deposit"
                          ? "Deposit amount"
                          : "Withdraw amount"
                      }
                      className="input-premium flex-1"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                        activeAction.type === "deposit"
                          ? "bg-emerald-700 hover:bg-emerald-600"
                          : "bg-amber-700 hover:bg-amber-600"
                      }`}
                    >
                      Confirm
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
