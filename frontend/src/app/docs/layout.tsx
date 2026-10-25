import type { Metadata } from "next";
import Link from "next/link";
import { Syne } from "next/font/google";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { DocsBar } from "./docs-controls";
import s from "./docs.module.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-syne",
});
export const metadata: Metadata = {
  title: { absolute: `Documentation — ${SITE_NAME}` },
  description:
    "Practical Aegis user guides and developer documentation. Learn to record expenses, set budgets, plan ahead, run Aegis locally or use the API.",
  alternates: { canonical: `${SITE_URL}/docs` },
  robots: { index: true, follow: true },
};
export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${s.page} ${syne.variable}`} data-theme="horizon-docs">
      <a href="#docs-main" className={s.skip}>
        Skip to documentation
      </a>
      <MarketingHeader current="docs" />
      <DocsBar />
      {children}
      <footer className={s.footer}>
        <span>Aegis documentation</span>
        <nav aria-label="Documentation footer">
          <Link href="/landing">Back to Aegis</Link>
          <Link href="/changelog">Changelog</Link>
          <a href="https://github.com/santapong/Aegis/issues">
            Report an issue
          </a>
          <a href="https://github.com/santapong/Aegis">Source code</a>
        </nav>
      </footer>
    </div>
  );
}
