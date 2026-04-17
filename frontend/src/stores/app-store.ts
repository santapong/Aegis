import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  toggleSidebar: () => void;
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleAIPanel: () => void;
  setHasSeenTour: (seen: boolean) => void;
  restartTour: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const defaultSettings: AppSettings = {
  currency: "USD",
  defaultDateRangeDays: 30,
  itemsPerPage: 25,
  aiAutoSuggestions: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: "light",
      aiPanelOpen: false,
      hasSeenTour: false,
      settings: { ...defaultSettings },
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
      setTheme: (theme) => set({ theme }),
      toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
      setHasSeenTour: (seen) => set({ hasSeenTour: seen }),
      restartTour: () => set({ hasSeenTour: false }),
      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),
      resetSettings: () => set({ settings: { ...defaultSettings } }),
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
