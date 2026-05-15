"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { plansAPI } from "@/lib/api";
import { formatCurrency, cn, getPriorityColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { ProgressRing } from "@/components/charts/progress-ring";
import { Plus, Target, LayoutGrid, List, Pencil, Trash2 } from "lucide-react";
import type { Plan, PlanCategory, PlanStatus, Priority, Recurrence } from "@/types";

const categoryOptions = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "investment", label: "Investment" },
  { value: "savings", label: "Savings" },
];

const statusOptions = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const recurrenceOptions = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const statusBadgeVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  planned: "neutral",
  in_progress: "info",
  completed: "success",
  cancelled: "danger",
};

const categoryBadgeVariant: Record<string, "success" | "warning" | "danger" | "info"> = {
  income: "success",
  expense: "danger",
  investment: "info",
  savings: "warning",
};

const defaultForm = {
  title: "",
  description: "",
  category: "expense" as PlanCategory,
  amount: "",
  currency: "USD",
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  recurrence: "once" as Recurrence,
  status: "planned" as PlanStatus,
  priority: "medium" as Priority,
  color: "#3B82F6",
};

export default function PlansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    const date = searchParams.get("date");
    setForm({
      ...defaultForm,
      start_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : defaultForm.start_date,
    });
    setEditingPlan(null);
    setShowForm(true);
    router.replace("/plans");
  }, [searchParams, router]);

  const queryParams: Record<string, string> = {};
  if (categoryFilter !== "all") queryParams.category = categoryFilter;
  if (statusFilter !== "all") queryParams.status = statusFilter;

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["plans", queryParams],
    queryFn: () => plansAPI.list(queryParams) as Promise<Plan[]>,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => plansAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      closeForm();
      toast.success("Plan created successfully");
    },
    onError: () => toast.error("Failed to create plan"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => plansAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      closeForm();
      toast.success("Plan updated successfully");
    },
    onError: () => toast.error("Failed to update plan"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => plansAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      setDeleteId(null);
      toast.success("Plan deleted");
    },
    onError: () => toast.error("Failed to delete plan"),
  });

  const progressMutation = useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) => plansAPI.updateProgress(id, progress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Progress updated");
    },
    onError: () => toast.error("Failed to update progress"),
  });

  // Debounce the progress-slider mutation. A drag from 0% → 100% used to fire
  // ~100 requests; we now batch into a single call ~250ms after the user
  // pauses. Per-plan timers so two simultaneous drags don't trample each other.
  const progressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const queueProgressUpdate = (id: string, progress: number) => {
    if (progressTimers.current[id]) clearTimeout(progressTimers.current[id]);
    progressTimers.current[id] = setTimeout(() => {
      progressMutation.mutate({ id, progress });
      delete progressTimers.current[id];
    }, 250);
  };
  // Optimistic in-cache update so the bar moves immediately while we wait.
  const setProgressOptimistic = (id: string, progress: number) => {
    queryClient.setQueryData<Plan[]>(["plans"], (prev) =>
      prev?.map((p) => (p.id === id ? { ...p, progress } : p)) ?? prev
    );
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPlan(null);
    setForm(defaultForm);
    setErrors({});
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      title: plan.title,
      description: plan.description || "",
      category: plan.category,
      amount: String(plan.amount),
      currency: plan.currency,
      start_date: plan.start_date,
      end_date: plan.end_date || "",
      recurrence: plan.recurrence,
      status: plan.status,
      priority: plan.priority,
      color: plan.color,
    });
    setShowForm(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = "Amount must be greater than 0";
    if (!form.start_date) errs.start_date = "Start date is required";
    if (form.end_date && form.start_date && form.end_date < form.start_date) {
      errs.end_date = "End date must be on or after start date";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const data = {
      title: form.title,
      description: form.description || null,
      category: form.category,
      amount: parseFloat(form.amount),
      currency: form.currency,
      start_date: form.start_date,
      end_date: form.end_date || null,
      recurrence: form.recurrence,
      status: form.status,
      priority: form.priority,
      color: form.color,
    };
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isGoal = (plan: Plan) => plan.category === "savings" || plan.category === "investment";

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Plans & Goals"
          subtitle="Manage your financial plans and track goals"
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowForm(true)}>
              Create Plan
            </Button>
          }
        />
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem} className="flex flex-wrap items-center gap-3">
        {/* Category filter pills */}
        <div className="flex gap-1 flex-wrap">
          {[{ value: "all", label: "All" }, ...categoryOptions].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCategoryFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                categoryFilter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-input hidden sm:block" />

        {/* Status filter pills */}
        <div className="flex gap-1 flex-wrap">
          {[{ value: "all", label: "All" }, ...statusOptions].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                statusFilter === opt.value
                  ? "bg-card border border-border text-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-1 border border-border rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <List size={16} />
          </button>
        </div>
      </motion.div>

      {/* Plans Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={200} />
          ))}
        </div>
      ) : plans && plans.length > 0 ? (
        viewMode === "grid" ? (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {plans.map((plan) => (
              <motion.div key={plan.id} variants={staggerItem}>
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                          <h3 className="font-semibold truncate">{plan.title}</h3>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant={categoryBadgeVariant[plan.category]}>{plan.category}</Badge>
                          <Badge variant={statusBadgeVariant[plan.status]}>{plan.status.replace("_", " ")}</Badge>
                        </div>
                      </div>
                      <DropdownMenu
                        items={[
                          { label: "Edit", icon: <Pencil size={14} />, onClick: () => openEdit(plan) },
                          { label: "Delete", icon: <Trash2 size={14} />, onClick: () => setDeleteId(plan.id), variant: "danger" },
                        ]}
                      />
                    </div>

                    {isGoal(plan) ? (
                      <div className="flex items-center gap-4 my-3">
                        <ProgressRing
                          value={plan.progress}
                          max={100}
                          size={72}
                          strokeWidth={6}
                          color={plan.color}
                          label={`${plan.progress}%`}
                        />
                        <div>
                          <p className="text-xl font-bold">{formatCurrency(plan.amount)}</p>
                          <p className="text-xs text-muted-foreground capitalize">{plan.priority} priority</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xl font-bold my-3">{formatCurrency(plan.amount)}</p>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Progress</span>
                          <span className="text-xs font-medium">{plan.progress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <motion.div
                            className="h-2 rounded-full"
                            style={{ backgroundColor: plan.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${plan.progress}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                      </>
                    )}

                    {/* Progress slider — optimistic update + debounced PATCH */}
                    <div className="mt-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={plan.progress}
                        onChange={(e) => {
                          const progress = parseInt(e.target.value);
                          setProgressOptimistic(plan.id, progress);
                          queueProgressUpdate(plan.id, progress);
                        }}
                        className="w-full h-1 accent-primary cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>{plan.start_date}</span>
                      <span className="capitalize">{plan.recurrence}</span>
                      {plan.end_date && <span>{plan.end_date}</span>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          /* List view */
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Priority</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Progress</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                          <span className="text-sm font-medium">{plan.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={categoryBadgeVariant[plan.category]}>{plan.category}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(plan.amount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant[plan.status]}>{plan.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getPriorityColor(plan.priority) }} />
                          <span className="text-sm capitalize">{plan.priority}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{plan.progress}%</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu
                          items={[
                            { label: "Edit", icon: <Pencil size={14} />, onClick: () => openEdit(plan) },
                            { label: "Delete", icon: <Trash2 size={14} />, onClick: () => setDeleteId(plan.id), variant: "danger" },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        <EmptyState
          icon={Target}
          title="No plans yet"
          description="Create your first financial plan to start tracking your goals."
          action={
            <Button size="sm" onClick={() => setShowForm(true)} icon={<Plus size={14} />}>
              Create Plan
            </Button>
          }
        />
      )}

      {/* Create/Edit Plan Modal */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingPlan ? "Edit Plan" : "Create Plan"}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            <Input
              label="Title"
              placeholder="e.g. Monthly Savings Goal"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              error={errors.title}
            />
            <Textarea
              label="Description (optional)"
              placeholder="Describe your plan..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as PlanCategory })}
                options={categoryOptions}
              />
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                error={errors.start_date}
              />
              <Input
                label="End Date (optional)"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select
                label="Recurrence"
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value as Recurrence })}
                options={recurrenceOptions}
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as PlanStatus })}
                options={statusOptions}
              />
              <Select
                label="Priority"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                options={priorityOptions}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingPlan ? "Save Changes" : "Create Plan"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Plan" size="sm">
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this plan? This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="destructive" loading={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
