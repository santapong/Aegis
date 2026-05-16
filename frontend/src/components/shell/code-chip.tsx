import { cn } from "@/lib/utils";

interface CodeChipProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * CodeChip — bordered uppercase mono badge in accent. Goes at the top of
 * every card (DSH / HLT / ALT / SPD / TRD / INS / BDG / SAV / INV / ...).
 */
export function CodeChip({ children, className }: CodeChipProps) {
  return <span className={cn("code", className)}>{children}</span>;
}
