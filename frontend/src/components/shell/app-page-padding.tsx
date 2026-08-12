"use client";

import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

/**
 * OPEN_APP_PAGES render inside the authenticated app shell (which already
 * pads its content) for signed-in users, but bare for signed-out visitors
 * (see AuthGate). This applies the page padding only in the latter case.
 */
export function AppPagePadding({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <div className={cn(!isAuthenticated && "p-4 md:p-6 lg:p-8")}>{children}</div>;
}
