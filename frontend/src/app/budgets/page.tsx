"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { budgetsAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { Plus, Trash2, AlertTriangle, Pencil, Wallet } from "lucide-react";
import type { Budget, BudgetComparisonResponse } from "@/types";

const defaultForm = {
  name: "",
  amount: "",
  category: "",
  period_start: new Date().toISOString().split("T")[0],
  period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .split("T")[0],
};

const glassTooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: budgets } = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: () => budgetsAPI.list({ active: "true" }) as Promise<Budget[]>,
  });

  const { data: comparison } = useQuery<BudgetComparisonResponse>({
    queryKey: ["budget-comparison"],
    queryFn: () => budgetsAPI.comparison() as Promise<BudgetComparisonResponse>,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["budget-comparison"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => budgetsAPI.create(data),
    onSuccess: () => { invalidateAll(); closeForm(); toast.success("Budget created"); },
    onError: () => toast.error("Failed to create budget"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => budgetsAPI.update(id, data),
    onSuccess: () => { invalidateAll(); closeForm(); toast.success("Budget updated"); },
    onError: () => toast.error("Failed to update budget"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsAPI.delete(id),
    onSuccess: () => { invalidateAll(); setDeleteId(null); toast.success("Budget deleted"); },
    onError: () => toast.error("Failed to delete budget"),
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingBudget(null);
    setForm(defaultForm);
    setErrors({});
  };

  const openEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setForm({
      name: budget.name,
      amount: String(budget.amount),
      category: budget.category,
      period_start: budget.period_start,
      period_end: budget.period_end,
    });
    setShowForm(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = "Amount must be greater than 0";
    if (!form.category.trim()) errs.category = "Category is required";
    if (form.period_end && form.period_start && form.period_end < form.period_start) {
      errs.period_end = "End date must be after start date";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const data = {
      name: form.name,
      amount: parseFloat(form.amount),
      category: form.category,
      period_start: form.period_start,
      period_end: form.period_end,
    };
    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const chartData = comparison?.comparisons.map((c) => ({
    category: c.category,
    Budget: c.budget_amount,
    Actual: c.actual_spent,
    over: c.over_budget,
  })) ?? [];

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Budget Management"
          subtitle="Track your spending against budget limits"
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowForm(true)}>
              Add Budget
            </Button>
          }
        />
      </motion.div>

      {/* Summary Cards */}
      {comparison && (
        <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Budgeted</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(comparison.total_budgeted)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Spent</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(comparison.total_spent)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className={`text-2xl font-bold mt-1 ${comparison.total_budgeted - comparison.total_spent >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatCurrency(comparison.total_budgeted - comparison.total_spent)}
            </p>
          </CardContent></Card>
        </motion.div>
      )}

      {/* Budget vs Actual Chart */}
      {chartData.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Budget vs Actual Spending</h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={glassTooltipStyle} />
                  <Legend />
                  <Bar dataKey="Budget" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Actual" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.over ? "#EF4444" : "#22C55E"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Budget Details with Progress */}
      {comparison && comparison.comparisons.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Budget Details</h2></CardHeader>
            <div className="divide-y divide-border">
              {comparison.comparisons.map((c) => (
                <div key={c.category} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{c.category}</span>
                      {c.over_budget && (
                        <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                          <AlertTriangle size={12} /> Over budget
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(c.actual_spent)} / {formatCurrency(c.budget_amount)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2.5">
                    <motion.div
                      className={`h-2.5 rounded-full transition-all ${c.over_budget ? "bg-red-500" : c.usage_percent > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(c.usage_percent, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{c.usage_percent}% used</span>
                    <span className={`text-xs font-medium ${c.remaining >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {c.remaining >= 0 ? `${formatCurrency(c.remaining)} left` : `${formatCurrency(Math.abs(c.remaining))} over`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Active Budgets Table */}
      {budgets && budgets.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">Active Budgets</h2></CardHeader>
            {/* Desktop */}
            <div className="hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Period</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((b) => (
                    <tr key={b.id} className="border-b border-border hover:bg-muted">
                      <td className="px-4 py-3 text-sm">{b.name}</td>
                      <td className="px-4 py-3 text-sm capitalize">{b.category}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(b.amount)}</td>
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {b.period_start} - {b.period_end}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(b)} className="text-muted-foreground hover:text-foreground p-1">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteId(b.id)} className="text-red-500 hover:text-red-700 p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-border">
              {budgets.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{b.category}</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="text-sm font-medium">{formatCurrency(b.amount)}</p>
                    <button onClick={() => openEdit(b)} className="text-muted-foreground p-1"><Pencil size={14} /></button>
                    <button onClick={() => setDeleteId(b.id)} className="text-red-500 p-1"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {(!budgets || budgets.length === 0) && !comparison && (
        <EmptyState
          icon={Wallet}
          title="No budgets set yet"
          description="Create your first budget to start tracking spending limits."
          action={<Button size="sm" onClick={() => setShowForm(true)} icon={<Plus size={14} />}>Add Budget</Button>}
        />
      )}

      {/* Create/Edit Budget Modal */}
      <Modal open={showForm} onClose={closeForm} title={editingBudget ? "Edit Budget" : "Add Budget"} size="md">
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            <Input
              label="Budget Name"
              placeholder="e.g. Monthly Food Budget"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount"
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                error={errors.amount}
                min="0"
                step="0.01"
              />
              <Input
                label="Category"
                placeholder="e.g. food"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                error={errors.category}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
              />
              <Input
                label="End Date"
                type="date"
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                error={errors.period_end}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingBudget ? "Save Changes" : "Create"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Budget" size="sm">
        <ModalBody>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this budget?</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="destructive" loading={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
