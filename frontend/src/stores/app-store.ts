import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  theme: "light" | "dark";
  aiPanelOpen: boolean;
  toggleSidebar: () => void;
  toggleTheme: () => void;
  toggleAIPanel: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  theme: "light",
  aiPanelOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
}));
