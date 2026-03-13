import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/ui/sidebar";
import { Providers } from "@/components/ui/providers";

export const metadata: Metadata = {
  title: "Money Manager — AI-Powered Financial Planning",
  description: "Plan your finances with calendar, Gantt charts, and AI-powered insights",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-secondary)]">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
