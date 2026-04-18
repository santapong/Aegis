import { create } from "zustand";
import { notificationsAPI } from "@/lib/api";
import type { Notification } from "@/types";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  lastSyncedAt: number | null;
  syncFromServer: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  lastSyncedAt: null,
  syncFromServer: async () => {
    try {
      const res = await notificationsAPI.list(false, 50);
      set({
        notifications: res.items,
        unreadCount: res.unread_count,
        lastSyncedAt: Date.now(),
      });
    } catch {
      // Swallow — the bell just stays at the last known state.
    }
  },
  markRead: async (id) => {
    // Optimistic update
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - (get().notifications.find((n) => n.id === id)?.read_at ? 0 : 1)),
    }));
    try {
      await notificationsAPI.markRead(id);
    } catch {
      await get().syncFromServer();
    }
  },
  markAllRead: async () => {
    const now = new Date().toISOString();
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read_at: n.read_at ?? now })),
      unreadCount: 0,
    }));
    try {
      await notificationsAPI.markAllRead();
    } catch {
      await get().syncFromServer();
    }
  },
  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });
    try {
      await notificationsAPI.clearAll();
    } catch {
      await get().syncFromServer();
    }
  },
}));
