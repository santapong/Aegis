"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Shared empty-state surface. Pass ``illustration`` for a custom slot
 * (kept line-art only, never a brand PNG), or ``icon`` for the default
 * muted-circle glyph.
 */
export function EmptyState({ icon: Icon, illustration, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      {illustration ? (
        <div className="mb-4 text-muted-foreground">{illustration}</div>
      ) : Icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Icon size={24} className="text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
