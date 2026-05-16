"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { CodeChip } from "@/components/shell/code-chip";
import { GoogleSignInButton } from "@/components/auth/google-sign-in";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tokenRes = await authAPI.login({ email, password });
      setToken(tokenRes.access_token);
      const userRes = await authAPI.me();
      login(tokenRes.access_token, userRes);
      router.push("/");
    } catch (err: unknown) {
      const e = err as { detail?: string; message?: string };
      setError(e.detail || e.message || "Login failed");
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
            <span>signal · bridge · 04</span>
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
            Welcome back to the bridge.
          </h1>
          <p
            className="font-mono text-[13px] leading-[1.65] max-w-[44ch]"
            style={{ color: "var(--fg-2)" }}
          >
            Pick up where you left off. Your last sync was{" "}
            <b style={{ color: "var(--fg)" }}>just now</b> — net worth is up{" "}
            <b style={{ color: "var(--ok)" }}>2.4%</b> this week.
          </p>
        </div>
        <figure className="max-w-[44ch]">
          <p className="auth-quote">
            &ldquo;Finally, money software that doesn&rsquo;t shout at me. It just shows
            the work and lets me think.&rdquo;
          </p>
          <figcaption
            className="mt-4 font-mono text-[11px] tracking-[1.4px] uppercase"
            style={{ color: "var(--dim)" }}
          >
            — Anya K. · navigator · since 2025
          </figcaption>
        </figure>
        <div
          className="font-mono text-[10px] tracking-[1.6px] uppercase"
          style={{ color: "var(--dim-2)" }}
        >
          aegis · galaxy v2 · node aegis-01
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="mb-8 flex items-center gap-2.5">
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 30% 30%, #fff 0%, transparent 25%), radial-gradient(circle at 60% 60%, var(--accent) 0%, var(--accent-2) 60%, transparent 100%)",
                boxShadow: "0 0 0 1px var(--pane-edge-2) inset, var(--hero-glow)",
              }}
            />
            <span
              className="text-[15px]"
              style={{
                fontFamily: "var(--display-font)",
                fontStyle: "var(--display-style)",
                color: "var(--fg)",
              }}
            >
              AEG<span style={{ color: "var(--accent)" }}>IS</span>
            </span>
          </div>

          <div
            className="font-mono text-[10px] tracking-[1.6px] uppercase mb-3 flex items-center gap-2"
            style={{ color: "var(--dim)" }}
          >
            <CodeChip>LOG</CodeChip>
            <span>access · existing operator</span>
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
            Sign in
          </h2>

          <GoogleSignInButton onCredential={handleGoogleCredential} label="signin_with" />

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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="font-mono text-[10px] tracking-[1.6px] uppercase"
                  style={{ color: "var(--dim)" }}
                >
                  Password
                </label>
                <Link
                  href="/register"
                  className="font-mono text-[10px] tracking-[1.4px]"
                  style={{ color: "var(--accent)" }}
                >
                  forgot? →
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--dim)" }}
                />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            <button
              type="submit"
              disabled={loading}
              className="btn-galaxy w-full justify-center"
              style={{ height: 44 }}
            >
              {loading ? "Signing in…" : "Sign in"}
              <span className="caret" style={{ background: "var(--void)" }} />
            </button>
          </form>

          <div
            className="my-6 flex items-center gap-3 font-mono text-[10px] tracking-[1.6px] uppercase"
            style={{ color: "var(--dim-2)" }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--pane-edge)" }} />
            <span>or</span>
            <span style={{ flex: 1, height: 1, background: "var(--pane-edge)" }} />
          </div>

          <div
            className="text-center font-mono text-[12px]"
            style={{ color: "var(--dim)" }}
          >
            New here?{" "}
            <Link
              href="/register"
              className="font-medium"
              style={{ color: "var(--accent)" }}
            >
              Create an account →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
