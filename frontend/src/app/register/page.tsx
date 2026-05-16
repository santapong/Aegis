"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User, Check } from "lucide-react";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { CodeChip } from "@/components/shell/code-chip";
import { GoogleSignInButton } from "@/components/auth/google-sign-in";
import { cn } from "@/lib/utils";

type Tier = "starter" | "navigator";

const TIERS: Array<{
  id: Tier;
  name: string;
  price: string;
  tag: string;
  features: string[];
}> = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    tag: "self-host",
    features: ["Unlimited transactions", "AI insights · monthly", "Self-hosted"],
  },
  {
    id: "navigator",
    name: "Navigator",
    price: "$12 / mo",
    tag: "hosted",
    features: ["Everything in Starter", "Daily AI advisor", "Priority sync"],
  },
];

const FEATURE_BULLETS = [
  "Connect institutions in under 90 seconds",
  "Calendar, Gantt, scenario planning out-of-box",
  "Anomaly detection + AI-generated weekly summaries",
  "Self-host or run on the hosted bridge",
];

export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tier, setTier] = useState<Tier>("starter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await authAPI.register({ email, username, password });
      const tokenRes = await authAPI.login({ email, password });
      setToken(tokenRes.access_token);
      const userRes = await authAPI.me();
      login(tokenRes.access_token, userRes);
      router.push("/");
    } catch (err: unknown) {
      const e = err as { detail?: string; message?: string };
      setError(e.detail || e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setError("");
      try {
        const tokenRes = await authAPI.googleSignIn(credential);
        setToken(tokenRes.access_token);
        const userRes = await authAPI.me();
        login(tokenRes.access_token, userRes);
        router.push("/");
      } catch (err: unknown) {
        const e = err as { detail?: string; message?: string };
        setError(e.detail || e.message || "Google sign-in failed");
      }
    },
    [router, login, setToken]
  );

  return (
    <div className="auth-split">
      <aside className="auth-aside">
        <div>
          <div
            className="flex items-center gap-2 font-mono text-[10px] tracking-[1.8px] uppercase mb-8"
            style={{ color: "var(--dim)" }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "var(--hero-glow)" }}
            />
            <span>signal · onboarding · 01</span>
          </div>
          <h1
            className="text-[42px] leading-[1.05] mb-5"
            style={{
              fontFamily: "var(--display-font)",
              fontStyle: "var(--display-style)",
              fontWeight: "var(--display-weight)",
              letterSpacing: "var(--display-tracking)",
              color: "var(--fg)",
            }}
          >
            Map your finances in 90 seconds.
          </h1>
          <ul className="space-y-3 max-w-[44ch]">
            {FEATURE_BULLETS.map((f) => (
              <li
                key={f}
                className="flex items-start gap-3 font-mono text-[12.5px]"
                style={{ color: "var(--fg-2)" }}
              >
                <Check size={14} style={{ color: "var(--accent)", marginTop: 2 }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div
          className="font-mono text-[10px] tracking-[1.6px] uppercase"
          style={{ color: "var(--dim-2)" }}
        >
          aegis · galaxy v2 · node aegis-01
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div
            className="font-mono text-[10px] tracking-[1.6px] uppercase mb-3 flex items-center gap-2"
            style={{ color: "var(--dim)" }}
          >
            <CodeChip>REG</CodeChip>
            <span>register · new operator</span>
          </div>
          <h2
            className="text-[34px] leading-[1.05] mb-7"
            style={{
              fontFamily: "var(--display-font)",
              fontStyle: "var(--display-style)",
              fontWeight: "var(--display-weight)",
              letterSpacing: "var(--display-tracking)",
              color: "var(--fg)",
            }}
          >
            Create account
          </h2>

          <GoogleSignInButton onCredential={handleGoogleCredential} label="signup_with" />

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <div
              className="my-5 flex items-center gap-3 font-mono text-[10px] tracking-[1.6px] uppercase"
              style={{ color: "var(--dim-2)" }}
            >
              <span style={{ flex: 1, height: 1, background: "var(--pane-edge)" }} />
              <span>or email</span>
              <span style={{ flex: 1, height: 1, background: "var(--pane-edge)" }} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="rounded p-3 text-sm font-mono"
                style={{
                  background: "color-mix(in oklab, var(--bad) 12%, transparent)",
                  color: "var(--bad)",
                  border: "1px solid var(--bad)",
                }}
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="username"
                className="font-mono text-[10px] tracking-[1.6px] uppercase"
                style={{ color: "var(--dim)" }}
              >
                Username
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--dim)" }}
                />
                <input
                  id="username"
                  type="text"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Pick a handle"
                  className="flex h-11 w-full px-3 pl-10 text-sm focus-visible:outline-none transition-colors"
                  style={{
                    background: "var(--pane-2)",
                    color: "var(--fg)",
                    border: "1px solid var(--pane-edge)",
                    borderRadius: "var(--card-radius)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="font-mono text-[10px] tracking-[1.6px] uppercase"
                style={{ color: "var(--dim)" }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--dim)" }}
                />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex h-11 w-full px-3 pl-10 text-sm focus-visible:outline-none transition-colors"
                  style={{
                    background: "var(--pane-2)",
                    color: "var(--fg)",
                    border: "1px solid var(--pane-edge)",
                    borderRadius: "var(--card-radius)",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="font-mono text-[10px] tracking-[1.6px] uppercase"
                  style={{ color: "var(--dim)" }}
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--dim)" }}
                  />
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8+ chars"
                    className="flex h-11 w-full px-3 pl-10 text-sm focus-visible:outline-none"
                    style={{
                      background: "var(--pane-2)",
                      color: "var(--fg)",
                      border: "1px solid var(--pane-edge)",
                      borderRadius: "var(--card-radius)",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="font-mono text-[10px] tracking-[1.6px] uppercase"
                  style={{ color: "var(--dim)" }}
                >
                  Confirm
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--dim)" }}
                  />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm"
                    className="flex h-11 w-full px-3 pl-10 text-sm focus-visible:outline-none"
                    style={{
                      background: "var(--pane-2)",
                      color: "var(--fg)",
                      border: "1px solid var(--pane-edge)",
                      borderRadius: "var(--card-radius)",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="font-mono text-[10px] tracking-[1.6px] uppercase"
                style={{ color: "var(--dim)" }}
              >
                Tier
              </label>
              <div className="grid grid-cols-2 gap-3">
                {TIERS.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTier(t.id)}
                    className={cn(
                      "p-3 text-left transition-all",
                      tier === t.id && "ring-1"
                    )}
                    style={{
                      borderRadius: "var(--card-radius)",
                      border: `1px solid ${
                        tier === t.id ? "var(--accent)" : "var(--pane-edge)"
                      }`,
                      background:
                        tier === t.id ? "var(--accent-soft)" : "var(--pane-2)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="font-mono text-[10px] tracking-[1.4px] uppercase"
                        style={{ color: "var(--dim)" }}
                      >
                        {t.tag}
                      </span>
                      <span
                        className="font-mono text-[10px] tracking-[1.4px]"
                        style={{
                          color: tier === t.id ? "var(--accent)" : "var(--dim)",
                        }}
                      >
                        {t.price}
                      </span>
                    </div>
                    <div
                      className="text-[16px] mb-1"
                      style={{
                        fontFamily: "var(--display-font)",
                        fontStyle: "var(--display-style)",
                        color: "var(--fg)",
                      }}
                    >
                      {t.name}
                    </div>
                    <ul
                      className="font-mono text-[11px] leading-[1.55] space-y-0.5"
                      style={{ color: "var(--dim)" }}
                    >
                      {t.features.map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-galaxy w-full justify-center"
              style={{ height: 44 }}
            >
              {loading ? "Creating…" : "Create account"}
              <span className="caret" style={{ background: "var(--void)" }} />
            </button>
          </form>

          <div
            className="mt-6 text-center font-mono text-[12px]"
            style={{ color: "var(--dim)" }}
          >
            Already onboard?{" "}
            <Link
              href="/login"
              className="font-medium"
              style={{ color: "var(--accent)" }}
            >
              Sign in →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
