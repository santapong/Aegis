"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "@/components/ui/sidebar";
import { StatusBar } from "@/components/ui/status-bar";
import { safeAuthReturn } from "@/lib/auth-return";

const AUTH_PAGES = ["/login", "/register"];
const PUBLIC_PAGES = ["/welcome", "/landing", "/docs", "/demo", "/brand"];
// Changelog content that a signed-out visitor should be able to
// read without a redirect to /login, but that still belongs inside the app
// shell (Sidebar/StatusBar) for a signed-in user — unlike PUBLIC_PAGES,
// which are marketing pages that never get the shell.
const OPEN_APP_PAGES = ["/changelog"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthPage = matchesPrefix(pathname, AUTH_PAGES);
  const isPublicPage = matchesPrefix(pathname, PUBLIC_PAGES);
  const isOpenAppPage = matchesPrefix(pathname, OPEN_APP_PAGES);

  // Side-effects (navigation) live in an effect so we never call
  // router.push() during render — that would trigger React's
  // "Cannot update a component while rendering" warning in React 19
  // strict mode and risks double-navigation.
  useEffect(() => {
    if (!mounted) return;
    if (isPublicPage || isOpenAppPage) return;
    if (isAuthPage && isAuthenticated) {
      router.replace(safeAuthReturn(new URLSearchParams(window.location.search).get("next")));
      return;
    }
    if (!isAuthPage && !isAuthenticated) {
      // A signed-out visitor hitting the app root gets the marketing
      // landing page; deep links to specific app pages go to sign-in.
      const returnPath = safeAuthReturn(pathname + window.location.search);
      router.replace(pathname === "/" ? "/landing" : `/login?next=${encodeURIComponent(returnPath)}`);
    }
  }, [mounted, isAuthPage, isPublicPage, isOpenAppPage, isAuthenticated, pathname, router]);

  // Public marketing and documentation content must be present in the server-rendered HTML,
  // including when JavaScript is unavailable. It does not depend on auth state.
  // Sign-in renders its public shell before hydration. Its form stays disabled
  // until ready, with a noscript explanation instead of a blank page.
  if (isPublicPage || (isAuthPage && !mounted)) {
    return <>{children}</>;
  }

  if (!mounted) {
    return null;
  }

  if (isAuthPage) {
    if (isAuthenticated) return null;
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    if (isOpenAppPage) return <>{children}</>;
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <main
          className="flex-1 overflow-y-auto pt-16 lg:pt-0"
          style={{ background: "transparent" }}
        >
          <div
            className="p-4 md:p-6 lg:p-8"
            style={{ paddingBottom: "calc(var(--statusbar-h) + 32px)" }}
          >
            {children}
          </div>
        </main>
        {!["/cashflow", "/accounts", "/review"].includes(pathname) && <StatusBar />}
      </div>
    </div>
  );
}
