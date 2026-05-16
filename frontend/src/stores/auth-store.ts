import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
  setToken: (token: string) => void;
}

const STORAGE_KEY = "aegis-auth";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) =>
        set({ token, user, isAuthenticated: true }),
      logout: () => {
        // Best-effort: ask the backend to clear the httpOnly cookie.
        // Fire-and-forget — the local state is wiped either way so a
        // network failure here can't trap the user in a logged-in UI.
        // Lazy-import to avoid circular dep with lib/api.
        import("@/lib/api")
          .then(({ authAPI }) => authAPI.logout().catch(() => {}))
          .catch(() => {});
        set({ token: null, user: null, isAuthenticated: false });
      },
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Cross-tab sync: a logout (or login) in one tab should propagate to every
// other open tab. Without this, tab B keeps believing it's authenticated
// until its next API call returns 401.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const current = useAuthStore.getState();

    // localStorage cleared entirely or our key removed: log out here too.
    if (!event.newValue) {
      if (current.isAuthenticated) current.logout();
      return;
    }

    try {
      const parsed = JSON.parse(event.newValue) as {
        state?: Partial<AuthState>;
      };
      const next = parsed.state;
      if (!next) return;

      // Remote side logged out — mirror it locally.
      if (!next.isAuthenticated && current.isAuthenticated) {
        current.logout();
        return;
      }

      // Remote side logged in as a different user — mirror the new token.
      if (
        next.isAuthenticated &&
        next.token &&
        next.user &&
        next.token !== current.token
      ) {
        current.login(next.token, next.user as AuthUser);
      }
    } catch {
      // Malformed payload — ignore.
    }
  });
}
