"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { transactionsAPI, tagsAPI } from "@/lib/api";
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
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Receipt, Upload, RefreshCw, Tag as TagIcon } from "lucide-react";
import type { Transaction, Tag, RecurringTransactionSummary, ImportPreviewResponse, ImportResult } from "@/types";

interface TransactionSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  by_category: Record<string, number>;
}

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
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
    is_recurring: false,
    recurring_interval: "",
    tag_ids: [] as string[],
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

  const { data: recurring } = useQuery<RecurringTransactionSummary>({
    queryKey: ["recurring-transactions"],
    queryFn: () => transactionsAPI.recurring() as Promise<RecurringTransactionSummary>,
  });

  const { data: tags } = useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => tagsAPI.list() as Promise<Tag[]>,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => transactionsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      setShowCreate(false);
      setForm({ amount: "", type: "expense", category: "", date: new Date().toISOString().split("T")[0], description: "", is_recurring: false, recurring_interval: "", tag_ids: [] });
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

  const importMutation = useMutation({
    mutationFn: (rows: unknown[]) => transactionsAPI.importConfirm(rows) as Promise<ImportResult>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
      setShowImport(false);
      setImportPreview(null);
      toast.success(`Imported ${(data as ImportResult).imported} transactions`);
    },
    onError: () => toast.error("Import failed"),
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
      is_recurring: form.is_recurring,
      recurring_interval: form.is_recurring && form.recurring_interval ? form.recurring_interval : null,
      tag_ids: form.tag_ids,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const preview = await transactionsAPI.importPreview(file) as ImportPreviewResponse;
      setImportPreview(preview);
      setShowImport(true);
    } catch {
      toast.error("Failed to parse CSV file");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleTag = (tagId: string) => {
    setForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
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
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileInputRef.current?.click()}>
                Import CSV
              </Button>
              <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
                Add Transaction
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Tabs */}
      <motion.div variants={staggerItem}>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <TabList>
            <Tab value="all">All Transactions</Tab>
            <Tab value="recurring">Subscriptions</Tab>
          </TabList>

          <TabPanel value="all">
            <div className="space-y-6">
              {/* Filters */}
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
                    <Input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} />
                    <Input type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} />
                  </div>
                </CardBody>
              </Card>

              {/* Summary Cards */}
              {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                </div>
              )}

              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold">Recent Transactions</h2>
                </CardHeader>
                {isLoading ? (
                  <div className="p-5 space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} height={48} />)}
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  <>
                    <div className="hidden sm:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Date</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Description</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Category</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Tags</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Type</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Amount</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx) => (
                            <tr key={tx.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors">
                              <td className="px-4 py-3 text-sm">
                                {tx.date}
                                {tx.is_recurring && <RefreshCw size={12} className="inline ml-1 text-blue-500" />}
                              </td>
                              <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{tx.description || "\u2014"}</td>
                              <td className="px-4 py-3 text-sm capitalize">{tx.category}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1 flex-wrap">
                                  {tx.tags?.map((tag) => (
                                    <span
                                      key={tag.id}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                                      style={{ backgroundColor: tag.color + "20", color: tag.color }}
                                    >
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                              </td>
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
                                <button onClick={() => setDeleteId(tx.id)} className="text-red-500 hover:text-red-700 p-1">
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
                              {tx.type === "income" ? <ArrowUpRight size={16} className="text-green-500" /> : <ArrowDownRight size={16} className="text-red-500" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium capitalize">{tx.category}</p>
                              <p className="text-xs text-[var(--text-muted)]">{tx.date}</p>
                              {tx.tags && tx.tags.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {tx.tags.map((tag) => (
                                    <span key={tag.id} className="text-xs px-1 rounded" style={{ backgroundColor: tag.color + "20", color: tag.color }}>
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}>
                              {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                            </p>
                            <button onClick={() => setDeleteId(tx.id)} className="text-red-500 text-xs mt-1">Delete</button>
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
                    action={<Button size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>Add Transaction</Button>}
                  />
                )}
              </Card>
            </div>
          </TabPanel>

          <TabPanel value="recurring">
            <div className="space-y-4">
              {recurring && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardBody>
                      <p className="text-sm text-[var(--text-muted)]">Monthly Recurring Cost</p>
                      <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(recurring.total_monthly_recurring)}</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <p className="text-sm text-[var(--text-muted)]">Recurring Income</p>
                      <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(recurring.recurring_income)}</p>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardBody>
                      <p className="text-sm text-[var(--text-muted)]">Active Subscriptions</p>
                      <p className="text-2xl font-bold mt-1">{recurring.subscriptions.length}</p>
                    </CardBody>
                  </Card>
                </div>
              )}

              {recurring && recurring.subscriptions.length > 0 ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <RefreshCw size={18} className="text-blue-500" />
                      <h2 className="text-lg font-semibold">Recurring Transactions</h2>
                    </div>
                  </CardHeader>
                  <div className="divide-y divide-[var(--border)]">
                    {recurring.subscriptions.map((sub) => (
                      <div key={sub.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${sub.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                            <RefreshCw size={16} className={sub.type === "income" ? "text-green-500" : "text-red-500"} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{sub.description || sub.category}</p>
                            <div className="flex gap-2 mt-0.5">
                              <Badge variant="default">{sub.recurring_interval || "monthly"}</Badge>
                              {sub.next_due_date && (
                                <span className="text-xs text-[var(--text-muted)]">Next: {sub.next_due_date}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className={`text-sm font-medium ${sub.type === "income" ? "text-green-500" : "text-red-500"}`}>
                          {sub.type === "income" ? "+" : "-"}{formatCurrency(sub.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : (
                <EmptyState
                  icon={RefreshCw}
                  title="No recurring transactions"
                  description="Mark transactions as recurring when creating them to track subscriptions."
                />
              )}
            </div>
          </TabPanel>
        </Tabs>
      </motion.div>

      {/* Create Transaction Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Transaction" size="md">
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Amount" type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={errors.amount} min="0" step="0.01" />
              <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })} options={[{ value: "income", label: "Income" }, { value: "expense", label: "Expense" }]} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Category" placeholder="e.g. food, rent, salary" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} error={errors.category} />
              <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.date} />
            </div>
            <Textarea label="Description (optional)" placeholder="Add a note..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div>
                <label className="text-sm font-medium block mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        form.tag_ids.includes(tag.id)
                          ? "border-transparent shadow-sm"
                          : "border-[var(--border)] opacity-60 hover:opacity-100"
                      }`}
                      style={form.tag_ids.includes(tag.id) ? { backgroundColor: tag.color + "30", color: tag.color } : {}}
                    >
                      <TagIcon size={10} />
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recurring toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_recurring: !form.is_recurring })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_recurring ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.is_recurring ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm font-medium">Recurring transaction</span>
            </div>
            {form.is_recurring && (
              <Select
                label="Frequency"
                value={form.recurring_interval}
                onChange={(e) => setForm({ ...form, recurring_interval: e.target.value })}
                options={[
                  { value: "weekly", label: "Weekly" },
                  { value: "biweekly", label: "Bi-weekly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "quarterly", label: "Quarterly" },
                  { value: "yearly", label: "Yearly" },
                ]}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Import Preview Modal */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportPreview(null); }} title="Import Transactions" size="lg">
        <ModalBody>
          {importPreview && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">
                Found <strong>{importPreview.valid_rows}</strong> valid rows out of {importPreview.total_rows} total rows.
              </p>
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--bg-card)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Description</th>
                      <th className="text-left py-2 px-2">Category</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-right py-2 px-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-[var(--border)]">
                        <td className="py-1.5 px-2">{row.date}</td>
                        <td className="py-1.5 px-2 text-[var(--text-muted)]">{row.description || "\u2014"}</td>
                        <td className="py-1.5 px-2 capitalize">{row.category}</td>
                        <td className="py-1.5 px-2">
                          <Badge variant={row.type === "income" ? "success" : "danger"}>{row.type}</Badge>
                        </td>
                        <td className="py-1.5 px-2 text-right">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importPreview.rows.length > 20 && (
                <p className="text-xs text-[var(--text-muted)]">Showing first 20 of {importPreview.rows.length} rows...</p>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => { setShowImport(false); setImportPreview(null); }}>Cancel</Button>
          <Button
            loading={importMutation.isPending}
            onClick={() => importPreview && importMutation.mutate(importPreview.rows)}
          >
            Import {importPreview?.valid_rows ?? 0} Transactions
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Transaction" size="sm">
        <ModalBody>
          <p className="text-sm text-[var(--text-muted)]">Are you sure you want to delete this transaction? This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
