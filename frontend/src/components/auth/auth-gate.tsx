"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "@/components/ui/sidebar";

const AUTH_PAGES = ["/login", "/register"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch — show nothing until mounted
  if (!mounted) {
    return null;
  }

  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Auth pages render without sidebar
  if (isAuthPage) {
    if (isAuthenticated) {
      router.push("/");
      return null;
    }
    return <>{children}</>;
  }

  // Protected pages require auth
  if (!isAuthenticated) {
    router.push("/login");
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-background pt-16 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
