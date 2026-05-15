"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ganttAPI, plansAPI } from "@/lib/api";
import {
  format,
  differenceInDays,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { ChevronLeft, ChevronRight, GanttChart } from "lucide-react";
import { cn, getPriorityColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
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

interface EditForm {
  title: string;
  start: string;
  end: string;
  progress: string;
  color: string;
}

const buildEditForm = (task: GanttTask): EditForm => ({
  title: task.title,
  start: task.start,
  end: task.end,
  progress: String(task.progress ?? 0),
  color: task.color || "#3B82F6",
});

export default function GanttPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const { data: tasks = [] } = useQuery<GanttTask[]>({
    queryKey: ["gantt-tasks"],
    queryFn: () => ganttAPI.tasks() as Promise<GanttTask[]>,
  });

  const ganttQueryKey = useMemo(() => ["gantt-tasks"], []);

  const openEditor = (task: GanttTask) => {
    setEditingTask(task);
    setEditForm(buildEditForm(task));
    setEditErrors({});
  };

  const closeEditor = () => {
    setEditingTask(null);
    setEditForm(null);
    setEditErrors({});
  };

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      original,
      updates,
    }: {
      id: string;
      original: GanttTask;
      updates: { title: string; start: string; end: string; progress: number; color: string };
    }) => {
      const ganttPayload: { start?: string; end?: string; progress?: number } = {};
      if (updates.start !== original.start) ganttPayload.start = updates.start;
      if (updates.end !== original.end) ganttPayload.end = updates.end;
      if (updates.progress !== original.progress) ganttPayload.progress = updates.progress;

      const plansPayload: Record<string, unknown> = {};
      if (updates.title !== original.title) plansPayload.title = updates.title;
      if (updates.color !== original.color) plansPayload.color = updates.color;

      const promises: Promise<unknown>[] = [];
      if (Object.keys(ganttPayload).length > 0) {
        promises.push(ganttAPI.update(id, ganttPayload));
      }
      if (Object.keys(plansPayload).length > 0) {
        promises.push(plansAPI.update(id, plansPayload));
      }
      await Promise.all(promises);
      return { id, updates };
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ganttQueryKey });
      const previous = queryClient.getQueryData<GanttTask[]>(ganttQueryKey);
      queryClient.setQueryData<GanttTask[]>(ganttQueryKey, (old = []) =>
        old.map((t) =>
          t.id === id
            ? {
                ...t,
                title: updates.title,
                start: updates.start,
                end: updates.end,
                progress: updates.progress,
                color: updates.color,
              }
            : t
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ganttQueryKey, context.previous);
      }
      toast.error("Failed to update task");
    },
    onSuccess: () => {
      toast.success("Task updated");
      closeEditor();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ganttQueryKey });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editForm) return;
    const errs: Record<string, string> = {};
    if (!editForm.title.trim()) errs.title = "Title is required";
    if (!editForm.start) errs.start = "Start date is required";
    if (!editForm.end) errs.end = "End date is required";
    if (editForm.start && editForm.end && editForm.end < editForm.start) {
      errs.end = "End must be on or after start";
    }
    const progressNum = parseInt(editForm.progress, 10);
    if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
      errs.progress = "Progress must be 0-100";
    }
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;

    updateMutation.mutate({
      id: editingTask.id,
      original: editingTask,
      updates: {
        title: editForm.title.trim(),
        start: editForm.start,
        end: editForm.end,
        progress: progressNum,
        color: editForm.color,
      },
    });
  };

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
                className="p-2 rounded-lg hover:bg-muted border border-border"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium px-3">{format(currentDate, "MMMM yyyy")}</span>
              <button
                onClick={() => setCurrentDate((d) => addDays(d, 30))}
                className="p-2 rounded-lg hover:bg-muted border border-border"
              >
                <ChevronRight size={18} />
              </button>
              <div className="ml-2 flex items-center gap-1 border border-border rounded-lg p-0.5">
                {(["day", "week", "month"] as ZoomLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setZoom(level)}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                      zoom === level
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-muted"
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
            <div className="w-[250px] flex-shrink-0 border-r border-border">
              <div className="h-12 px-4 flex items-center border-b border-border bg-muted">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Task</span>
              </div>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="h-12 px-4 flex items-center border-b border-border hover:bg-muted transition-colors"
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
              <div className="h-12 flex border-b border-border bg-muted">
                {timelineDays.map((day, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 flex items-center justify-center border-r border-border text-xs text-muted-foreground"
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
                      className="h-12 relative border-b border-border"
                      onMouseEnter={() => setHoveredTask(task.id)}
                      onMouseLeave={() => setHoveredTask(null)}
                    >
                      <div className="absolute inset-0 flex">
                        {timelineDays.map((_, i) => (
                          <div
                            key={i}
                            className="flex-shrink-0 border-r border-border/30"
                            style={{ width: dayWidth }}
                          />
                        ))}
                      </div>
                      <motion.div
                        role="button"
                        tabIndex={0}
                        onClick={() => openEditor(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openEditor(task);
                          }
                        }}
                        className={cn(
                          "absolute top-2 h-8 rounded-md flex items-center px-2 text-white text-xs font-medium shadow-sm cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary",
                          statusColors[task.status]
                        )}
                        style={{ left: pos.left, width: Math.max(pos.width, dayWidth) }}
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: Math.max(pos.width, dayWidth), opacity: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        title={`${task.title} (${task.progress}%) — click to edit`}
                      >
                        <div
                          className="absolute inset-0 bg-black/20 rounded-md"
                          style={{ width: `${100 - task.progress}%`, right: 0, left: "auto" }}
                        />
                        <span className="relative z-10 truncate">{task.title}</span>
                      </motion.div>

                      {/* Hover tooltip */}
                      {isHovered && (
                        <div className="absolute left-1/2 top-12 -translate-x-1/2 z-30 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
                          <p className="font-medium text-sm mb-1">{task.title}</p>
                          <div className="space-y-1 text-xs text-muted-foreground">
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
            <Card
              key={task.id}
              className="cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => openEditor(task)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getPriorityColor(task.priority) }} />
                    <h3 className="text-sm font-medium">{task.title}</h3>
                  </div>
                  <Badge variant={statusBadgeVariant[task.status]}>{task.status.replace("_", " ")}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{task.start} - {task.end}</span>
                  <span>{task.progress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <motion.div
                    className={cn("h-2 rounded-full", statusColors[task.status])}
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </motion.div>

      {/* Legend */}
      <motion.div variants={staggerItem} className="flex items-center gap-6 text-xs text-muted-foreground">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={cn("w-3 h-3 rounded", color)} />
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>
        ))}
      </motion.div>

      <Modal
        open={editingTask !== null && editForm !== null}
        onClose={closeEditor}
        title="Edit task"
        size="md"
      >
        {editForm && (
          <form onSubmit={handleEditSubmit}>
            <ModalBody className="space-y-4">
              <Input
                label="Title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                error={editErrors.title}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start date"
                  type="date"
                  value={editForm.start}
                  onChange={(e) => setEditForm({ ...editForm, start: e.target.value })}
                  error={editErrors.start}
                />
                <Input
                  label="End date"
                  type="date"
                  value={editForm.end}
                  onChange={(e) => setEditForm({ ...editForm, end: e.target.value })}
                  error={editErrors.end}
                />
              </div>
              <Input
                label="Progress (%)"
                type="number"
                min="0"
                max="100"
                value={editForm.progress}
                onChange={(e) => setEditForm({ ...editForm, progress: e.target.value })}
                error={editErrors.progress}
              />
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium" htmlFor="task-color">
                  Color
                </label>
                <input
                  id="task-color"
                  type="color"
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  className="w-10 h-8 rounded border border-border cursor-pointer"
                />
                <span className="text-xs text-muted-foreground font-mono">{editForm.color}</span>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" type="button" onClick={closeEditor}>
                Cancel
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                Save changes
              </Button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </motion.div>
  );
}
