import { create } from "zustand";
import { persist } from "zustand/middleware";
import { preferencesAPI, type PreferencesPayload } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { setActiveCurrency } from "@/lib/utils";

interface AppSettings {
  currency: string;
  defaultDateRangeDays: number;
  itemsPerPage: number;
  aiAutoSuggestions: boolean;
}

interface AppState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  aiPanelOpen: boolean;
  hasSeenTour: boolean;
  settings: AppSettings;
  /**
   * True once we've successfully reconciled the local cache with the
   * server. Pages don't need to wait on this — the local copy is still
   * authoritative for synchronous reads — but it's exposed so callers
   * (e.g. an effect that wants to avoid double-pushing the seeded value)
   * can check it.
   */
  settingsHydrated: boolean;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleAIPanel: () => void;
  setHasSeenTour: (seen: boolean) => void;
  restartTour: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  /**
   * Pulls preferences from the server and replaces the local cache. Safe
   * to call repeatedly — runs as a fire-and-forget effect on app boot.
   * Silently no-ops on auth/network failure so an offline user keeps the
   * persisted local copy.
   */
  hydrateSettingsFromServer: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  currency: "USD",
  defaultDateRangeDays: 30,
  itemsPerPage: 25,
  aiAutoSuggestions: true,
};

// Map between the snake_case wire format and the store's camelCase shape.
// Kept inline (not in /types) because no other module needs to reason
// about preferences.
function toWire(s: Partial<AppSettings>): Partial<PreferencesPayload> {
  const out: Partial<PreferencesPayload> = {};
  if (s.currency !== undefined) out.currency = s.currency;
  if (s.defaultDateRangeDays !== undefined)
    out.default_date_range_days = s.defaultDateRangeDays;
  if (s.itemsPerPage !== undefined) out.items_per_page = s.itemsPerPage;
  if (s.aiAutoSuggestions !== undefined)
    out.ai_auto_suggestions = s.aiAutoSuggestions;
  return out;
}

function fromWire(p: PreferencesPayload): AppSettings {
  return {
    currency: p.currency,
    defaultDateRangeDays: p.default_date_range_days,
    itemsPerPage: p.items_per_page,
    aiAutoSuggestions: p.ai_auto_suggestions,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      theme: "light",
      aiPanelOpen: false,
      hasSeenTour: false,
      settings: { ...defaultSettings },
      settingsHydrated: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setTheme: (theme) => set({ theme }),
      toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
      setHasSeenTour: (seen) => set({ hasSeenTour: seen }),
      restartTour: () => set({ hasSeenTour: false }),
      updateSettings: (partial) => {
        // 1. Optimistic local update — UI re-renders synchronously.
        set((s) => ({ settings: { ...s.settings, ...partial } }));
        if (partial.currency) setActiveCurrency(partial.currency);
        // 2. Best-effort background sync. Failure is swallowed; the user's
        //    next successful update or page reload reconciles via
        //    hydrateSettingsFromServer.
        void preferencesAPI.update(toWire(partial)).catch(() => {
          /* offline / 401 — keep optimistic state and try again later */
        });
      },
      resetSettings: () => {
        set({ settings: { ...defaultSettings } });
        setActiveCurrency(defaultSettings.currency);
        void preferencesAPI.update(toWire(defaultSettings)).catch(() => {});
      },
      hydrateSettingsFromServer: async () => {
        try {
          const server = await preferencesAPI.get();
          const settings = fromWire(server);
          set({ settings, settingsHydrated: true });
          setActiveCurrency(settings.currency);
        } catch {
          // Likely unauthenticated or offline — leave the persisted copy
          // in place. The next call after login will retry.
        }
      },
    }),
    {
      name: "aegis-app-store",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        settings: state.settings,
        hasSeenTour: state.hasSeenTour,
      }),
    }
  )
);

// Auto-hydrate from the server whenever the user becomes authenticated.
// Subscribing here (rather than wiring an effect in AuthGate) keeps the
// "settings sync" concern fully inside the store that owns it.
if (typeof window !== "undefined") {
  // Seed the format-currency util from the persisted store so the first paint
  // already uses the user's preferred currency (server hydration happens
  // asynchronously below).
  setActiveCurrency(useAppStore.getState().settings.currency);

  // If we're already authenticated at module-load time (token in localStorage),
  // fire one hydration immediately so the UI shows server values on refresh.
  if (useAuthStore.getState().isAuthenticated) {
    void useAppStore.getState().hydrateSettingsFromServer();
  }

  // And re-hydrate on every login transition (false -> true).
  let wasAuthed = useAuthStore.getState().isAuthenticated;
  useAuthStore.subscribe((state) => {
    if (state.isAuthenticated && !wasAuthed) {
      void useAppStore.getState().hydrateSettingsFromServer();
    }
    if (!state.isAuthenticated && wasAuthed) {
      // On logout, drop the hydrated flag so the next login re-fetches.
      useAppStore.setState({ settingsHydrated: false });
    }
    wasAuthed = state.isAuthenticated;
  });
}
