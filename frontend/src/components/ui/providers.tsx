"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useAppStore, COSMIC_THEMES, type CosmicTheme } from "@/stores/app-store";
import { ToastContainer } from "./toast";
import { TooltipProvider } from "./tooltip";
import { GlobalShortcuts } from "@/components/global-shortcuts";
import { OnboardingTour } from "@/components/onboarding-tour";

/**
 * ThemeSync — writes the current cosmic theme as a `.theme-{name}` class on
 * <body>. Removes any previously-applied cosmic theme classes first to avoid
 * stacking when the user switches.
 */
function ThemeSync() {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const body = document.body;
    COSMIC_THEMES.forEach((t: CosmicTheme) => {
      body.classList.remove(`theme-${t}`);
    });
    // Also strip legacy `.dark` from <html> in case it's persisted from v1.
    document.documentElement.classList.remove("dark");
    body.classList.add(`theme-${theme}`);
  }, [theme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ThemeSync />
        <GlobalShortcuts />
        <OnboardingTour />
        {children}
        <ToastContainer />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
