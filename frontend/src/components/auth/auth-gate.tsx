"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "@/components/ui/sidebar";
import { StatusBar } from "@/components/ui/status-bar";

const AUTH_PAGES = ["/login", "/register"];
const PUBLIC_PAGES = ["/welcome", "/landing"];

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

  // Side-effects (navigation) live in an effect so we never call
  // router.push() during render — that would trigger React's
  // "Cannot update a component while rendering" warning in React 19
  // strict mode and risks double-navigation.
  useEffect(() => {
    if (!mounted) return;
    if (isPublicPage) return;
    if (isAuthPage && isAuthenticated) {
      router.push("/");
      return;
    }
    if (!isAuthPage && !isAuthenticated) {
      router.push("/login");
    }
  }, [mounted, isAuthPage, isPublicPage, isAuthenticated, router]);

  if (!mounted) {
    return null;
  }

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (isAuthPage) {
    if (isAuthenticated) return null;
    return <>{children}</>;
  }

  if (!isAuthenticated) {
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
        <StatusBar />
      </div>
    </div>
  );
}
