"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "rect" | "circle";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = "rect", width, height }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-muted",
        "bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]",
        "bg-gradient-to-r from-muted via-muted-foreground/5 to-muted",
        variant === "circle" && "rounded-full",
        variant === "text" && "rounded h-4",
        variant === "rect" && "rounded-lg",
        className
      )}
      style={{ width, height }}
    />
  );
}

/** Stack of equal-height rows, e.g. for list loading states. */
export function SkeletonRows({ count = 5, height = 12, className }: { count?: number; height?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`h-${height} w-full`} />
      ))}
    </div>
  );
}

/** Card-shaped skeleton for KPI tiles and summary blocks. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 rounded-xl bg-card border border-border", className)}>
      <Skeleton className="h-4 w-20 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}
