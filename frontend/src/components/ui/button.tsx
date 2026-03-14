"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary:
    "bg-[var(--primary)] text-white hover:opacity-90 shadow-sm",
  secondary:
    "bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)]",
  danger:
    "bg-red-500 text-white hover:bg-red-600 shadow-sm",
  ghost:
    "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text)]",
};

const sizeStyles = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, icon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
