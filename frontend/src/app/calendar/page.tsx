"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { calendarAPI, plansAPI } from "@/lib/api";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  differenceInDays,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/ui/empty-state";
import { staggerContainer, staggerItem, slideUp } from "@/lib/animations";
import type { CalendarEvent, PlanCategory, PlanStatus, Priority, Recurrence } from "@/types";

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

const buildDefaultForm = (date: Date) => ({
  title: "",
  description: "",
  category: "expense" as PlanCategory,
  amount: "",
  currency: "USD",
  start_date: format(date, "yyyy-MM-dd"),
  end_date: "",
  recurrence: "once" as Recurrence,
  status: "planned" as PlanStatus,
  priority: "medium" as Priority,
  color: "#3B82F6",
});

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [direction, setDirection] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => buildDefaultForm(new Date()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const openNewPlan = (day?: Date | null) => {
    const d = day ?? selectedDate ?? new Date();
    setSelectedDate(d);
    setForm(buildDefaultForm(d));
    setErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setErrors({});
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: () => calendarAPI.events(format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")) as Promise<CalendarEvent[]>,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => plansAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      closeForm();
      toast.success("Plan created successfully");
    },
    onError: () => toast.error("Failed to create plan"),
  });

  const eventsQueryKey = [
    "calendar-events",
    format(monthStart, "yyyy-MM-dd"),
    format(monthEnd, "yyyy-MM-dd"),
  ];

  const moveMutation = useMutation({
    mutationFn: ({ id, newStart }: { id: string; newStart: string }) =>
      calendarAPI.moveEvent(id, { new_start: newStart }),
    onMutate: async ({ id, newStart }) => {
      await queryClient.cancelQueries({ queryKey: ["calendar-events"] });
      const previous = queryClient.getQueryData<CalendarEvent[]>(eventsQueryKey);
      queryClient.setQueryData<CalendarEvent[]>(eventsQueryKey, (old = []) =>
        old.map((event) => {
          if (event.id !== id) return event;
          const oldStart = new Date(event.start);
          const targetStart = new Date(newStart);
          const oldEnd = event.end ? new Date(event.end) : null;
          const offsetDays = differenceInDays(targetStart, oldStart);
          const newEnd =
            oldEnd != null
              ? format(
                  new Date(oldEnd.getTime() + offsetDays * 24 * 60 * 60 * 1000),
                  "yyyy-MM-dd"
                )
              : event.end;
          return { ...event, start: newStart, end: newEnd };
        })
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(eventsQueryKey, context.previous);
      }
      toast.error("Failed to reschedule plan");
    },
    onSuccess: () => {
      toast.success("Plan rescheduled");
    },
    onSettled: () => {
      setReschedulingId(null);
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  const handleEventDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    eventId: string
  ) => {
    setDraggedEventId(eventId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", eventId);
  };

  const handleEventDragEnd = () => {
    setDraggedEventId(null);
    setDragOverDay(null);
  };

  const handleDayDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    day: Date
  ) => {
    if (!draggedEventId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const key = format(day, "yyyy-MM-dd");
    if (dragOverDay !== key) setDragOverDay(key);
  };

  const handleDayDrop = (
    e: React.DragEvent<HTMLDivElement>,
    day: Date
  ) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain") || draggedEventId;
    setDragOverDay(null);
    setDraggedEventId(null);
    if (!eventId) return;
    const event = events.find((ev) => ev.id === eventId);
    if (!event) return;
    const newStart = format(day, "yyyy-MM-dd");
    if (event.start === newStart) return;
    setReschedulingId(eventId);
    moveMutation.mutate({ id: eventId, newStart });
  };

  const handleMobileReschedule = (eventId: string, value: string) => {
    if (!value) return;
    setReschedulingId(eventId);
    moveMutation.mutate({ id: eventId, newStart: value });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Title is required";
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = "Amount must be greater than 0";
    if (!form.start_date) errs.start_date = "Start date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
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
    });
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);
    return eachDayOfInterval({ start, end });
  }, [monthStart, monthEnd]);

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    return events.filter((e) => {
      const eventStart = new Date(e.start);
      const eventEnd = e.end ? new Date(e.end) : eventStart;
      return day >= eventStart && day <= eventEnd;
    });
  };

  const categoryColors: Record<string, string> = {
    income: "bg-green-500",
    expense: "bg-red-500",
    investment: "bg-indigo-500",
    savings: "bg-blue-500",
  };

  const categoryBadgeVariant: Record<string, "success" | "danger" | "info" | "warning"> = {
    income: "success",
    expense: "danger",
    investment: "info",
    savings: "warning",
  };

  const navigateMonth = (dir: number) => {
    setDirection(dir);
    setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    setSelectedDate(null);
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
          title="Calendar Planner"
          subtitle="Plan and schedule your financial activities"
          action={<Button icon={<Plus size={16} />} onClick={() => openNewPlan()}>New Plan</Button>}
        />
      </motion.div>

      {/* Calendar */}
      <motion.div variants={staggerItem}>
        <Card>
          {/* Month navigation */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 rounded-lg hover:bg-muted"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold">
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 rounded-lg hover:bg-muted"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="p-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid — Desktop */}
          <AnimatePresence mode="wait">
            <motion.div
              key={format(currentDate, "yyyy-MM")}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -30 }}
              transition={{ duration: 0.25 }}
              className="hidden md:grid grid-cols-7"
            >
              {calendarDays.map((day, i) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const dayKey = format(day, "yyyy-MM-dd");
                const isDropTarget = dragOverDay === dayKey;

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDate(day)}
                    onDragOver={(e) => handleDayDragOver(e, day)}
                    onDragLeave={() => {
                      if (dragOverDay === dayKey) setDragOverDay(null);
                    }}
                    onDrop={(e) => handleDayDrop(e, day)}
                    className={cn(
                      "min-h-[100px] p-2 border-b border-r border-border cursor-pointer transition-colors",
                      !isCurrentMonth && "opacity-40",
                      isSelected && "bg-primary/5",
                      isDropTarget && "bg-primary/10 ring-2 ring-inset ring-primary/40",
                      !isDropTarget && "hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full",
                        isToday && "bg-primary text-white"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => {
                        const isDragging = draggedEventId === event.id;
                        const isRescheduling = reschedulingId === event.id;
                        return (
                          <div
                            key={event.id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              handleEventDragStart(e, event.id);
                            }}
                            onDragEnd={handleEventDragEnd}
                            onClick={(e) => e.stopPropagation()}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded truncate text-white font-medium cursor-grab active:cursor-grabbing select-none",
                              categoryColors[event.category] ?? "bg-gray-500",
                              isDragging && "opacity-50",
                              isRescheduling && "animate-pulse"
                            )}
                            title={`${event.title} - ${formatCurrency(event.amount)} (drag to reschedule)`}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Calendar — Mobile list view */}
          <div className="md:hidden divide-y divide-border">
            {calendarDays
              .filter((day) => isSameMonth(day, currentDate) && getEventsForDay(day).length > 0)
              .map((day, i) => {
                const dayEvents = getEventsForDay(day);
                return (
                  <div key={i} className="p-3">
                    <p className="text-sm font-medium mb-2">{format(day, "EEE, MMM d")}</p>
                    <div className="space-y-1.5">
                      {dayEvents.map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-2 rounded-lg bg-muted">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2.5 h-2.5 rounded-full", categoryColors[event.category])} />
                            <span className="text-sm">{event.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{formatCurrency(event.amount)}</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="text-xs text-primary hover:underline"
                                  aria-label="Reschedule"
                                >
                                  Move
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-56">
                                <p className="text-xs font-medium mb-2">Reschedule to</p>
                                <Input
                                  type="date"
                                  defaultValue={event.start.slice(0, 10)}
                                  onChange={(e) =>
                                    handleMobileReschedule(event.id, e.target.value)
                                  }
                                />
                                {reschedulingId === event.id && (
                                  <p className="text-xs text-muted-foreground mt-2">Saving...</p>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            {calendarDays.filter((day) => isSameMonth(day, currentDate) && getEventsForDay(day).length > 0).length === 0 && (
              <EmptyState icon={Calendar} title="No events this month" className="py-8" />
            )}
          </div>
        </Card>
      </motion.div>

      {/* Selected day detail */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            variants={slideUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
                  <Button
                    size="sm"
                    icon={<Plus size={14} />}
                    onClick={() => openNewPlan(selectedDate)}
                  >
                    Add plan
                  </Button>
                </div>
                {getEventsForDay(selectedDate).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No plans for this day</p>
                ) : (
                  <div className="space-y-2">
                    {getEventsForDay(selectedDate).map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-3 h-3 rounded-full", categoryColors[event.category])} />
                          <div>
                            <p className="font-medium text-sm">{event.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant={categoryBadgeVariant[event.category]}>{event.category}</Badge>
                              <span className="text-xs text-muted-foreground capitalize">{event.status}</span>
                            </div>
                          </div>
                        </div>
                        <span className="font-semibold text-sm">{formatCurrency(event.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={showForm}
        onClose={closeForm}
        title={`Create plan for ${format(new Date(form.start_date), "MMM d, yyyy")}`}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            <Input
              label="Title"
              placeholder="e.g. Rent payment"
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
            <Button type="submit" loading={createMutation.isPending}>
              Create Plan
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </motion.div>
  );
}
