"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { CalendarEvent } from "@/types";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")],
    queryFn: () => calendarAPI.events(format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")),
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar Planner</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Plan and schedule your financial activities
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New Plan
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-semibold">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <button
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
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
                  "min-h-[100px] p-2 border-b border-r border-[var(--border)] cursor-pointer transition-colors",
                  !isCurrentMonth && "opacity-40",
                  isSelected && "bg-[var(--primary)]/5",
                  "hover:bg-[var(--bg-secondary)]"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full",
                    isToday && "bg-[var(--primary)] text-white"
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
                    <span className="text-xs text-[var(--text-muted)]">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="bg-[var(--bg-card)] rounded-xl p-5 border border-[var(--border)]">
          <h3 className="font-semibold mb-3">{format(selectedDate, "EEEE, MMMM d, yyyy")}</h3>
          {getEventsForDay(selectedDate).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No plans for this day</p>
          ) : (
            <div className="space-y-2">
              {getEventsForDay(selectedDate).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", categoryColors[event.category])} />
                    <div>
                      <p className="font-medium text-sm">{event.title}</p>
                      <p className="text-xs text-[var(--text-muted)] capitalize">{event.category} · {event.status}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-sm">{formatCurrency(event.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
