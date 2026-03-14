import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/ui/sidebar";
import { Providers } from "@/components/ui/providers";

export const metadata: Metadata = {
  title: "Aegis — AI-Powered Financial Planning",
  description: "Plan your finances with calendar, Gantt charts, and AI-powered insights",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-16 lg:pt-6 bg-[var(--bg-secondary)]">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
