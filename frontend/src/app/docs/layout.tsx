import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `Docs — ${SITE_NAME}` },
  description: "Aegis setup guide, feature overview, and API reference.",
  alternates: { canonical: `${SITE_URL}/docs` },
  robots: { index: true, follow: true },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
