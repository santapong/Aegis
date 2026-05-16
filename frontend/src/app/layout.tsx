import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/ui/providers";
import { AuthGate } from "@/components/auth/auth-gate";
import { Backdrop } from "@/components/shell/backdrop";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aegis — AI-Powered Financial Planning",
  description: "Plan your finances with calendar, Gantt charts, and AI-powered insights",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          mono.variable,
          serif.variable,
          "antialiased font-sans theme-observatory"
        )}
      >
        <Providers>
          <Backdrop />
          <div className="relative z-[1]">
            <AuthGate>{children}</AuthGate>
          </div>
        </Providers>
      </body>
    </html>
  );
}
