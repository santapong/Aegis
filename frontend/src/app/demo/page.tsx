import type { Metadata } from "next";
import Link from "next/link";
import { Syne } from "next/font/google";
import { ArrowRight, Cloud, Server } from "lucide-react";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SITE_URL } from "@/lib/site";
import { DemoWorkspace } from "./workspace";
import s from "./demo.module.css";
const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-syne",
});
export const metadata: Metadata = {
  title: { absolute: "Try a money plan — Aegis Demo" },
  description:
    "Explore fictional personal and small-business money plans. Add a sample expense and see what changes when expected income arrives late.",
  alternates: { canonical: `${SITE_URL}/demo` },
  robots: { index: true, follow: true },
};
export default function DemoPage() {
  return (
    <div className={`${s.page} ${syne.variable}`} data-theme="horizon-demo">
      <a href="#demo-main" className={s.skip}>
        Skip to demo
      </a>
      <MarketingHeader current="demo" />
      <main id="demo-main" className={s.main}>
        <header className={s.intro}>
          <div>
            <p className={s.eyebrow}>A LITTLE PRACTICE. A CLEARER PICTURE.</p>
            <h1>See a money plan take shape.</h1>
            <p>
              Choose a story. Explore what came in, what is coming up, and what
              changes when life happens.
            </p>
          </div>
          <span className={s.demoBadge}>
            <span /> Interactive demo
            <br />
            <small>Fictional data · no account needed</small>
          </span>
        </header>
        <DemoWorkspace />
        <section
          id="ways-to-use"
          className={s.hosting}
          aria-labelledby="hosting-title"
        >
          <div className={s.hostingIntro}>
            <p className={s.eyebrow}>YOUR WORKSPACE, YOUR CHOICE</p>
            <h2 id="hosting-title">Two ways to use Aegis.</h2>
            <p>
              The same idea: keep your records and your next steps together.
              Choose who looks after the installation.
            </p>
          </div>
          <div className={s.hostingCards}>
            <article>
              <Cloud size={23} aria-hidden="true" />
              <span className={s.hostingStatus}>Proposed hosted offering</span>
              <h3>Let us handle the hosting.</h3>
              <p>
                Sign in through a browser while we operate the service. This is
                the intended managed-service path; public availability, pricing
                and service terms are still to be confirmed.
              </p>
              <Link href="/docs/guides">
                Explore how Aegis works{" "}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
            <article>
              <Server size={23} aria-hidden="true" />
              <span className={s.hostingStatus}>Self-hosting supported</span>
              <h3>Run it on your own terms.</h3>
              <p>
                Install the open-source app on your own infrastructure. You
                manage the deployment, updates and backups. The documentation
                walks through local setup.
              </p>
              <Link href="/docs/developers/local-setup">
                Read the setup guide <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>
      </main>
      <footer className={s.footer}>
        <span>
          AEGIS <small>A clearer today. A bigger tomorrow.</small>
        </span>
        <nav aria-label="Demo footer">
          <Link href="/landing">Back to Aegis</Link>
          <Link href="/docs">Documentation</Link>
        </nav>
      </footer>
    </div>
  );
}
