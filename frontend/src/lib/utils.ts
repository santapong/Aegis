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
  switch (priority) {
    case "critical":
      return "#EF4444";
    case "high":
      return "#F59E0B";
    case "medium":
      return "#3B82F6";
    case "low":
      return "#6B7280";
    default:
      return "#6B7280";
  }
}
