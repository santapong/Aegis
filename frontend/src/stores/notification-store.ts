import { create } from "zustand";
import { notificationsAPI } from "@/lib/api";
import { useToastStore } from "@/stores/toast-store";
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

function showError(message: string) {
  try {
    useToastStore.getState().addToast({ type: "error", message });
  } catch {
    // Toast store not ready yet — drop quietly.
  }
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
    } catch (err) {
      // Initial / background sync — keep the bell on its last known state but
      // log to the console so dev tools surface the failure instead of it
      // silently going dark.
      console.warn("notification sync failed", err);
    }
  },
  markRead: async (id) => {
    // Capture the read-state of the target BEFORE we mutate, so we know
    // whether to decrement unreadCount. Doing this outside the set() callback
    // avoids a stale-vs-fresh ordering surprise.
    const target = get().notifications.find((n) => n.id === id);
    const wasUnread = target ? !target.read_at : false;
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n
      ),
      unreadCount: wasUnread ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
    }));
    try {
      await notificationsAPI.markRead(id);
    } catch {
      showError("Couldn't mark notification as read");
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
      showError("Couldn't mark all as read");
      await get().syncFromServer();
    }
  },
  clearAll: async () => {
    set({ notifications: [], unreadCount: 0 });
    try {
      await notificationsAPI.clearAll();
    } catch {
      showError("Couldn't clear notifications");
      await get().syncFromServer();
    }
  },
}));
