"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Top bar for OPEN_APP_PAGES (docs, changelog) — routes reachable without
 * login but rendered outside the Sidebar/StatusBar shell for signed-out
 * visitors (see AuthGate). Signed-in visitors already have the sidebar for
 * navigation, so this renders nothing for them.
 */
export function PublicPageHeader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return null;

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 md:px-6 border-b border-border bg-background/80 backdrop-blur">
      <Link href="/landing" className="font-mono text-sm font-semibold tracking-wide">
        AEG<span className="text-primary">IS</span>
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/docs" className="text-muted-foreground hover:text-foreground transition-colors">
          Docs
        </Link>
        <Link href="/changelog" className="text-muted-foreground hover:text-foreground transition-colors">
          Changelog
        </Link>
        <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );
}
