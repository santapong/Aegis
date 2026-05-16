import { create } from "zustand";
import { persist } from "zustand/middleware";
import { preferencesAPI, type PreferencesPayload } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { setActiveCurrency } from "@/lib/utils";

export type CosmicTheme = "observatory" | "constellation" | "supernova";

export const COSMIC_THEMES: ReadonlyArray<CosmicTheme> = [
  "observatory",
  "constellation",
  "supernova",
];

function isCosmicTheme(v: unknown): v is CosmicTheme {
  return typeof v === "string" && (COSMIC_THEMES as readonly string[]).includes(v);
}

interface AppSettings {
  currency: string;
  defaultDateRangeDays: number;
  itemsPerPage: number;
  aiAutoSuggestions: boolean;
}

interface AppState {
  sidebarOpen: boolean;
  theme: CosmicTheme;
  aiPanelOpen: boolean;
  hasSeenTour: boolean;
  settings: AppSettings;
  settingsHydrated: boolean;
  toggleSidebar: () => void;
  setTheme: (theme: CosmicTheme) => void;
  toggleAIPanel: () => void;
  setHasSeenTour: (seen: boolean) => void;
  restartTour: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
  hydrateSettingsFromServer: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  currency: "USD",
  defaultDateRangeDays: 30,
  itemsPerPage: 25,
  aiAutoSuggestions: true,
};

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
    (set) => ({
      sidebarOpen: true,
      theme: "observatory",
      aiPanelOpen: false,
      hasSeenTour: false,
      settings: { ...defaultSettings },
      settingsHydrated: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => {
        if (!isCosmicTheme(theme)) return;
        set({ theme });
      },
      toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
      setHasSeenTour: (seen) => set({ hasSeenTour: seen }),
      restartTour: () => set({ hasSeenTour: false }),
      updateSettings: (partial) => {
        set((s) => ({ settings: { ...s.settings, ...partial } }));
        if (partial.currency) setActiveCurrency(partial.currency);
        void preferencesAPI.update(toWire(partial)).catch(() => {});
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
          // offline / unauth — keep persisted copy
        }
      },
    }),
    {
      name: "aegis-app-store",
      version: 2,
      // Migrate v1 (theme: "light" | "dark") → v2 (cosmic themes).
      migrate: (state, fromVersion) => {
        const s = (state ?? {}) as Partial<AppState> & { theme?: unknown };
        if (fromVersion < 2 || !isCosmicTheme(s.theme)) {
          s.theme = "observatory";
        }
        return s as AppState;
      },
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        settings: state.settings,
        hasSeenTour: state.hasSeenTour,
      }),
    }
  )
);

if (typeof window !== "undefined") {
  setActiveCurrency(useAppStore.getState().settings.currency);

  if (useAuthStore.getState().isAuthenticated) {
    void useAppStore.getState().hydrateSettingsFromServer();
  }

  let wasAuthed = useAuthStore.getState().isAuthenticated;
  useAuthStore.subscribe((state) => {
    if (state.isAuthenticated && !wasAuthed) {
      void useAppStore.getState().hydrateSettingsFromServer();
    }
    if (!state.isAuthenticated && wasAuthed) {
      useAppStore.setState({ settingsHydrated: false });
    }
    wasAuthed = state.isAuthenticated;
  });
}
