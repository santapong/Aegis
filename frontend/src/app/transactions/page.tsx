"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { transactionsAPI, tagsAPI, tripsAPI } from "@/lib/api";
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
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, ArrowUpRight, ArrowDownRight, Receipt, Upload, RefreshCw, Tag as TagIcon, Settings, Check, X } from "lucide-react";
import type { Transaction, Tag, Trip, RecurringTransactionSummary, ImportPreviewResponse, ImportResult, UpcomingOccurrencesResponse } from "@/types";

interface TransactionSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  by_category: Record<string, number>;
}

type WeekendRule = "strict" | "roll_back" | "roll_forward";

const WEEKEND_RULE_OPTIONS: { value: WeekendRule; label: string }[] = [
  { value: "strict", label: "Keep the literal day (strict)" },
  { value: "roll_back", label: "Roll back to previous weekday" },
  { value: "roll_forward", label: "Roll forward to next weekday" },
];

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showManageTags, setShowManageTags] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagEditDraft, setTagEditDraft] = useState<{ name: string; color: string }>({ name: "", color: "#6366f1" });
  const [newTagDraft, setNewTagDraft] = useState<{ name: string; color: string }>({ name: "", color: "#6366f1" });
  const [tagErrors, setTagErrors] = useState<Record<string, string>>({});
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: "",
    category: "",
    start_date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
  });
  type RecurrenceMode = "interval" | "dates";
  const defaultForm = {
    amount: "",
    type: "expense" as "income" | "expense",
    category: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    is_recurring: false,
    recurring_interval: "",
    recurrence_mode: "interval" as RecurrenceMode,
    recurrence_dates: [] as number[],
    recurrence_weekend_rule: "strict" as WeekendRule,
    tag_ids: [] as string[],
    trip_id: "",
  };
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pagination — server returns at most `pageSize + 1` rows so we can
  // detect whether there's another page without a separate count query.
  // `pageSize` grows by PAGE_STEP each time the user clicks "Load more".
  const PAGE_STEP = 50;
  const [pageSize, setPageSize] = useState(PAGE_STEP);

  const queryParams: Record<string, string> = {};
  if (filters.type) queryParams.type = filters.type;
  if (filters.category) queryParams.category = filters.category;
  if (filters.start_date) queryParams.start_date = filters.start_date;
  if (filters.end_date) queryParams.end_date = filters.end_date;
  queryParams.limit = String(pageSize + 1);
  queryParams.offset = "0";

  // Reset visible page back to one chunk whenever filters change.
  useEffect(() => {
    setPageSize(PAGE_STEP);
  }, [filters.type, filters.category, filters.start_date, filters.end_date]);

  const { data: rawTransactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", filters, pageSize],
    queryFn: () => transactionsAPI.list(queryParams) as Promise<Transaction[]>,
  });
  const hasMore = (rawTransactions?.length ?? 0) > pageSize;
  const transactions = rawTransactions?.slice(0, pageSize);

  const { data: summary } = useQuery<TransactionSummary>({
    queryKey: ["transaction-summary", filters.start_date, filters.end_date],
    queryFn: () => transactionsAPI.summary(filters.start_date, filters.end_date) as Promise<TransactionSummary>,
  });

  const { data: recurring } = useQuery<RecurringTransactionSummary>({
    queryKey: ["recurring-transactions"],
    queryFn: () => transactionsAPI.recurring() as Promise<RecurringTransactionSummary>,
  });

  const { data: upcoming } = useQuery<UpcomingOccurrencesResponse>({
    queryKey: ["upcoming-occurrences"],
    queryFn: () => transactionsAPI.upcoming(30) as Promise<UpcomingOccurrencesResponse>,
  });

  const { data: tags } = useQuery<Tag[]>({
    queryKey: ["tags"],
    queryFn: () => tagsAPI.list() as Promise<Tag[]>,
  });

  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["trips"],
    queryFn: () => tripsAPI.list() as Promise<Trip[]>,
  });

  const invalidateAfterMutation = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["transaction-summary"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["upcoming-occurrences"] });
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditingTxn(null);
    setForm(defaultForm);
    setErrors({});
  };

  const openEdit = (tx: Transaction) => {
    setEditingTxn(tx);
    const usesDates = Array.isArray(tx.recurrence_dates) && tx.recurrence_dates.length > 0;
    setForm({
      amount: String(tx.amount),
      type: tx.type as "income" | "expense",
      category: tx.category,
      date: tx.date,
      description: tx.description ?? "",
      is_recurring: tx.is_recurring,
      recurring_interval: tx.recurring_interval ?? "",
      recurrence_mode: usesDates ? "dates" : "interval",
      recurrence_dates: tx.recurrence_dates ?? [],
      recurrence_weekend_rule: (tx.recurrence_weekend_rule as WeekendRule) ?? "strict",
      tag_ids: tx.tags?.map((t) => t.id) ?? [],
      trip_id: tx.trip_id ?? "",
    });
    setShowCreate(true);
  };

  const toggleRecurrenceDay = (day: number) => {
    setForm((prev) => {
      const has = prev.recurrence_dates.includes(day);
      return {
        ...prev,
        recurrence_dates: has
          ? prev.recurrence_dates.filter((d) => d !== day)
          : [...prev.recurrence_dates, day].sort((a, b) => a - b),
      };
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => transactionsAPI.create(data),
    onSuccess: () => {
      invalidateAfterMutation();
      closeForm();
      toast.success("Transaction created successfully");
    },
    onError: () => toast.error("Failed to create transaction"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      transactionsAPI.update(id, data),
    onSuccess: () => {
      invalidateAfterMutation();
      closeForm();
      toast.success("Transaction updated");
    },
    onError: () => toast.error("Failed to update transaction"),
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

  const invalidateTagsAndTransactions = () => {
    queryClient.invalidateQueries({ queryKey: ["tags"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) => tagsAPI.create(data),
    onSuccess: () => {
      invalidateTagsAndTransactions();
      setNewTagDraft({ name: "", color: "#6366f1" });
      setTagErrors({});
      toast.success("Tag created");
    },
    onError: () => toast.error("Failed to create tag"),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; color: string } }) => tagsAPI.update(id, data),
    onSuccess: () => {
      invalidateTagsAndTransactions();
      setEditingTagId(null);
      setTagErrors({});
      toast.success("Tag renamed");
    },
    onError: () => toast.error("Failed to update tag"),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => tagsAPI.delete(id),
    onSuccess: () => {
      invalidateTagsAndTransactions();
      // If user was editing the tag we just deleted, exit edit mode
      if (editingTagId && editingTagId === deleteTagId) setEditingTagId(null);
      setDeleteTagId(null);
      toast.success("Tag deleted");
    },
    onError: () => toast.error("Failed to delete tag"),
  });

  const validateTagDraft = (draft: { name: string; color: string }, scope: "new" | "edit"): boolean => {
    const errs: Record<string, string> = {};
    const name = draft.name.trim();
    if (!name) {
      errs[`${scope}_name`] = "Name is required";
    } else {
      // Duplicate check (case-insensitive). When editing, allow keeping the same name on the same tag.
      const duplicate = tags?.some(
        (t) =>
          t.name.toLowerCase() === name.toLowerCase() &&
          !(scope === "edit" && t.id === editingTagId)
      );
      if (duplicate) errs[`${scope}_name`] = "A tag with this name already exists";
    }
    if (!HEX_COLOR_RE.test(draft.color)) {
      errs[`${scope}_color`] = "Color must be a 7-char hex (#RRGGBB)";
    }
    setTagErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const startEditTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setTagEditDraft({ name: tag.name, color: tag.color });
    setTagErrors({});
  };

  const cancelEditTag = () => {
    setEditingTagId(null);
    setTagErrors({});
  };

  const submitEditTag = () => {
    if (!editingTagId) return;
    if (!validateTagDraft(tagEditDraft, "edit")) return;
    updateTagMutation.mutate({
      id: editingTagId,
      data: { name: tagEditDraft.name.trim(), color: tagEditDraft.color },
    });
  };

  const submitNewTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTagDraft(newTagDraft, "new")) return;
    createTagMutation.mutate({ name: newTagDraft.name.trim(), color: newTagDraft.color });
  };

  const closeManageTags = () => {
    setShowManageTags(false);
    setEditingTagId(null);
    setTagErrors({});
    setNewTagDraft({ name: "", color: "#6366f1" });
  };

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
    const usesCustomDates =
      form.is_recurring && form.recurrence_mode === "dates" && form.recurrence_dates.length > 0;
    const payload = {
      amount: parseFloat(form.amount),
      type: form.type,
      category: form.category,
      date: form.date,
      description: form.description || null,
      is_recurring: form.is_recurring,
      recurring_interval:
        form.is_recurring && form.recurrence_mode === "interval" && form.recurring_interval
          ? form.recurring_interval
          : null,
      recurrence_dates: usesCustomDates ? form.recurrence_dates : null,
      recurrence_weekend_rule: usesCustomDates ? form.recurrence_weekend_rule : null,
      tag_ids: form.tag_ids,
      trip_id: form.trip_id || null,
    };
    if (editingTxn) {
      updateMutation.mutate({ id: editingTxn.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
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
              <Button variant="secondary" icon={<Settings size={16} />} onClick={() => setShowManageTags(true)}>
                Manage Tags
              </Button>
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
                <CardContent className="p-4">
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
                </CardContent>
              </Card>

              {/* Summary Cards */}
              {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">Total Income</p>
                      <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(summary.total_income)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">Total Expenses</p>
                      <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(summary.total_expenses)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">Net</p>
                      <p className={`text-2xl font-bold mt-1 ${summary.net >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatCurrency(summary.net)}
                      </p>
                    </CardContent>
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
                          <tr className="border-b border-border bg-muted">
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Description</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Category</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Tags</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx) => (
                            <tr key={tx.id} className="border-b border-border hover:bg-muted transition-colors">
                              <td className="px-4 py-3 text-sm">
                                {tx.date}
                                {tx.is_recurring && <RefreshCw size={12} className="inline ml-1 text-primary" />}
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{tx.description || "\u2014"}</td>
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
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => openEdit(tx)} className="text-muted-foreground hover:text-foreground p-1">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={() => setDeleteId(tx.id)} className="text-red-500 hover:text-red-700 p-1">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-border">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${tx.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                              {tx.type === "income" ? <ArrowUpRight size={16} className="text-green-500" /> : <ArrowDownRight size={16} className="text-red-500" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium capitalize">{tx.category}</p>
                              <p className="text-xs text-muted-foreground">{tx.date}</p>
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
                            <div className="flex items-center justify-end gap-2 mt-1">
                              <button onClick={() => openEdit(tx)} className="text-muted-foreground p-1">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setDeleteId(tx.id)} className="text-red-500 p-1">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      className="flex items-center justify-between gap-4 px-4 py-3 border-t border-border"
                      style={{ fontSize: 12 }}
                    >
                      <span className="text-muted-foreground">
                        Showing {transactions.length}
                        {hasMore ? "+" : ""} transaction
                        {transactions.length === 1 ? "" : "s"}
                      </span>
                      {hasMore && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPageSize((p) => p + PAGE_STEP)}
                        >
                          Load {PAGE_STEP} more
                        </Button>
                      )}
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
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">Monthly Recurring Cost</p>
                      <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(recurring.total_monthly_recurring)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">Recurring Income</p>
                      <p className="text-2xl font-bold text-green-500 mt-1">{formatCurrency(recurring.recurring_income)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                      <p className="text-2xl font-bold mt-1">{recurring.subscriptions.length}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {recurring && recurring.subscriptions.length > 0 ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <RefreshCw size={18} className="text-primary" />
                      <h2 className="text-lg font-semibold">Recurring Transactions</h2>
                    </div>
                  </CardHeader>
                  <div className="divide-y divide-border">
                    {recurring.subscriptions.map((sub) => {
                      const cadenceLabel =
                        sub.recurrence_dates && sub.recurrence_dates.length > 0
                          ? `Days ${sub.recurrence_dates.join(", ")}`
                          : sub.recurring_interval || "monthly";
                      return (
                        <div key={sub.id} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${sub.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                              <RefreshCw size={16} className={sub.type === "income" ? "text-green-500" : "text-red-500"} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{sub.description || sub.category}</p>
                              <div className="flex gap-2 mt-0.5 items-center">
                                <Badge variant="neutral">{cadenceLabel}</Badge>
                                {sub.next_due_date && (
                                  <span className="text-xs text-muted-foreground">Next: {sub.next_due_date}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className={`text-sm font-medium ${sub.type === "income" ? "text-green-500" : "text-red-500"}`}>
                            {sub.type === "income" ? "+" : "-"}{formatCurrency(sub.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : (
                <EmptyState
                  icon={RefreshCw}
                  title="No recurring transactions"
                  description="Mark transactions as recurring when creating them to track subscriptions."
                />
              )}

              {upcoming && upcoming.occurrences.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <RefreshCw size={18} className="text-primary" />
                      <h2 className="text-lg font-semibold">
                        Next {upcoming.window_days} Days
                      </h2>
                    </div>
                  </CardHeader>
                  <div className="divide-y divide-border">
                    {upcoming.occurrences.map((occ, i) => (
                      <div
                        key={`${occ.transaction_id}-${occ.date}-${i}`}
                        className="p-3 flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground w-24">
                            {occ.date}
                          </span>
                          <span className="font-medium">
                            {occ.description || occ.category}
                          </span>
                        </div>
                        <span
                          className={`font-medium ${
                            occ.type === "income" ? "text-green-500" : "text-red-500"
                          }`}
                        >
                          {occ.type === "income" ? "+" : "-"}
                          {formatCurrency(occ.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </TabPanel>
        </Tabs>
      </motion.div>

      {/* Create / Edit Transaction Modal */}
      <Modal open={showCreate} onClose={closeForm} title={editingTxn ? "Edit Transaction" : "Add Transaction"} size="md">
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

            {trips && trips.length > 0 && (
              <Select
                label="Trip (optional)"
                value={form.trip_id}
                onChange={(e) => setForm({ ...form, trip_id: e.target.value })}
                options={[
                  { value: "", label: "None" },
                  ...trips.map((t) => ({ value: t.id, label: t.title })),
                ]}
              />
            )}

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
                          : "border-border opacity-60 hover:opacity-100"
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_recurring ? "bg-primary" : "bg-input"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${form.is_recurring ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm font-medium">Recurring transaction</span>
            </div>
            {form.is_recurring && (
              <div className="space-y-3">
                <Select
                  label="Recurrence type"
                  value={form.recurrence_mode}
                  onChange={(e) =>
                    setForm({ ...form, recurrence_mode: e.target.value as "interval" | "dates" })
                  }
                  options={[
                    { value: "interval", label: "Standard interval" },
                    { value: "dates", label: "Custom days of month (e.g. salary on 1 & 15)" },
                  ]}
                />
                {form.recurrence_mode === "interval" ? (
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
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium block mb-2">
                        Days of the month
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                          const selected = form.recurrence_dates.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleRecurrenceDay(day)}
                              className={`h-8 w-8 rounded-md text-xs font-medium transition-colors border ${
                                selected
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:bg-muted"
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Day 29–31 will clamp to the last day of shorter months.
                      </p>
                    </div>
                    <Select
                      label="If a payday falls on a weekend"
                      value={form.recurrence_weekend_rule}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          recurrence_weekend_rule: e.target.value as WeekendRule,
                        })
                      }
                      options={WEEKEND_RULE_OPTIONS}
                    />
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingTxn ? "Save Changes" : "Create"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Import Preview Modal */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportPreview(null); }} title="Import Transactions" size="lg">
        <ModalBody>
          {importPreview && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Found <strong>{importPreview.valid_rows}</strong> valid rows out of {importPreview.total_rows} total rows.
              </p>
              <div className="max-h-[300px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Description</th>
                      <th className="text-left py-2 px-2">Category</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-right py-2 px-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="py-1.5 px-2">{row.date}</td>
                        <td className="py-1.5 px-2 text-muted-foreground">{row.description || "\u2014"}</td>
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
                <p className="text-xs text-muted-foreground">Showing first 20 of {importPreview.rows.length} rows...</p>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setShowImport(false); setImportPreview(null); }}>Cancel</Button>
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
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this transaction? This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="destructive" loading={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</Button>
        </ModalFooter>
      </Modal>

      {/* Manage Tags Modal */}
      <Modal open={showManageTags} onClose={closeManageTags} title="Manage Tags" size="md">
        <ModalBody className="space-y-4">
          {tags && tags.length > 0 ? (
            <div className="divide-y divide-border rounded-lg border border-border">
              {tags.map((tag) => {
                const usage = transactions?.filter((tx) => tx.tags?.some((t) => t.id === tag.id)).length ?? 0;
                const isEditing = editingTagId === tag.id;
                return (
                  <div key={tag.id} className="p-3 flex items-center gap-3">
                    {isEditing ? (
                      <>
                        <input
                          type="color"
                          value={tagEditDraft.color}
                          onChange={(e) => setTagEditDraft({ ...tagEditDraft, color: e.target.value })}
                          className="h-9 w-10 rounded-lg border border-input bg-muted/50 cursor-pointer flex-shrink-0"
                          aria-label="Tag color"
                        />
                        <div className="flex-1">
                          <Input
                            value={tagEditDraft.name}
                            onChange={(e) => setTagEditDraft({ ...tagEditDraft, name: e.target.value })}
                            error={tagErrors.edit_name || tagErrors.edit_color}
                            placeholder="Tag name"
                          />
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={submitEditTag}
                            disabled={updateTagMutation.isPending}
                            className="text-green-600 hover:text-green-700 p-1 disabled:opacity-50"
                            aria-label="Save tag"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditTag}
                            className="text-muted-foreground hover:text-foreground p-1"
                            aria-label="Cancel edit"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span
                          className="h-5 w-5 rounded-full border border-border flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tag.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {usage === 0 ? "Not used" : `Used on ${usage} transaction${usage === 1 ? "" : "s"}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => startEditTag(tag)}
                            className="text-muted-foreground hover:text-foreground p-1"
                            aria-label={`Edit ${tag.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTagId(tag.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            aria-label={`Delete ${tag.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <TagIcon size={20} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No tags yet. Create one below.</p>
            </div>
          )}

          {/* Create tag form */}
          <form onSubmit={submitNewTag} className="space-y-2 pt-2 border-t border-border">
            <p className="text-sm font-medium">Create tag</p>
            <div className="flex items-start gap-2">
              <input
                type="color"
                value={newTagDraft.color}
                onChange={(e) => setNewTagDraft({ ...newTagDraft, color: e.target.value })}
                className="h-9 w-10 rounded-lg border border-input bg-muted/50 cursor-pointer flex-shrink-0 mt-[2px]"
                aria-label="New tag color"
              />
              <div className="flex-1">
                <Input
                  placeholder="e.g. groceries"
                  value={newTagDraft.name}
                  onChange={(e) => setNewTagDraft({ ...newTagDraft, name: e.target.value })}
                  error={tagErrors.new_name || tagErrors.new_color}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                loading={createTagMutation.isPending}
                icon={<Plus size={14} />}
              >
                Add
              </Button>
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={closeManageTags}>Close</Button>
        </ModalFooter>
      </Modal>

      {/* Delete Tag Confirmation Sub-modal */}
      <Modal open={!!deleteTagId} onClose={() => setDeleteTagId(null)} title="Delete Tag" size="sm">
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this tag? It will be detached from any transactions it&apos;s currently attached to. This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteTagId(null)}>Cancel</Button>
          <Button
            variant="destructive"
            loading={deleteTagMutation.isPending}
            onClick={() => deleteTagId && deleteTagMutation.mutate(deleteTagId)}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
