"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { investmentsAPI } from "@/lib/api";
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
import { Plus, TrendingUp, TrendingDown, LineChart, Trash2, Pencil } from "lucide-react";
import { TradingViewWidget } from "@/components/investments/tradingview-widget";
import type { Investment, PortfolioSummary } from "@/types";

const defaultForm = {
  name: "",
  tradingview_symbol: "",
  units: "",
  cost_basis: "",
  current_price: "",
  currency: "USD",
  notes: "",
};

export default function InvestmentsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: holdings, isLoading } = useQuery<Investment[]>({
    queryKey: ["investments"],
    queryFn: () => investmentsAPI.list() as Promise<Investment[]>,
  });

  const { data: summary } = useQuery<PortfolioSummary>({
    queryKey: ["investments-summary"],
    queryFn: () => investmentsAPI.summary() as Promise<PortfolioSummary>,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["investments"] });
    queryClient.invalidateQueries({ queryKey: ["investments-summary"] });
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => investmentsAPI.create(data),
    onSuccess: () => {
      invalidate();
      closeForm();
      toast.success("Holding added");
    },
    onError: () => toast.error("Failed to add holding"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      investmentsAPI.update(id, data),
    onSuccess: () => {
      invalidate();
      closeForm();
      toast.success("Holding updated");
    },
    onError: () => toast.error("Failed to update holding"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => investmentsAPI.delete(id),
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      toast.success("Holding removed");
    },
  });

  const closeForm = () => {
    setShowCreate(false);
    setEditing(null);
    setForm(defaultForm);
    setErrors({});
  };

  const openEdit = (inv: Investment) => {
    setEditing(inv);
    setForm({
      name: inv.name,
      tradingview_symbol: inv.tradingview_symbol,
      units: String(inv.units),
      cost_basis: String(inv.cost_basis),
      current_price: String(inv.current_price),
      currency: inv.currency,
      notes: inv.notes ?? "",
    });
    setShowCreate(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.tradingview_symbol.trim()) {
      errs.tradingview_symbol = "Ticker is required (e.g. NASDAQ:AAPL)";
    } else if (!/^[A-Z0-9_]{2,}:[A-Z0-9._-]{1,}$/i.test(form.tradingview_symbol.trim())) {
      errs.tradingview_symbol = "Use EXCHANGE:TICKER format (e.g. NASDAQ:AAPL)";
    }
    const units = parseFloat(form.units);
    if (!form.units || Number.isNaN(units) || units < 0) errs.units = "Units must be ≥ 0";
    const cost = parseFloat(form.cost_basis);
    if (form.cost_basis && (Number.isNaN(cost) || cost < 0)) errs.cost_basis = "Must be ≥ 0";
    const price = parseFloat(form.current_price);
    if (form.current_price && (Number.isNaN(price) || price < 0)) {
      errs.current_price = "Must be ≥ 0";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      tradingview_symbol: form.tradingview_symbol.trim().toUpperCase(),
      units: parseFloat(form.units),
      cost_basis: parseFloat(form.cost_basis || "0"),
      current_price: parseFloat(form.current_price || "0"),
      currency: form.currency || "USD",
      notes: form.notes || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const totalValue = summary?.total_current_value ?? 0;
  const totalPL = summary?.total_pl ?? 0;
  const totalPLPct = summary?.total_pl_percent ?? 0;
  const isPositive = totalPL >= 0;

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Investments"
          subtitle="Track holdings and watch live price charts powered by TradingView."
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
              Add Holding
            </Button>
          }
        />
      </motion.div>

      {/* Portfolio Summary */}
      {summary && summary.holding_count > 0 && (
        <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Portfolio Value</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.holding_count} holding{summary.holding_count === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Cost Basis</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary.total_cost_basis)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Unrealised P/L</p>
              <p className={`text-2xl font-bold mt-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {isPositive ? "+" : ""}
                {formatCurrency(totalPL)}
              </p>
              <p className={`text-xs mt-1 ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {isPositive ? "+" : ""}
                {totalPLPct.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : !holdings || holdings.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No holdings yet"
          description="Add a stock, ETF, or crypto holding to track its value with a TradingView chart."
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
              Add your first holding
            </Button>
          }
        />
      ) : (
        <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {holdings.map((h) => {
            const value = h.units * h.current_price;
            const pl = value - h.cost_basis;
            const plPct = h.cost_basis > 0 ? (pl / h.cost_basis) * 100 : 0;
            const positive = pl >= 0;
            return (
              <Card key={h.id}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{h.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {h.tradingview_symbol}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(h)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        aria-label="Edit holding"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(h.id)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500"
                        aria-label="Delete holding"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Units</p>
                      <p className="font-medium">{h.units}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cost Basis</p>
                      <p className="font-medium">{formatCurrency(h.cost_basis, h.currency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Value</p>
                      <p className="font-medium">{formatCurrency(value, h.currency)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    {positive ? (
                      <TrendingUp size={16} className="text-green-500" />
                    ) : (
                      <TrendingDown size={16} className="text-red-500" />
                    )}
                    <span className={positive ? "text-green-500" : "text-red-500"}>
                      {positive ? "+" : ""}
                      {formatCurrency(pl, h.currency)} ({positive ? "+" : ""}
                      {plPct.toFixed(2)}%)
                    </span>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <TradingViewWidget symbol={h.tradingview_symbol} height={220} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showCreate}
        onClose={closeForm}
        title={editing ? "Edit Holding" : "Add Holding"}
        size="md"
      >
        <form onSubmit={submit}>
          <ModalBody className="space-y-4">
            <Input
              label="Name"
              placeholder="Apple, Bitcoin, PTT..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={errors.name}
            />
            <Input
              label="TradingView Symbol"
              placeholder="NASDAQ:AAPL, SET:PTT, BINANCE:BTCUSDT"
              value={form.tradingview_symbol}
              onChange={(e) =>
                setForm({ ...form, tradingview_symbol: e.target.value })
              }
              error={errors.tradingview_symbol}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Units"
                type="number"
                step="0.000001"
                min="0"
                value={form.units}
                onChange={(e) => setForm({ ...form, units: e.target.value })}
                error={errors.units}
              />
              <Input
                label="Currency"
                placeholder="USD, THB..."
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value.toUpperCase() })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cost Basis (total)"
                type="number"
                step="0.01"
                min="0"
                value={form.cost_basis}
                onChange={(e) => setForm({ ...form, cost_basis: e.target.value })}
                error={errors.cost_basis}
              />
              <Input
                label="Current Price (per unit)"
                type="number"
                step="0.0001"
                min="0"
                value={form.current_price}
                onChange={(e) =>
                  setForm({ ...form, current_price: e.target.value })
                }
                error={errors.current_price}
              />
            </div>
            <Textarea
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? "Save Changes" : "Add Holding"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Remove Holding"
        size="sm"
      >
        <ModalBody>
          <p className="text-sm text-muted-foreground">
            Remove this holding from your portfolio? This action cannot be undone.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={deleteMutation.isPending}
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
          >
            Remove
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
