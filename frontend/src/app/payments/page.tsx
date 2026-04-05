"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { paymentsAPI } from "@/lib/api";
import {
  CreditCard,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { Payment, StripeConfig } from "@/types";

export default function PaymentsPage() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [config, setConfig] = useState<StripeConfig | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    loadData();
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Payment completed successfully!");
    } else if (status === "cancelled") {
      toast.info("Payment was cancelled");
    }
  }, []);

  const loadData = async () => {
    try {
      const [configData, paymentsData] = await Promise.all([
        paymentsAPI.config() as Promise<StripeConfig>,
        paymentsAPI.list() as Promise<Payment[]>,
      ]);
      setConfig(configData);
      setPayments(paymentsData);
    } catch {
      // Config may fail if not set up
    }
  };

  const handleCheckout = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const result = await paymentsAPI.createCheckout({
        amount: amt,
        description: description || undefined,
      }) as { checkout_url: string };
      window.location.href = result.checkout_url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create checkout session";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "succeeded": return <CheckCircle size={16} className="text-green-500" />;
      case "failed": return <XCircle size={16} className="text-red-500" />;
      case "pending": return <Clock size={16} className="text-yellow-500" />;
      case "refunded": return <AlertTriangle size={16} className="text-orange-500" />;
      default: return <Clock size={16} className="text-gray-500" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "succeeded": return "success";
      case "failed": return "danger";
      case "pending": return "warning";
      case "refunded": return "warning";
      default: return "neutral";
    }
  };

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Payments"
          subtitle="Test Stripe payment integration"
        />
      </motion.div>

      {/* Test Mode Banner */}
      <motion.div variants={staggerItem}>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              Stripe Test Mode {config?.configured ? "Active" : "Not Configured"}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {config?.configured
                ? "Use test card 4242 4242 4242 4242 with any future expiry and any CVC."
                : "Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in .env to enable payments."}
            </p>
          </div>
          <Badge variant="warning" className="ml-auto flex-shrink-0">TEST</Badge>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Payment */}
        <motion.div variants={staggerItem} className="lg:col-span-1">
          <Card>
            <CardBody>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CreditCard size={18} />
                New Test Payment
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Amount (USD)</label>
                  <Input
                    type="number"
                    placeholder="10.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.50"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Description (optional)</label>
                  <Input
                    placeholder="Test payment"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCheckout}
                  disabled={loading || !config?.configured}
                >
                  {loading ? "Creating..." : "Pay with Stripe"}
                  <ExternalLink size={14} className="ml-2" />
                </Button>
              </div>

              {/* Test Card Info */}
              <div className="mt-6 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                  <Info size={12} />
                  Test Card Numbers
                </p>
                <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
                  <div className="flex justify-between">
                    <span>Success:</span>
                    <code className="font-mono">4242 4242 4242 4242</code>
                  </div>
                  <div className="flex justify-between">
                    <span>Decline:</span>
                    <code className="font-mono">4000 0000 0000 0002</code>
                  </div>
                  <div className="flex justify-between">
                    <span>3D Secure:</span>
                    <code className="font-mono">4000 0025 0000 3155</code>
                  </div>
                  <p className="pt-1 border-t border-[var(--border)] mt-2">
                    Use any future expiry date and any 3-digit CVC.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Payment History */}
        <motion.div variants={staggerItem} className="lg:col-span-2">
          <Card>
            <CardBody>
              <h3 className="font-semibold mb-4">Payment History</h3>

              {payments.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No payments yet</p>
                  <p className="text-xs mt-1">Create a test payment to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary)]/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {statusIcon(payment.status)}
                        <div>
                          <p className="text-sm font-medium">
                            ${payment.amount.toFixed(2)} {payment.currency.toUpperCase()}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {payment.description || "No description"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={statusColor(payment.status) as "success" | "danger" | "warning" | "neutral"}>
                          {payment.status}
                        </Badge>
                        <span className="text-xs text-[var(--text-muted)]">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
