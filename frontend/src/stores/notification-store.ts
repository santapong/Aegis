import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Notification } from "@/types";

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "read" | "created_at">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      addNotification: (notification) =>
        set((s) => ({
          notifications: [
            {
              ...notification,
              id: crypto.randomUUID(),
              read: false,
              created_at: new Date().toISOString(),
            },
            ...s.notifications.slice(0, 49),
          ],
        })),
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),
      clearAll: () => set({ notifications: [] }),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    { name: "aegis-notifications" }
  )
);
