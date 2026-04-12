"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset transition-colors",
  {
    variants: {
      variant: {
        success: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400 dark:ring-emerald-400/20",
        warning: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400 dark:ring-amber-400/20",
        danger: "bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400 dark:ring-red-400/20",
        info: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-400 dark:ring-indigo-400/20",
        neutral: "bg-muted text-muted-foreground ring-border",
        default: "bg-primary/10 text-primary ring-primary/20",
        outline: "text-foreground ring-border",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
