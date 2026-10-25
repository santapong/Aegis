import type { Metadata } from "next";
import { AegisBrand } from "@/components/brand";
import Link from "next/link";
import { AccessStory } from "@/components/access-story";
import { ThemeToggle } from "@/components/theme-toggle";
import { Syne } from "next/font/google";
import { ArrowLeft, ArrowUpRight, ChevronDown } from "lucide-react";
import { LoginForm } from "./login-form";
import s from "./login.module.css";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to your Aegis workspace. Your everyday money and what comes next.",
};
const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-syne",
});

export default function LoginPage() {
  return (
    <div className={`${s.page} ${syne.variable}`} data-theme="horizon-login">
      <div className={s.orbits} aria-hidden="true">
        <svg
          viewBox="0 0 1440 1000"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
        >
          <ellipse
            cx="720"
            cy="530"
            rx="640"
            ry="275"
            transform="rotate(-29 720 530)"
            stroke="#90a67d"
            strokeOpacity=".45"
          />
          <ellipse
            cx="720"
            cy="530"
            rx="675"
            ry="310"
            transform="rotate(-29 720 530)"
            stroke="#90a67d"
            strokeOpacity=".17"
          />
          <ellipse
            cx="720"
            cy="530"
            rx="590"
            ry="225"
            transform="rotate(-29 720 530)"
            stroke="#6f8b4c"
            strokeOpacity=".17"
          />
          <path
            d="M 193 627 C 120 734 155 814 287 820"
            stroke="#6f8b4c"
            strokeOpacity=".54"
          />
          <circle cx="193" cy="627" r="4" fill="#6f8b4c" fillOpacity=".78" />
          <circle cx="1249" cy="408" r="4" fill="#5A979A" />
          <path
            d="M 1267 225 h 12 m -6 -6 v 12 M 186 833 h 12 m -6 -6 v 12"
            stroke="#627A78"
            strokeOpacity=".6"
          />
        </svg>
      </div>
      <header className={s.header}>
        <Link href="/landing" className={s.backLink}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to home
        </Link>
        <div className="aegis-access-actions"><ThemeToggle /><Link href="/docs" className={s.docsLink}>
          Documentation
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link></div>
      </header>
      <main className={s.main}><AccessStory />
        <div className={s.access}>
          <Link href="/landing" className={s.brand} aria-label="Aegis home">
            <AegisBrand />
          </Link>
          <section className={s.formPanel} aria-labelledby="sign-in-heading">
            <div className={s.formHeading}>
              <h1 id="sign-in-heading">Welcome back.</h1>
              <p>Sign in to your Aegis workspace.</p>
            </div>
            <LoginForm />
            <p className={s.register}>
              New to Aegis?{" "}
              <Link href="/register">
                Create an account
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </p>
          </section>
          <details className={s.help}>
            <summary>
              Need help signing in?
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div>
              <p>
                Use the email and password you registered with.
                {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
                  ? " If you joined with Google, use the Google sign-in button."
                  : ""}
              </p>
              <p>
                Email password reset isn’t available in this version. For a
                self-hosted workspace, contact its administrator for help with
                account access.
              </p>
            </div>
          </details>
        </div>
      </main>
      <footer className={s.footer}>
        <p>
          A clearer today. <span>A bigger tomorrow.</span>
        </p>
        <span className={s.footerDetail}>Solid ground. Open horizons.</span>
      </footer>
    </div>
  );
}
