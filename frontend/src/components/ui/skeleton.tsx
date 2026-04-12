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
