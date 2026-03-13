"use client";

import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, PiggyBank, Target } from "lucide-react";
import type { KPISummary } from "@/types";

interface KPICardsProps {
  data: KPISummary;
}

export function KPICards({ data }: KPICardsProps) {
  const cards = [
    {
      label: "Total Balance",
      value: formatCurrency(data.total_balance),
      icon: PiggyBank,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Monthly Income",
      value: formatCurrency(data.monthly_income),
      icon: TrendingUp,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Monthly Expenses",
      value: formatCurrency(data.monthly_expenses),
      icon: TrendingDown,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Savings Rate",
      value: `${data.savings_rate}%`,
      icon: Target,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)] hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[var(--text-muted)]">{card.label}</span>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon size={18} className={card.color} />
            </div>
          </div>
          <p className="text-2xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
