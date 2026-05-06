"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { calendarAPI } from "@/lib/api";
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
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { staggerContainer, staggerItem, slideUp } from "@/lib/animations";
import type { CalendarEvent } from "@/types";

export default function CalendarPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [direction, setDirection] = useState(0);

  const openNewPlan = (day?: Date | null) => {
    const d = day ?? selectedDate ?? new Date();
    router.push(`/plans?new=1&date=${format(d, "yyyy-MM-dd")}`);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: () => calendarAPI.events(format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")) as Promise<CalendarEvent[]>,
  });

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

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "min-h-[100px] p-2 border-b border-r border-border cursor-pointer transition-colors",
                      !isCurrentMonth && "opacity-40",
                      isSelected && "bg-primary/5",
                      "hover:bg-muted"
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
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded truncate text-white font-medium",
                            categoryColors[event.category] ?? "bg-gray-500"
                          )}
                          title={`${event.title} - ${formatCurrency(event.amount)}`}
                        >
                          {event.title}
                        </div>
                      ))}
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
                          <span className="text-sm font-medium">{formatCurrency(event.amount)}</span>
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
                <h3 className="font-semibold mb-3">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
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
    </motion.div>
  );
}
