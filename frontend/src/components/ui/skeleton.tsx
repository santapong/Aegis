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
        "animate-pulse bg-[var(--bg-secondary)]",
        variant === "circle" && "rounded-full",
        variant === "text" && "rounded h-4",
        variant === "rect" && "rounded-lg",
        className
      )}
      style={{ width, height }}
    />
  );
}
