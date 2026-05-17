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
  /**
   * Legacy field. The JWT now lives in an httpOnly cookie set by
   * `/api/auth/login` and `/api/auth/google`; JavaScript cannot read
   * it (which is the security win — XSS can't exfiltrate the session).
   *
   * Kept in the in-memory shape for two reasons:
   * 1. Backward-compat for users with a pre-cookie session that
   *    still has a token in localStorage. `lib/api.ts` reads this
   *    and sends it as a Bearer header so they don't get force-logged-out
   *    on first page load after the upgrade.
   * 2. Native API clients (CLI / scripts) can still set a token
   *    explicitly via `setToken()` when the cookie isn't an option.
   *
   * **Never call `setToken()` from a browser sign-in flow.** Doing so
   * re-introduces the localStorage XSS exfiltration risk that the
   * cookie auth was meant to close.
   */
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (user: AuthUser) => void;
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
      login: (user) =>
        // No token argument — the cookie carries auth now. `token` stays
        // at whatever it was (null for new sessions, legacy value for
        // upgraded ones) and gets used only as a Bearer fallback.
        set({ user, isAuthenticated: true }),
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
      // `token` is deliberately NOT persisted. Any value already in
      // localStorage from a pre-cookie deploy will be loaded once on
      // first mount (Zustand persist hydration) and then stay only in
      // memory — never written back. Subsequent logouts/logins fully
      // wipe it.
      partialize: (state) => ({
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

      // Remote side logged in (possibly as a different user) — mirror
      // the user object. The cookie is shared across tabs at the
      // browser level so we don't need to copy it.
      if (
        next.isAuthenticated &&
        next.user &&
        next.user.id !== current.user?.id
      ) {
        current.login(next.user as AuthUser);
      }
    } catch {
      // Malformed payload — ignore.
    }
  });
}
