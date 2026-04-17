"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useAppStore } from "@/stores/app-store";
import { authAPI } from "@/lib/api";

const STEPS = [
  {
    element: "[data-tour-id=sidebar-dashboard]",
    popover: {
      title: "Your dashboard",
      description:
        "KPIs, cash-flow forecast, and AI-generated insights land here. Press <kbd>g d</kbd> to jump back anytime.",
    },
  },
  {
    element: "[data-tour-id=sidebar-transactions]",
    popover: {
      title: "Log a transaction",
      description:
        "Track income and expenses, tag them, import from CSV, and schedule recurring items. Press <kbd>N</kbd> to start a new one.",
    },
  },
  {
    element: "[data-tour-id=sidebar-budgets]",
    popover: {
      title: "Stay on budget",
      description:
        "Set monthly caps by category. Aegis notifies you when you're close to or over.",
    },
  },
  {
    element: "[data-tour-id=ai-advisor]",
    popover: {
      title: "Ask the AI advisor",
      description:
        "Spending analysis, forecasts, and weekly summaries in plain English. Open it from the sidebar anytime.",
    },
  },
  {
    popover: {
      title: "You're ready",
      description:
        "Press <kbd>?</kbd> for the full shortcut cheatsheet and <kbd>/</kbd> to open the command palette.",
    },
  },
];

/**
 * Shows the first-run tour once per user. Persisted server-side via
 * `users.onboarded_at`; a local fallback flag covers dev and offline.
 */
export function OnboardingTour() {
  const user = useAuthStore((s) => s.user);
  const hasSeenTour = useAppStore((s) => s.hasSeenTour);
  const setHasSeenTour = useAppStore((s) => s.setHasSeenTour);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!user) return;

    // Server-side flag takes priority; fall back to local.
    // AuthUser may not include onboarded_at if the client was refreshed pre-v0.8.
    const onboardedAt = (user as unknown as { onboarded_at?: string | null }).onboarded_at;
    if (onboardedAt) return;
    if (hasSeenTour) return;

    started.current = true;
    let cancelled = false;

    (async () => {
      const mod = await import("driver.js");
      await import("driver.js/dist/driver.css");
      if (cancelled) return;

      const driverObj = mod.driver({
        showProgress: true,
        allowClose: true,
        steps: STEPS,
        onDestroyed: () => {
          setHasSeenTour(true);
          authAPI.markOnboarded().catch(() => {
            // Backend not reachable is non-fatal — local flag still suppresses re-runs.
          });
        },
      });
      driverObj.drive();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, hasSeenTour, setHasSeenTour]);

  return null;
}
