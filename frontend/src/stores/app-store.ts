import { create } from "zustand";
import { persist } from "zustand/middleware";
import { preferencesAPI, type PreferencesPayload } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { setActiveCurrency } from "@/lib/utils";

export type CosmicTheme = "meridian" | "pulse" | "observatory" | "constellation" | "supernova";

export const COSMIC_THEMES: ReadonlyArray<CosmicTheme> = [
  "meridian",
  "pulse",
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
  /** Model override for the configured AI provider. null = use the server's
   *  env default, which is what an untouched deploy keeps doing. */
  aiModel: string | null;
}

/** Canonical dashboard widget order — new widgets must be appended here. */
export const DASHBOARD_WIDGET_IDS = [
  "kpi",
  "health",
  "anomalies",
  "spending",
  "trend",
  "insights",
  "cashflow",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

/** Persisted order reconciled with the canonical list: drop unknown ids,
 *  append widgets shipped after the user's copy was persisted. */
function reconcileWidgetOrder(order: string[]): DashboardWidgetId[] {
  const known = order.filter((id): id is DashboardWidgetId =>
    (DASHBOARD_WIDGET_IDS as readonly string[]).includes(id)
  );
  const missing = DASHBOARD_WIDGET_IDS.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

interface AppState {
  sidebarOpen: boolean;
  collapsedClusters: string[];
  dashboardOrder: DashboardWidgetId[];
  dashboardHidden: string[];
  theme: CosmicTheme;
  aiPanelOpen: boolean;
  hasSeenTour: boolean;
  settings: AppSettings;
  settingsHydrated: boolean;
  toggleSidebar: () => void;
  toggleCluster: (label: string) => void;
  moveWidget: (id: DashboardWidgetId, dir: -1 | 1) => void;
  toggleWidget: (id: DashboardWidgetId) => void;
  resetWidgets: () => void;
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
  aiModel: null,
};

function toWire(s: Partial<AppSettings>): Partial<PreferencesPayload> {
  const out: Partial<PreferencesPayload> = {};
  if (s.currency !== undefined) out.currency = s.currency;
  if (s.defaultDateRangeDays !== undefined)
    out.default_date_range_days = s.defaultDateRangeDays;
  if (s.itemsPerPage !== undefined) out.items_per_page = s.itemsPerPage;
  if (s.aiAutoSuggestions !== undefined)
    out.ai_auto_suggestions = s.aiAutoSuggestions;
  // null -> "" so the backend clears the override. Sending JSON null would
  // also work, but "" keeps the <select> value and the wire value identical.
  if (s.aiModel !== undefined) out.ai_model = s.aiModel ?? "";
  return out;
}

function fromWire(p: PreferencesPayload): AppSettings {
  return {
    currency: p.currency,
    defaultDateRangeDays: p.default_date_range_days,
    itemsPerPage: p.items_per_page,
    aiAutoSuggestions: p.ai_auto_suggestions,
    aiModel: p.ai_model ?? null,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      collapsedClusters: ["System"],
      dashboardOrder: [...DASHBOARD_WIDGET_IDS],
      dashboardHidden: [],
      theme: "meridian",
      aiPanelOpen: false,
      hasSeenTour: false,
      settings: { ...defaultSettings },
      settingsHydrated: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleCluster: (label) =>
        set((s) => ({
          collapsedClusters: s.collapsedClusters.includes(label)
            ? s.collapsedClusters.filter((l) => l !== label)
            : [...s.collapsedClusters, label],
        })),
      moveWidget: (id, dir) =>
        set((s) => {
          const order = reconcileWidgetOrder(s.dashboardOrder);
          const i = order.indexOf(id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= order.length) return {};
          [order[i], order[j]] = [order[j], order[i]];
          return { dashboardOrder: order };
        }),
      toggleWidget: (id) =>
        set((s) => ({
          dashboardHidden: s.dashboardHidden.includes(id)
            ? s.dashboardHidden.filter((w) => w !== id)
            : [...s.dashboardHidden, id],
        })),
      resetWidgets: () =>
        set({ dashboardOrder: [...DASHBOARD_WIDGET_IDS], dashboardHidden: [] }),
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
      // Returns a Partial — Zustand merges over the store's default state
      // so untouched keys (actions, settings) keep their initial values.
      migrate: (state, fromVersion): Partial<AppState> => {
        const s = (state ?? {}) as Record<string, unknown>;
        const out: Partial<AppState> = {};
        if (typeof s.sidebarOpen === "boolean") out.sidebarOpen = s.sidebarOpen;
        if (typeof s.hasSeenTour === "boolean") out.hasSeenTour = s.hasSeenTour;
        if (s.settings && typeof s.settings === "object") {
          out.settings = { ...defaultSettings, ...(s.settings as AppSettings) };
        }
        out.theme =
          fromVersion < 2 || !isCosmicTheme(s.theme)
            ? "observatory"
            : s.theme;
        return out;
      },
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        collapsedClusters: state.collapsedClusters,
        dashboardOrder: state.dashboardOrder,
        dashboardHidden: state.dashboardHidden,
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
