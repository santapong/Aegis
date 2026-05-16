import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Active currency code consulted by `formatCurrency` when no override is
// passed. Kept as a module-level value so the util can stay
// hook-free; the app store is responsible for keeping it in sync via
// `setActiveCurrency` whenever the user's preferences change.
let activeCurrency = "USD";

export function setActiveCurrency(code: string): void {
  if (code) activeCurrency = code;
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

export function formatCurrency(amount: number, currency?: string): string {
  const code = currency || activeCurrency;
  // Intl rejects unknown codes — fall back to USD so a mistyped pref never
  // crashes the page.
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}

export function getPriorityColor(priority: string): string {
  // Returns CSS custom property references so the color resolves against
  // the active cosmic theme (Observatory cyan / Constellation gold /
  // Supernova amber). Used in inline `style` and recharts `fill` props;
  // both contexts resolve CSS vars correctly through SVG inheritance.
  switch (priority) {
    case "critical":
      return "var(--bad)";
    case "high":
      return "var(--warn)";
    case "medium":
      return "var(--accent)";
    case "low":
      return "var(--dim)";
    default:
      return "var(--dim)";
  }
}
