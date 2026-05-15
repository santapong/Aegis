"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { APIError, tripsAPI, budgetsAPI, transactionsAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, Plus, Wallet, Receipt, Trash2, Plane } from "lucide-react";
import type { TripSummary, TripStatus } from "@/types";

const statusStyles: Record<TripStatus, string> = {
  planned: "text-blue-500 border-blue-500/40",
  active: "text-green-500 border-green-500/40",
  completed: "text-muted-foreground border-border",
};

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tripId = params.id;

  const [showBudget, setShowBudget] = useState(false);
  const [showTxn, setShowTxn] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ name: "", amount: "", category: "" });
  const [budgetErrors, setBudgetErrors] = useState<Record<string, string>>({});
  const [txnForm, setTxnForm] = useState({
    amount: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [txnErrors, setTxnErrors] = useState<Record<string, string>>({});

  const { data: summary, isLoading, error } = useQuery<TripSummary>({
    queryKey: ["trip-summary", tripId],
    queryFn: () => tripsAPI.summary(tripId) as Promise<TripSummary>,
    retry: (failureCount, err) => {
      // Don't retry 404 — the trip is gone.
      if (err instanceof APIError && err.status === 404) return false;
      return failureCount < 2;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["trip-summary", tripId] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
  };

  const createBudget = useMutation({
    mutationFn: (data: Record<string, unknown>) => budgetsAPI.create(data),
    onSuccess: () => {
      invalidate();
      setShowBudget(false);
      setBudgetForm({ name: "", amount: "", category: "" });
      toast.success("Budget line added");
    },
    onError: () => toast.error("Failed to add budget"),
  });

  const createTxn = useMutation({
    mutationFn: (data: Record<string, unknown>) => transactionsAPI.create(data),
    onSuccess: () => {
      invalidate();
      setShowTxn(false);
      setTxnForm({
        amount: "",
        category: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
      toast.success("Expense logged");
    },
    onError: () => toast.error("Failed to log expense"),
  });

  const deleteTrip = useMutation({
    mutationFn: () => tripsAPI.delete(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip deleted");
      router.push("/trips");
    },
    onError: () => toast.error("Failed to delete trip"),
  });

  if (error instanceof APIError && error.status === 404) {
    return (
      <EmptyState
        icon={Plane}
        title="Trip not found"
        description="This trip has been deleted or you don't have access."
        action={
          <Button size="sm" onClick={() => router.push("/trips")} icon={<ArrowLeft size={14} />}>
            Back to trips
          </Button>
        }
      />
    );
  }

  if (isLoading || !summary) {
    return null; // Next.js serves frontend/src/app/trips/[id]/loading.tsx during suspense.
  }

  const { trip } = summary;
  const overall =
    summary.total_budgeted > 0
      ? Math.round((summary.total_spent / summary.total_budgeted) * 100)
      : 0;

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <button
          onClick={() => router.push("/trips")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft size={14} /> Back to trips
        </button>
        <PageHeader
          title={trip.title}
          subtitle={
            <>
              {trip.destination && <span>{trip.destination} · </span>}
              <span>
                {trip.start_date} — {trip.end_date}
              </span>
              <span className={`ml-2 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${statusStyles[trip.status]}`}>
                {trip.status}
              </span>
            </>
          }
          action={
            <div className="flex gap-2">
              <Button variant="outline" icon={<Wallet size={16} />} onClick={() => setShowBudget(true)}>
                Add Budget
              </Button>
              <Button icon={<Receipt size={16} />} onClick={() => setShowTxn(true)}>
                Log Expense
              </Button>
            </div>
          }
        />
      </motion.div>

      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Budgeted</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary.total_budgeted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Spent</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary.total_spent)}</p>
            <p className="text-xs text-muted-foreground mt-1">{overall}% of budget</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Transactions</p>
            <p className="text-2xl font-bold mt-1">{summary.transaction_count}</p>
          </CardContent>
        </Card>
      </motion.div>

      {summary.by_category.length > 0 && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Per-category breakdown</h2>
            </CardHeader>
            <div className="divide-y divide-border">
              {summary.by_category.map((c) => {
                const pct = c.budgeted > 0 ? (c.spent / c.budgeted) * 100 : 0;
                const over = c.spent > c.budgeted && c.budgeted > 0;
                return (
                  <div key={c.category} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium capitalize">{c.category}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(c.spent)} / {formatCurrency(c.budgeted)}
                      </span>
                    </div>
                    {c.budgeted > 0 && (
                      <div className="w-full bg-muted rounded-full h-2">
                        <motion.div
                          className={`h-2 rounded-full transition-all ${
                            over ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(pct, 100)}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      {trip.notes && (
        <motion.div variants={staggerItem}>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{trip.notes}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={staggerItem} className="flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          icon={<Trash2 size={14} />}
          onClick={() => setShowDelete(true)}
        >
          Delete Trip
        </Button>
      </motion.div>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Trip" size="sm">
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{trip.title}</span>? Linked
            budgets and transactions will be kept but unlinked from this trip.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={deleteTrip.isPending}
            onClick={() => deleteTrip.mutate()}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>

      <Modal open={showBudget} onClose={() => { setShowBudget(false); setBudgetErrors({}); }} title="Add Trip Budget" size="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errs: Record<string, string> = {};
            if (!budgetForm.name.trim()) errs.name = "Name is required";
            const amount = parseFloat(budgetForm.amount);
            if (!budgetForm.amount || Number.isNaN(amount) || amount <= 0) {
              errs.amount = "Amount must be greater than 0";
            }
            if (!budgetForm.category.trim()) errs.category = "Category is required";
            setBudgetErrors(errs);
            if (Object.keys(errs).length > 0) return;
            createBudget.mutate({
              name: budgetForm.name,
              amount,
              category: budgetForm.category,
              period_start: trip.start_date,
              period_end: trip.end_date,
              trip_id: trip.id,
            });
          }}
        >
          <ModalBody className="space-y-4">
            <Input
              label="Name"
              placeholder="e.g. Flights"
              value={budgetForm.name}
              onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
              error={budgetErrors.name}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount"
                type="number"
                value={budgetForm.amount}
                onChange={(e) => setBudgetForm({ ...budgetForm, amount: e.target.value })}
                min="0"
                step="0.01"
                error={budgetErrors.amount}
              />
              <Input
                label="Category"
                placeholder="e.g. flights"
                value={budgetForm.category}
                onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}
                error={budgetErrors.category}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={() => { setShowBudget(false); setBudgetErrors({}); }}>
              Cancel
            </Button>
            <Button type="submit" loading={createBudget.isPending}>
              Add
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal open={showTxn} onClose={() => { setShowTxn(false); setTxnErrors({}); }} title="Log Trip Expense" size="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errs: Record<string, string> = {};
            const amount = parseFloat(txnForm.amount);
            if (!txnForm.amount || Number.isNaN(amount) || amount <= 0) {
              errs.amount = "Amount must be greater than 0";
            }
            if (!txnForm.category.trim()) errs.category = "Category is required";
            if (!txnForm.date) errs.date = "Date is required";
            setTxnErrors(errs);
            if (Object.keys(errs).length > 0) return;
            createTxn.mutate({
              amount,
              type: "expense",
              category: txnForm.category,
              date: txnForm.date,
              description: txnForm.description || null,
              trip_id: trip.id,
            });
          }}
        >
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Amount"
                type="number"
                value={txnForm.amount}
                onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                min="0"
                step="0.01"
                error={txnErrors.amount}
              />
              <Input
                label="Category"
                placeholder="e.g. dining"
                value={txnForm.category}
                onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })}
                error={txnErrors.category}
              />
            </div>
            <Input
              label="Date"
              type="date"
              value={txnForm.date}
              onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
              error={txnErrors.date}
            />
            <Input
              label="Description"
              placeholder="optional"
              value={txnForm.description}
              onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={() => { setShowTxn(false); setTxnErrors({}); }}>
              Cancel
            </Button>
            <Button type="submit" loading={createTxn.isPending}>
              Log
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </motion.div>
  );
}
