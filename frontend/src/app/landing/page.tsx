import Link from "next/link";
import { Syne, Sora } from "next/font/google";
import { MeridianGL } from "./meridian-gl";
import s from "./landing.module.css";

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
      <header className={s.nav}>
        <Link href="/landing" className={s.wordmark}>
          AEG<span>IS</span>
        </Link>
        <Link href="/landing" className={s.navLink}>
          Product
        </Link>
        <Link href="/landing" className={s.navLink}>
          Pricing
        </Link>
        <Link href="/landing" className={s.navLink}>
          Changelog
        </Link>
        <Link href="/docs" className={s.navLink}>
          Docs
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
        <MeridianGL className={s.heroCanvas} />
        <div className={s.heroVeil} />
        <div className={`${s.heroInner} ${s.reveal}`}>
          <div className={s.kicker}>
            <span className={s.dot} />
            v1.3 · generally available
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
          <p className={s.seed}>
            Seed account · <code>demo@aegis.local</code> · <code>demo-password-123</code>
          </p>
        </div>
      </section>

      <section className={`${s.stats} ${s.revealLate}`}>
        {STATS.map((stat) => (
          <div key={stat.l} className={s.stat}>
            <div className={s.statLabel}>{stat.l}</div>
            <div className={s.statValue}>{stat.v}</div>
            <div className={s.statSub}>{stat.s}</div>
          </div>
        ))}
      </section>

      <footer className={s.footer}>
        <span>© Aegis · MIT licensed</span>
        <span>
          <Link href="/docs">Docs</Link>
          {" · "}
          <a href="https://github.com/santapong/aegis" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          {" · "}v1.3.0
        </span>
      </footer>
    </div>
  );
}
