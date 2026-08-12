import type { Metadata } from "next";
import Link from "next/link";
import { Syne, Sora } from "next/font/google";
import { CometGL } from "@/components/shell/comet-gl";
import { Reveal } from "./reveal";
import s from "./landing.module.css";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — AI-Powered Financial Planning` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/landing` },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${SITE_NAME} — AI-Powered Financial Planning`,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/landing`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI-Powered Financial Planning`,
    description: SITE_DESCRIPTION,
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: `${SITE_URL}/landing`,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const FOLDS = [
  {
    n: "01",
    title: (
      <>
        Every baht on a <em>calendar</em>.
      </>
    ),
    body: "Bills, salary, subscriptions and one-off plans sit on the month where they land. Scan a week the way you scan a diary — nothing hides in a table.",
    meta: "calendar · recurring · reminders",
  },
  {
    n: "02",
    title: (
      <>
        Plans stretch on a <span className="amber">Gantt</span>.
      </>
    ),
    body: "A debt payoff, a trip, a savings goal — each is a bar with a start, an end and a running total. Drag it and the numbers follow.",
    meta: "gantt · goals · debts · trips",
  },
  {
    n: "03",
    title: (
      <>
        An advisor that <em>shows its work</em>.
      </>
    ),
    body: "Claude reads your last ninety days and answers in plain sentences with the figures it used. No scores, no badges, no nudges to spend.",
    meta: "claude · typhoon · groq",
  },
];

const CAPABILITIES = [
  { name: "Keyboard-first", desc: "Every screen reachable without the mouse; a command palette on /.", tag: "⌘1 – ⌘7" },
  { name: "Self-hosted", desc: "One docker compose up. SQLite to Postgres, your box, your data.", tag: "docker" },
  { name: "PDF reports", desc: "Monthly statements rendered server-side with real charts.", tag: "weasyprint" },
  { name: "Payments", desc: "Stripe test and live modes with webhooks wired in.", tag: "stripe" },
  { name: "Exports", desc: "NDJSON streaming into whatever warehouse you already run.", tag: "ndjson" },
];

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne" });
const sora = Sora({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-sora" });

const STATS = [
  { l: "Latency", v: "42ms", s: "p95 · global" },
  { l: "Coverage", v: "12.4k", s: "merchants mapped" },
  { l: "Self-host", v: "100%", s: "your data, your box" },
  { l: "Open", v: "MIT", s: "source available" },
];

export default function LandingPage() {
  return (
    <div className={`${s.page} ${syne.variable} ${sora.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <header className={s.nav}>
        <Link href="/landing" className={s.wordmark}>
          AEG<span>IS</span>
        </Link>
        <Link href="/docs" className={s.navLink}>
          Docs
        </Link>
        <Link href="/changelog" className={s.navLink}>
          Changelog
        </Link>
        <span className={s.navEnd}>
          <Link href="/login" className={s.navLink}>
            Sign in
          </Link>
          <Link href="/register" className={s.btn}>
            Get started
          </Link>
        </span>
      </header>

      <section className={s.hero}>
        <CometGL className={s.heroCanvas} />
        <div className={s.heroVeil} />
        <div className={`${s.heroInner} ${s.reveal}`}>
          <div className={s.kicker}>
            <span className={s.dot} />
            v1.4 · generally available
          </div>
          <h1 className={s.title}>
            Personal finance, <span className={s.titleAccent}>mapped.</span>
          </h1>
          <p className={s.lede}>
            A calendar planner, a Gantt timeline and an AI advisor for your money,
            in one keyboard-first workspace. Self-hosted, open source.
          </p>
          <div className={s.actions}>
            <Link href="/register" className={s.btn}>
              Open the workspace
            </Link>
            <Link href="/login" className={s.btnQuiet}>
              Sign in →
            </Link>
          </div>
          {process.env.NODE_ENV === "development" && (
            <p className={s.seed}>
              Seed account · <code>demo@aegis.local</code> · <code>demo-password-123</code>
            </p>
          )}
        </div>
      </section>

      {FOLDS.map((fold) => (
        <Reveal key={fold.n}>
          <section className={s.fold}>
            <div className={s.foldNumeral}>{fold.n}</div>
            <div>
              <h2 className={s.foldTitle}>{fold.title}</h2>
              <p className={s.foldBody}>{fold.body}</p>
              <div className={s.foldMeta}>
                <i>→</i> {fold.meta}
              </div>
            </div>
          </section>
        </Reveal>
      ))}

      <Reveal>
        <section className={s.capTable}>
          <div className={s.sectionLabel}>
            <span className={s.dot} />
            What ships in the box
          </div>
          <div className={s.capHead}>
            <span>Capability</span>
            <span>Detail</span>
            <span>Stack</span>
          </div>
          {CAPABILITIES.map((cap) => (
            <div key={cap.name} className={s.capRow}>
              <div className={s.capName}>{cap.name}</div>
              <div className={s.capDesc}>{cap.desc}</div>
              <div className={s.capTag}>{cap.tag}</div>
            </div>
          ))}
        </section>
      </Reveal>

      <section className={`${s.stats} ${s.revealLate}`}>
        {STATS.map((stat) => (
          <div key={stat.l} className={s.stat}>
            <div className={s.statLabel}>{stat.l}</div>
            <div className={s.statValue}>{stat.v}</div>
            <div className={s.statSub}>{stat.s}</div>
          </div>
        ))}
      </section>

      <Reveal>
        <section className={s.statement}>
          <h2 className={s.statementText}>
            Money software that shows the work and lets you <span className={s.titleAccent}>think</span>.
          </h2>
          <div className={s.actions} style={{ justifyContent: "center" }}>
            <Link href="/register" className={s.btn}>
              Open the workspace
            </Link>
          </div>
        </section>
      </Reveal>

      <footer className={s.footer}>
        <span>© Aegis · MIT licensed</span>
        <span>
          <Link href="/docs">Docs</Link>
          {" · "}
          <a href="https://github.com/santapong/aegis" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {" · "}v1.4.0
        </span>
      </footer>
    </div>
  );
}
