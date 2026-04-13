"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { debtsAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/tabs";
import { Plus, CreditCard, Trash2, DollarSign, TrendingDown } from "lucide-react";
import type { Debt, PayoffPlan } from "@/types";

const debtTypeLabels: Record<string, string> = {
  credit_card: "Credit Card",
  student_loan: "Student Loan",
  mortgage: "Mortgage",
  car_loan: "Car Loan",
  personal_loan: "Personal Loan",
  medical: "Medical",
  other: "Other",
};

export default function DebtsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [strategy, setStrategy] = useState("avalanche");
  const [extraPayment, setExtraPayment] = useState("0");
  const [form, setForm] = useState({
    name: "",
    description: "",
    balance: "",
    original_balance: "",
    interest_rate: "",
    minimum_payment: "",
    due_date: "",
    debt_type: "other",
    color: "#EF4444",
  });

  const { data: debts, isLoading } = useQuery<Debt[]>({
    queryKey: ["debts"],
    queryFn: () => debtsAPI.list() as Promise<Debt[]>,
  });

  const { data: payoffPlan } = useQuery<PayoffPlan>({
    queryKey: ["payoff-plan", strategy, extraPayment],
    queryFn: () => debtsAPI.payoffPlan(strategy, parseFloat(extraPayment) || 0) as Promise<PayoffPlan>,
    enabled: (debts?.length ?? 0) > 0,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => debtsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["payoff-plan"] });
      setShowCreate(false);
      setForm({ name: "", description: "", balance: "", original_balance: "", interest_rate: "", minimum_payment: "", due_date: "", debt_type: "other", color: "#EF4444" });
      toast.success("Debt added");
    },
    onError: () => toast.error("Failed to add debt"),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => debtsAPI.makePayment(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["payoff-plan"] });
      setPaymentDebt(null);
      setPaymentAmount("");
      toast.success("Payment recorded!");
    },
    onError: () => toast.error("Failed to record payment"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => debtsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debts"] });
      queryClient.invalidateQueries({ queryKey: ["payoff-plan"] });
      setDeleteId(null);
      toast.success("Debt deleted");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.balance) return;
    createMutation.mutate({
      name: form.name,
      description: form.description || null,
      balance: parseFloat(form.balance),
      original_balance: parseFloat(form.original_balance) || parseFloat(form.balance),
      interest_rate: parseFloat(form.interest_rate) || 0,
      minimum_payment: parseFloat(form.minimum_payment) || 0,
      due_date: form.due_date || null,
      debt_type: form.debt_type,
      color: form.color,
    });
  };

  const totalDebt = debts?.reduce((sum, d) => sum + d.balance, 0) ?? 0;
  const totalMinPayments = debts?.reduce((sum, d) => sum + d.minimum_payment, 0) ?? 0;
  const avgRate = debts && debts.length > 0 ? debts.reduce((sum, d) => sum + d.interest_rate, 0) / debts.length : 0;

  return (
    <motion.div
      className="max-w-7xl mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Debt Tracker"
          subtitle="Manage and pay off your debts strategically"
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
              Add Debt
            </Button>
          }
        />
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Debt</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(totalDebt)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Monthly Minimum</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalMinPayments)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Avg Interest Rate</p>
            <p className="text-2xl font-bold mt-1">{avgRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Debts Count</p>
            <p className="text-2xl font-bold mt-1">{debts?.length ?? 0}</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={staggerItem}>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <TabList>
            <Tab value="overview">Debts Overview</Tab>
            <Tab value="payoff">Payoff Plan</Tab>
          </TabList>

          <TabPanel value="overview">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} height={100} />)}
              </div>
            ) : debts && debts.length > 0 ? (
              <div className="space-y-4">
                {debts.map((debt) => {
                  const paidOff = debt.original_balance > 0
                    ? ((debt.original_balance - debt.balance) / debt.original_balance) * 100
                    : 0;
                  return (
                    <motion.div key={debt.id} variants={staggerItem}>
                      <Card>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg" style={{ backgroundColor: debt.color + "20" }}>
                                <CreditCard size={18} style={{ color: debt.color }} />
                              </div>
                              <div>
                                <h3 className="font-semibold">{debt.name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="neutral">{debtTypeLabels[debt.debt_type] || debt.debt_type}</Badge>
                                  <span className="text-xs text-muted-foreground">{debt.interest_rate}% APR</span>
                                  {debt.due_date && <span className="text-xs text-muted-foreground">Due: {debt.due_date}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="secondary" icon={<DollarSign size={14} />} onClick={() => { setPaymentDebt(debt); setPaymentAmount(""); }}>
                                Pay
                              </Button>
                              <button onClick={() => setDeleteId(debt.id)} className="text-red-500 hover:text-red-700 p-1">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium text-red-500">{formatCurrency(debt.balance)} remaining</span>
                              <span className="text-muted-foreground">of {formatCurrency(debt.original_balance)}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <motion.div
                                className="h-2 rounded-full bg-green-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${paidOff}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                              />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-green-500">{paidOff.toFixed(0)}% paid off</span>
                              <span className="text-xs text-muted-foreground">Min payment: {formatCurrency(debt.minimum_payment)}/mo</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No debts tracked"
                description="Add your debts to create a payoff strategy."
                action={<Button size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>Add Debt</Button>}
              />
            )}
          </TabPanel>

          <TabPanel value="payoff">
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-end gap-4">
                    <Select
                      label="Strategy"
                      value={strategy}
                      onChange={(e) => setStrategy(e.target.value)}
                      options={[
                        { value: "avalanche", label: "Avalanche (highest interest first)" },
                        { value: "snowball", label: "Snowball (smallest balance first)" },
                      ]}
                    />
                    <Input
                      label="Extra Monthly Payment"
                      type="number"
                      placeholder="0"
                      value={extraPayment}
                      onChange={(e) => setExtraPayment(e.target.value)}
                      min="0"
                      step="50"
                    />
                  </div>
                </CardContent>
              </Card>

              {payoffPlan && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingDown size={20} className="text-green-500" />
                      <h2 className="text-lg font-semibold">Payoff Summary</h2>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Time to Debt Free</p>
                        <p className="text-xl font-bold">{payoffPlan.total_months} months</p>
                        <p className="text-xs text-muted-foreground">{(payoffPlan.total_months / 12).toFixed(1)} years</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Interest</p>
                        <p className="text-xl font-bold text-red-500">{formatCurrency(payoffPlan.total_interest)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total to Pay</p>
                        <p className="text-xl font-bold">{formatCurrency(payoffPlan.total_paid)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Strategy</p>
                        <p className="text-xl font-bold capitalize">{payoffPlan.strategy}</p>
                      </div>
                    </div>

                    {payoffPlan.total_months > 0 && (
                      <div className="mt-4">
                        <h3 className="font-medium text-sm mb-2">Monthly Breakdown (first 12 months)</h3>
                        <div className="max-h-[300px] overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card">
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-2">Month</th>
                                <th className="text-left py-2 px-2">Debt</th>
                                <th className="text-right py-2 px-2">Payment</th>
                                <th className="text-right py-2 px-2">Interest</th>
                                <th className="text-right py-2 px-2">Remaining</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payoffPlan.monthly_steps
                                .filter((s) => s.month <= 12)
                                .map((step, i) => (
                                  <tr key={i} className="border-b border-border">
                                    <td className="py-1.5 px-2">{step.month}</td>
                                    <td className="py-1.5 px-2">{step.debt_name}</td>
                                    <td className="py-1.5 px-2 text-right">{formatCurrency(step.payment)}</td>
                                    <td className="py-1.5 px-2 text-right text-red-500">{formatCurrency(step.interest_paid)}</td>
                                    <td className="py-1.5 px-2 text-right">{formatCurrency(step.remaining_balance)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabPanel>
        </Tabs>
      </motion.div>

      {/* Create Debt Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Debt" size="md">
        <form onSubmit={handleCreate}>
          <ModalBody className="space-y-4">
            <Input label="Name" placeholder="e.g. Chase Credit Card" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Current Balance" type="number" placeholder="5000" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} min="0" step="0.01" />
              <Input label="Original Balance" type="number" placeholder="10000" value={form.original_balance} onChange={(e) => setForm({ ...form, original_balance: e.target.value })} min="0" step="0.01" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Interest Rate (%)" type="number" placeholder="18.99" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} min="0" max="100" step="0.01" />
              <Input label="Minimum Payment" type="number" placeholder="150" value={form.minimum_payment} onChange={(e) => setForm({ ...form, minimum_payment: e.target.value })} min="0" step="0.01" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Due Date (optional)" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              <Select
                label="Debt Type"
                value={form.debt_type}
                onChange={(e) => setForm({ ...form, debt_type: e.target.value })}
                options={Object.entries(debtTypeLabels).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <Textarea label="Description (optional)" placeholder="Notes..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Add Debt</Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal open={!!paymentDebt} onClose={() => setPaymentDebt(null)} title="Make Payment" size="sm">
        <ModalBody>
          {paymentDebt && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Payment for <strong>{paymentDebt.name}</strong></p>
              <p className="text-sm">Current balance: {formatCurrency(paymentDebt.balance)}</p>
              <Input label="Payment Amount" type="number" placeholder={String(paymentDebt.minimum_payment)} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} min="0" step="0.01" />
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setPaymentDebt(null)}>Cancel</Button>
          <Button loading={paymentMutation.isPending} onClick={() => { if (paymentDebt && paymentAmount) paymentMutation.mutate({ id: paymentDebt.id, amount: parseFloat(paymentAmount) }); }}>
            Record Payment
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Debt" size="sm">
        <ModalBody>
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="destructive" loading={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Delete</Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}
