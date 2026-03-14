"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ganttAPI } from "@/lib/api";
import {
  format,
  differenceInDays,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, GanttChart } from "lucide-react";
import { cn, getPriorityColor, formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { staggerContainer, staggerItem } from "@/lib/animations";
import type { GanttTask } from "@/types";

type ZoomLevel = "day" | "week" | "month";

const statusColors: Record<string, string> = {
  planned: "bg-gray-400",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  cancelled: "bg-red-400",
};

const statusBadgeVariant: Record<string, "neutral" | "info" | "success" | "danger"> = {
  planned: "neutral",
  in_progress: "info",
  completed: "success",
  cancelled: "danger",
};

export default function GanttPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  const { data: tasks = [] } = useQuery<GanttTask[]>({
    queryKey: ["gantt-tasks"],
    queryFn: () => ganttAPI.tasks() as Promise<GanttTask[]>,
  });

  const timelineStart = startOfMonth(currentDate);
  const timelineEnd = endOfMonth(currentDate);

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
    return { left: startOffset * dayWidth, width: duration * dayWidth };
  };

  return (
    <motion.div
      className="max-w-full mx-auto space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={staggerItem}>
        <PageHeader
          title="Gantt Chart"
          subtitle="Visualize your financial plans timeline"
          action={
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
              <div className="ml-2 flex items-center gap-1 border border-[var(--border)] rounded-lg p-0.5">
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
          }
        />
      </motion.div>

      {/* Desktop Gantt */}
      <motion.div variants={staggerItem} className="hidden md:block">
        <Card className="overflow-hidden">
          <div className="flex">
            {/* Task labels */}
            <div className="w-[250px] flex-shrink-0 border-r border-[var(--border)]">
              <div className="h-12 px-4 flex items-center border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase">Task</span>
              </div>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="h-12 px-4 flex items-center border-b border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors"
                  onMouseEnter={() => setHoveredTask(task.id)}
                  onMouseLeave={() => setHoveredTask(null)}
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

              <div className="relative">
                {tasks.map((task) => {
                  const pos = getTaskPosition(task);
                  const isHovered = hoveredTask === task.id;
                  return (
                    <div
                      key={task.id}
                      className="h-12 relative border-b border-[var(--border)]"
                      onMouseEnter={() => setHoveredTask(task.id)}
                      onMouseLeave={() => setHoveredTask(null)}
                    >
                      <div className="absolute inset-0 flex">
                        {timelineDays.map((_, i) => (
                          <div
                            key={i}
                            className="flex-shrink-0 border-r border-[var(--border)]/30"
                            style={{ width: dayWidth }}
                          />
                        ))}
                      </div>
                      <motion.div
                        className={cn(
                          "absolute top-2 h-8 rounded-md flex items-center px-2 text-white text-xs font-medium shadow-sm cursor-pointer transition-opacity",
                          statusColors[task.status]
                        )}
                        style={{ left: pos.left, width: Math.max(pos.width, dayWidth) }}
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: Math.max(pos.width, dayWidth), opacity: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        title={`${task.title} (${task.progress}%)`}
                      >
                        <div
                          className="absolute inset-0 bg-black/20 rounded-md"
                          style={{ width: `${100 - task.progress}%`, right: 0, left: "auto" }}
                        />
                        <span className="relative z-10 truncate">{task.title}</span>
                      </motion.div>

                      {/* Hover tooltip */}
                      {isHovered && (
                        <div className="absolute left-1/2 top-12 -translate-x-1/2 z-30 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg p-3 min-w-[200px]">
                          <p className="font-medium text-sm mb-1">{task.title}</p>
                          <div className="space-y-1 text-xs text-[var(--text-muted)]">
                            <p>Start: {task.start}</p>
                            <p>End: {task.end}</p>
                            <p>Progress: {task.progress}%</p>
                            <div className="flex gap-1 mt-1">
                              <Badge variant={statusBadgeVariant[task.status]}>{task.status.replace("_", " ")}</Badge>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {tasks.length === 0 && (
                  <EmptyState icon={GanttChart} title="No tasks found" description="Create plans with start and end dates." className="h-40" />
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Mobile — Simple list */}
      <motion.div variants={staggerItem} className="md:hidden space-y-3">
        {tasks.length === 0 ? (
          <EmptyState icon={GanttChart} title="No tasks found" description="Create plans with start and end dates." />
        ) : (
          tasks.map((task) => (
            <Card key={task.id}>
              <CardBody>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getPriorityColor(task.priority) }} />
                    <h3 className="text-sm font-medium">{task.title}</h3>
                  </div>
                  <Badge variant={statusBadgeVariant[task.status]}>{task.status.replace("_", " ")}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-2">
                  <span>{task.start} - {task.end}</span>
                  <span>{task.progress}%</span>
                </div>
                <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2">
                  <motion.div
                    className={cn("h-2 rounded-full", statusColors[task.status])}
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </motion.div>

      {/* Legend */}
      <motion.div variants={staggerItem} className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded", color)} />
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}
