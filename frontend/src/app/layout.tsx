import type { Metadata } from "next";
import Script from "next/script";
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

/**
 * Pre-hydration body-class script — runs before React mounts so users with
 * a persisted non-default theme don't see an Observatory flash for one
 * paint before ThemeSync swaps. Reads the persisted Zustand store from
 * localStorage and applies `.theme-{name}` to <body>. Safe to fail
 * silently — ThemeSync still reconciles after hydration.
 */
const PREHYDRATE_THEME = `
(function () {
  try {
    var raw = localStorage.getItem('aegis-app-store');
    if (!raw) return;
    var parsed = JSON.parse(raw);
    var t = parsed && parsed.state && parsed.state.theme;
    var allowed = ['observatory', 'constellation', 'supernova'];
    if (allowed.indexOf(t) === -1) return;
    document.body.classList.remove('theme-observatory', 'theme-constellation', 'theme-supernova');
    document.body.classList.add('theme-' + t);
  } catch (e) {}
})();
`;

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
        <Script
          id="aegis-prehydrate-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: PREHYDRATE_THEME }}
        />
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
