"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { transactionsAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Receipt } from "lucide-react";
import type { Transaction } from "@/types";

interface TransactionSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  by_category: Record<string, number>;
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: "",
    category: "",
    start_date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
  });
  const [form, setForm] = useState({
    amount: "",
    type: "expense" as "income" | "expense",
    category: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryParams: Record<string, string> = {};
  if (filters.type) queryParams.type = filters.type;
  if (filters.category) queryParams.category = filters.category;
  if (filters.start_date) queryParams.start_date = filters.start_date;
  if (filters.end_date) queryParams.end_date = filters.end_date;

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", queryParams],
    queryFn: () => transactionsAPI.list(queryParams) as Promise<Transaction[]>,
  });

  const { data: summary } = useQuery<TransactionSummary>({
    queryKey: ["transaction-summary", filters.start_date, filters.end_date],
    queryFn: () => transactionsAPI.summary(filters.start_date, filters.end_date) as Promise<TransactionSummary>,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => transactionsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setShowCreate(false);
      setForm({ amount: "", type: "expense", category: "", date: new Date().toISOString().split("T")[0], description: "" });
      toast.success("Transaction created successfully");
    },
    onError: () => toast.error("Failed to create transaction"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transactionsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setDeleteId(null);
      toast.success("Transaction deleted");
    },
    onError: () => toast.error("Failed to delete transaction"),
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = "Amount must be greater than 0";
    if (!form.category.trim()) errs.category = "Category is required";
    if (!form.date) errs.date = "Date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      amount: parseFloat(form.amount),
      type: form.type,
      category: form.category,
      date: form.date,
      description: form.description || null,
    });
  };

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Transactions"
          subtitle="Track your income and expenses"
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
              Add Transaction
            </Button>
          }
        />
      </motion.div>

      {/* Filters */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardBody className="!p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                options={[
                  { value: "", label: "All Types" },
                  { value: "income", label: "Income" },
                  { value: "expense", label: "Expense" },
                ]}
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              />
              <Input
                placeholder="Filter by category..."
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              />
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              />
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              />
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Summary Cards */}
      {summary && (
        <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--text-muted)]">Total Income</p>
              <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(summary.total_income)}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--text-muted)]">Total Expenses</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(summary.total_expenses)}</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--text-muted)]">Net</p>
              <p className={`text-2xl font-bold mt-1 ${summary.net >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatCurrency(summary.net)}
              </p>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Transactions Table */}
      <motion.div variants={staggerItem}>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
          </CardHeader>
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} height={48} />
              ))}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Description</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Category</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Type</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Amount</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors">
                        <td className="px-4 py-3 text-sm">{tx.date}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{tx.description || "—"}</td>
                        <td className="px-4 py-3 text-sm capitalize">{tx.category}</td>
                        <td className="px-4 py-3">
                          <Badge variant={tx.type === "income" ? "success" : "danger"}>
                            {tx.type === "income" ? (
                              <span className="flex items-center gap-1"><ArrowUpRight size={12} /> Income</span>
                            ) : (
                              <span className="flex items-center gap-1"><ArrowDownRight size={12} /> Expense</span>
                            )}
                          </Badge>
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}>
                          {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDeleteId(tx.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-[var(--border)]">
                {transactions.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${tx.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        {tx.type === "income" ? (
                          <ArrowUpRight size={16} className="text-green-500" />
                        ) : (
                          <ArrowDownRight size={16} className="text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{tx.category}</p>
                        <p className="text-xs text-[var(--text-muted)]">{tx.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </p>
                      <button onClick={() => setDeleteId(tx.id)} className="text-red-500 text-xs mt-1">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Add your first transaction to start tracking your finances."
              action={
                <Button size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
                  Add Transaction
                </Button>
              }
            />
          )}
        </Card>
      </motion.div>

      {/* Create Transaction Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Transaction" size="md">
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
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
              <Select
                label="Type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })}
                options={[
                  { value: "income", label: "Income" },
                  { value: "expense", label: "Expense" },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Category"
                placeholder="e.g. food, rent, salary"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                error={errors.category}
              />
              <Input
                label="Date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                error={errors.date}
              />
            </div>
            <Textarea
              label="Description (optional)"
              placeholder="Add a note..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Transaction" size="sm">
        <ModalBody>
          <p className="text-sm text-[var(--text-muted)]">
            Are you sure you want to delete this transaction? This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
