"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { tripsAPI } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { staggerContainer, staggerItem } from "@/lib/animations";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, Plane } from "lucide-react";
import type { Trip, TripStatus } from "@/types";

const defaultForm = {
  title: "",
  destination: "",
  start_date: new Date().toISOString().split("T")[0],
  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  total_budget: "",
  notes: "",
};

const statusStyles: Record<TripStatus, string> = {
  planned: "text-blue-500 border-blue-500/40",
  active: "text-green-500 border-green-500/40",
  completed: "text-muted-foreground border-border",
};

export default function TripsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: trips } = useQuery<Trip[]>({
    queryKey: ["trips"],
    queryFn: () => tripsAPI.list() as Promise<Trip[]>,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => tripsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      closeForm();
      toast.success("Trip created");
    },
    onError: () => toast.error("Failed to create trip"),
  });

  const closeForm = () => {
    setShowForm(false);
    setForm(defaultForm);
    setErrors({});
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (form.end_date < form.start_date) errs.end_date = "End date must be on or after start";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload: Record<string, unknown> = {
      title: form.title,
      destination: form.destination || null,
      start_date: form.start_date,
      end_date: form.end_date,
      notes: form.notes || null,
    };
    if (form.total_budget) payload.total_budget = parseFloat(form.total_budget);
    createMutation.mutate(payload);
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
          title="Trips"
          subtitle="Plan trip budgets and track spending against them"
          action={
            <Button icon={<Plus size={16} />} onClick={() => setShowForm(true)}>
              Plan a Trip
            </Button>
          }
        />
      </motion.div>

      {trips && trips.length > 0 ? (
        <motion.div variants={staggerItem} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map((t) => (
            <Link key={t.id} href={`/trips/${t.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{t.title}</h3>
                      {t.destination && (
                        <p className="text-xs text-muted-foreground truncate">{t.destination}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${statusStyles[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t.start_date} — {t.end_date}
                  </p>
                  {t.total_budget != null && (
                    <p className="text-lg font-bold">{formatCurrency(t.total_budget)}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </motion.div>
      ) : (
        <EmptyState
          icon={Plane}
          title="No trips yet"
          description="Plan a trip to track flights, lodging, dining, and more against per-category budgets."
          action={
            <Button size="sm" onClick={() => setShowForm(true)} icon={<Plus size={14} />}>
              Plan a Trip
            </Button>
          }
        />
      )}

      <Modal open={showForm} onClose={closeForm} title="Plan a Trip" size="md">
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            <Input
              label="Title"
              placeholder="e.g. Thailand May 2026"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              error={errors.title}
            />
            <Input
              label="Destination"
              placeholder="e.g. Bangkok"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
              <Input
                label="End Date"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                error={errors.end_date}
              />
            </div>
            <Input
              label="Total Budget (optional)"
              type="number"
              placeholder="0.00"
              value={form.total_budget}
              onChange={(e) => setForm({ ...form, total_budget: e.target.value })}
              min="0"
              step="0.01"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" type="button" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </motion.div>
  );
}
