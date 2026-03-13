"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ganttAPI } from "@/lib/api";
import {
  format,
  differenceInDays,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { cn, getPriorityColor } from "@/lib/utils";
import type { GanttTask } from "@/types";

type ZoomLevel = "day" | "week" | "month";

export default function GanttPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoom, setZoom] = useState<ZoomLevel>("week");

  const { data: tasks = [] } = useQuery({
    queryKey: ["gantt-tasks"],
    queryFn: () => ganttAPI.tasks(),
  });

  // Calculate timeline range
  const timelineStart = startOfMonth(currentDate);
  const timelineEnd = endOfMonth(currentDate);
  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;

  const timelineDays = useMemo(
    () => eachDayOfInterval({ start: timelineStart, end: timelineEnd }),
    [timelineStart, timelineEnd]
  );

  const dayWidth = zoom === "day" ? 60 : zoom === "week" ? 30 : 12;

  const getTaskPosition = (task: GanttTask) => {
    const start = new Date(task.start);
    const end = new Date(task.end);
    const startOffset = Math.max(0, differenceInDays(start, timelineStart));
    const duration = Math.max(1, differenceInDays(end, start) + 1);
    return {
      left: startOffset * dayWidth,
      width: duration * dayWidth,
    };
  };

  const statusColors: Record<string, string> = {
    planned: "bg-gray-400",
    in_progress: "bg-blue-500",
    completed: "bg-green-500",
    cancelled: "bg-red-400",
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gantt Chart</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Visualize your financial plans timeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate((d) => addDays(d, -30))}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] border border-[var(--border)]"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium px-3">{format(currentDate, "MMMM yyyy")}</span>
          <button
            onClick={() => setCurrentDate((d) => addDays(d, 30))}
            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] border border-[var(--border)]"
          >
            <ChevronRight size={18} />
          </button>
          <div className="ml-4 flex items-center gap-1 border border-[var(--border)] rounded-lg p-0.5">
            {(["day", "week", "month"] as ZoomLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setZoom(level)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                  zoom === level
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]"
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Gantt */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="flex">
          {/* Task labels */}
          <div className="w-[250px] flex-shrink-0 border-r border-[var(--border)]">
            <div className="h-12 px-4 flex items-center border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Task</span>
            </div>
            {tasks.map((task) => (
              <div
                key={task.id}
                className="h-12 px-4 flex items-center border-b border-[var(--border)] hover:bg-[var(--bg-secondary)]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  />
                  <span className="text-sm truncate">{task.title}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-x-auto">
            {/* Date headers */}
            <div className="h-12 flex border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              {timelineDays.map((day, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 flex items-center justify-center border-r border-[var(--border)] text-xs text-[var(--text-muted)]"
                  style={{ width: dayWidth }}
                >
                  {zoom === "day"
                    ? format(day, "d MMM")
                    : zoom === "week"
                    ? format(day, "d")
                    : i % 7 === 0
                    ? format(day, "d")
                    : ""}
                </div>
              ))}
            </div>

            {/* Task bars */}
            <div className="relative">
              {tasks.map((task, rowIndex) => {
                const pos = getTaskPosition(task);
                return (
                  <div key={task.id} className="h-12 relative border-b border-[var(--border)]">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timelineDays.map((_, i) => (
                        <div
                          key={i}
                          className="flex-shrink-0 border-r border-[var(--border)]/30"
                          style={{ width: dayWidth }}
                        />
                      ))}
                    </div>
                    {/* Task bar */}
                    <div
                      className={cn(
                        "absolute top-2 h-8 rounded-md flex items-center px-2 text-white text-xs font-medium shadow-sm cursor-pointer hover:opacity-90 transition-opacity",
                        statusColors[task.status]
                      )}
                      style={{
                        left: pos.left,
                        width: Math.max(pos.width, dayWidth),
                      }}
                      title={`${task.title} (${task.progress}%)`}
                    >
                      {/* Progress overlay */}
                      <div
                        className="absolute inset-0 bg-black/20 rounded-md"
                        style={{ width: `${100 - task.progress}%`, right: 0, left: "auto" }}
                      />
                      <span className="relative z-10 truncate">{task.title}</span>
                    </div>
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <div className="h-40 flex items-center justify-center text-[var(--text-muted)] text-sm">
                  No tasks with date ranges found. Create plans with start and end dates.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded", color)} />
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
