"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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
import { Plus, Trash2, AlertTriangle, Pencil, Wallet, LayoutTemplate } from "lucide-react";
import type { Budget, BudgetComparisonResponse, BudgetTemplate } from "@/types";

// Recharts stays out of this page's static bundle — same split as the
// dashboard charts. ssr:false because Recharts needs ResizeObserver /
// window APIs unavailable during SSR.
const BudgetComparisonChart = dynamic(
  () =>
    import("@/components/charts/budget-comparison-chart").then(
      (m) => m.BudgetComparisonChart
    ),
  { ssr: false, loading: () => <Skeleton height={350} /> }
);

// Render a template's category split. When categories carry a `tier`
// (50/30/20: needs / wants / savings) we group them under tier headers so 9
// rows stay readable; otherwise (zero-based) we show a flat chip list. The
// per-category amount is previewed once the user enters their income.
function TemplateCategories({
  template,
  income,
}: {
  template: BudgetTemplate;
  income: number | null;
}) {
  const chip = (c: BudgetTemplate["categories"][number]) => (
    <span
      key={c.category}
      className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
    >
      <span className="capitalize">{c.category}</span>
      <span className="text-muted-foreground">{Math.round(c.pct * 100)}%</span>
      {income !== null && (
        <span className="font-medium">
          {formatCurrency(Math.round(income * c.pct * 100) / 100)}
        </span>
      )}
    </span>
  );

  const tiers = template.categories.some((c) => c.tier)
    ? Array.from(
        template.categories.reduce((acc, c) => {
          const key = c.tier ?? "other";
          (acc.get(key) ?? acc.set(key, []).get(key)!).push(c);
          return acc;
        }, new Map<string, BudgetTemplate["categories"]>())
      )
    : null;

  if (!tiers) {
    return <div className="mt-3 flex flex-wrap gap-2">{template.categories.map(chip)}</div>;
  }

  return (
    <div className="mt-3 space-y-2">
      {tiers.map(([tier, cats]) => (
        <div key={tier}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {tier} · {Math.round(cats.reduce((s, c) => s + c.pct, 0) * 100)}%
          </p>
          <div className="flex flex-wrap gap-2">{cats.map(chip)}</div>
        </div>
      ))}
    </div>
  );
}

const defaultForm = {
  name: "",
  amount: "",
  category: "",
  period_start: new Date().toISOString().split("T")[0],
  period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .split("T")[0],
};

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateIncome, setTemplateIncome] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);

  const { data: budgets } = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: () => budgetsAPI.list({ active: "true" }) as Promise<Budget[]>,
  });

  const { data: comparison } = useQuery<BudgetComparisonResponse>({
    queryKey: ["budget-comparison"],
    queryFn: () => budgetsAPI.comparison() as Promise<BudgetComparisonResponse>,
  });

  const { data: templates } = useQuery<BudgetTemplate[]>({
    queryKey: ["budget-templates"],
    queryFn: async () => (await budgetsAPI.listTemplates()).templates,
    // The catalog is static — no need to refetch on focus.
    staleTime: Infinity,
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

  const adoptMutation = useMutation({
    mutationFn: ({ key, income }: { key: string; income: number }) =>
      budgetsAPI.adoptTemplate(key, income),
    onSuccess: (rows) => {
      invalidateAll();
      closeTemplates();
      // Server is idempotent, so a re-adopt returns existing rows without
      // creating duplicates — phrase the toast so a no-op re-adopt still reads
      // as success rather than implying N fresh budgets every time.
      const n = Array.isArray(rows) ? rows.length : 0;
      toast.success(`Template applied — ${n} budget${n === 1 ? "" : "s"} ready for this month`);
    },
    onError: () => toast.error("Failed to apply template"),
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingBudget(null);
    setForm(defaultForm);
    setErrors({});
  };

  const closeTemplates = () => {
    setShowTemplates(false);
    setTemplateIncome("");
    setTemplateError(null);
  };

  const handleAdopt = (key: string) => {
    const income = parseFloat(templateIncome);
    if (!templateIncome || isNaN(income) || income <= 0) {
      setTemplateError("Enter your monthly income to size the budgets");
      return;
    }
    setTemplateError(null);
    adoptMutation.mutate({ key, income });
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                icon={<LayoutTemplate size={16} />}
                onClick={() => setShowTemplates(true)}
              >
                Use a template
              </Button>
              <Button icon={<Plus size={16} />} onClick={() => setShowForm(true)}>
                Add Budget
              </Button>
            </div>
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
              <BudgetComparisonChart data={chartData} />
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

      {/* Budget Templates Modal */}
      <Modal open={showTemplates} onClose={closeTemplates} title="Start from a template" size="lg">
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pick a template to create budgets for this month in one click. Amounts
            are sized from your monthly income; re-applying a template won&apos;t
            create duplicates.
          </p>
          <Input
            label="Monthly income"
            type="number"
            placeholder="0.00"
            value={templateIncome}
            onChange={(e) => setTemplateIncome(e.target.value)}
            error={templateError ?? undefined}
            min="0"
            step="0.01"
          />
          <div className="space-y-3">
            {(templates ?? []).map((t) => {
              const income = parseFloat(templateIncome);
              const hasIncome = !!templateIncome && !isNaN(income) && income > 0;
              const adoptingThis =
                adoptMutation.isPending && adoptMutation.variables?.key === t.key;
              return (
                <div key={t.key} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    </div>
                    <Button
                      size="sm"
                      loading={adoptingThis}
                      disabled={adoptMutation.isPending}
                      onClick={() => handleAdopt(t.key)}
                    >
                      Adopt
                    </Button>
                  </div>
                  <TemplateCategories template={t} income={hasIncome ? income : null} />
                </div>
              );
            })}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={closeTemplates}>Close</Button>
        </ModalFooter>
      </Modal>

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
