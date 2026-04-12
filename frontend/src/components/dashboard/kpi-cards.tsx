"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, PiggyBank, Target } from "lucide-react";
import { staggerContainer, staggerItem } from "@/lib/animations";
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
      color: "text-indigo-500",
      iconBg: "bg-indigo-500/10",
      gradient: "from-indigo-500/5 to-transparent",
    },
    {
      label: "Monthly Income",
      value: formatCurrency(data.monthly_income),
      icon: TrendingUp,
      color: "text-emerald-500",
      iconBg: "bg-emerald-500/10",
      gradient: "from-emerald-500/5 to-transparent",
    },
    {
      label: "Monthly Expenses",
      value: formatCurrency(data.monthly_expenses),
      icon: TrendingDown,
      color: "text-rose-500",
      iconBg: "bg-rose-500/10",
      gradient: "from-rose-500/5 to-transparent",
    },
    {
      label: "Savings Rate",
      value: `${data.savings_rate}%`,
      icon: Target,
      color: "text-violet-500",
      iconBg: "bg-violet-500/10",
      gradient: "from-violet-500/5 to-transparent",
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {cards.map((card) => (
        <motion.div
          key={card.label}
          variants={staggerItem}
          whileHover={{ y: -2, transition: { type: "spring", stiffness: 400, damping: 20 } }}
          className={`bg-card rounded-xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow cursor-default bg-gradient-to-br ${card.gradient}`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">{card.label}</span>
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.iconBg}`}>
              <card.icon size={20} className={card.color} />
            </div>
          </div>
          <p className="text-3xl font-bold tracking-tight text-foreground">{card.value}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
