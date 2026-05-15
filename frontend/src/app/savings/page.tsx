"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { savingsGoalsAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, PiggyBank, Trash2, DollarSign, Target } from "lucide-react";
import type { SavingsGoal } from "@/types";

export default function SavingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    target_amount: "",
    current_amount: "0",
    deadline: "",
    category: "general",
    color: "#3B82F6",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [contributeError, setContributeError] = useState<string>("");

  const { data: goals, isLoading } = useQuery<SavingsGoal[]>({
    queryKey: ["savings-goals"],
    queryFn: () => savingsGoalsAPI.list() as Promise<SavingsGoal[]>,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => savingsGoalsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-goals"] });
      setShowCreate(false);
      setForm({ name: "", description: "", target_amount: "", current_amount: "0", deadline: "", category: "general", color: "#3B82F6" });
      toast.success("Savings goal created");
    },
    onError: () => toast.error("Failed to create savings goal"),
  });

  const contributeMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => savingsGoalsAPI.contribute(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-goals"] });
      setContributeGoal(null);
      setContributeAmount("");
      toast.success("Contribution added!");
    },
    onError: () => toast.error("Failed to add contribution"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => savingsGoalsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings-goals"] });
      setDeleteId(null);
      toast.success("Savings goal deleted");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    const target = parseFloat(form.target_amount);
    if (!form.target_amount || Number.isNaN(target) || target <= 0) {
      errs.target_amount = "Target must be greater than 0";
    }
    const current = parseFloat(form.current_amount);
    if (form.current_amount && (Number.isNaN(current) || current < 0)) {
      errs.current_amount = "Current amount cannot be negative";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    createMutation.mutate({
      name: form.name,
      description: form.description || null,
      target_amount: target,
      current_amount: current || 0,
      deadline: form.deadline || null,
      category: form.category,
      color: form.color,
    });
  };

  const totalSaved = goals?.reduce((sum, g) => sum + g.current_amount, 0) ?? 0;
  const totalTarget = goals?.reduce((sum, g) => sum + g.target_amount, 0) ?? 0;

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Savings Goals"
          subtitle="Track your savings targets and contributions"
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
              New Goal
            </Button>
          }
        />
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Saved</p>
            <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(totalSaved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Target</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totalTarget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Overall Progress</p>
            <p className="text-2xl font-bold mt-1">{totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Goals Grid */}
      <motion.div variants={staggerItem}>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} height={220} />)}
          </div>
        ) : goals && goals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal) => {
              const progress = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
              const isComplete = progress >= 100;
              return (
                <motion.div key={goal.id} variants={staggerItem}>
                  <Card className={isComplete ? "border-green-500/30" : ""}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg" style={{ backgroundColor: goal.color + "20" }}>
                            <PiggyBank size={18} style={{ color: goal.color }} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm">{goal.name}</h3>
                            <p className="text-xs text-muted-foreground capitalize">{goal.category}</p>
                          </div>
                        </div>
                        <button onClick={() => setDeleteId(goal.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {goal.description && (
                        <p className="text-xs text-muted-foreground mb-3">{goal.description}</p>
                      )}

                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{formatCurrency(goal.current_amount)}</span>
                          <span className="text-muted-foreground">{formatCurrency(goal.target_amount)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <motion.div
                            className="h-2.5 rounded-full"
                            style={{ backgroundColor: isComplete ? "#22C55E" : goal.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs font-medium" style={{ color: isComplete ? "#22C55E" : goal.color }}>
                            {progress.toFixed(0)}%
                          </span>
                          {goal.deadline && (
                            <span className="text-xs text-muted-foreground">Due: {goal.deadline}</span>
                          )}
                        </div>
                      </div>

                      {!isComplete && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          icon={<DollarSign size={14} />}
                          onClick={() => { setContributeGoal(goal); setContributeAmount(""); }}
                        >
                          Add Contribution
                        </Button>
                      )}
                      {isComplete && (
                        <div className="text-center text-sm font-medium text-green-500 py-1">Goal Reached!</div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Target}
            title="No savings goals yet"
            description="Create your first savings goal to start tracking your progress."
            action={
              <Button size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
                Create Goal
              </Button>
            }
          />
        )}
      </motion.div>

      {/* Create Goal Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Savings Goal" size="md">
        <form onSubmit={handleCreate}>
          <ModalBody className="space-y-4">
            <Input
              label="Goal Name"
              placeholder="e.g. Emergency Fund"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Target Amount"
                type="number"
                placeholder="10000"
                value={form.target_amount}
                onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                min="0"
                step="0.01"
                error={errors.target_amount}
              />
              <Input
                label="Current Amount"
                type="number"
                placeholder="0"
                value={form.current_amount}
                onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
                min="0"
                step="0.01"
                error={errors.current_amount}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Deadline (optional)"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
              <Input
                label="Category"
                placeholder="e.g. emergency, vacation"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
            <Textarea
              label="Description (optional)"
              placeholder="Add a note about this goal..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Contribute Modal */}
      <Modal open={!!contributeGoal} onClose={() => setContributeGoal(null)} title="Add Contribution" size="sm">
        <ModalBody>
          {contributeGoal && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Contributing to <strong>{contributeGoal.name}</strong>
              </p>
              <p className="text-sm">
                Current: {formatCurrency(contributeGoal.current_amount)} / {formatCurrency(contributeGoal.target_amount)}
              </p>
              <Input
                label="Amount"
                type="number"
                placeholder="100"
                value={contributeAmount}
                onChange={(e) => { setContributeAmount(e.target.value); setContributeError(""); }}
                min="0"
                step="0.01"
                error={contributeError}
              />
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setContributeGoal(null); setContributeError(""); }}>Cancel</Button>
          <Button
            loading={contributeMutation.isPending}
            onClick={() => {
              if (!contributeGoal) return;
              const amount = parseFloat(contributeAmount);
              if (!contributeAmount || Number.isNaN(amount) || amount <= 0) {
                setContributeError("Enter an amount greater than 0");
                return;
              }
              contributeMutation.mutate({ id: contributeGoal.id, amount });
            }}
          >
            Contribute
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Savings Goal" size="sm">
        <ModalBody>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
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
