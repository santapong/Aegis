"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Eye, EyeOff } from "lucide-react";
import { authAPI } from "@/lib/api";
import { safeAuthReturn } from "@/lib/auth-return";
import { useAuthStore } from "@/stores/auth-store";
import { GoogleSignInButton } from "@/components/auth/google-sign-in";
import s from "./login.module.css";

function signInError(
  error: unknown,
  stage: "email" | "google" | "session",
): string {
  const e = error as { status?: number; detail?: unknown } | null;
  if (e?.status === 401 && stage === "email")
    return "That email and password don’t match. Please try again.";
  if (e?.status === 401 && stage === "session")
    return "We couldn’t confirm your session. Please try signing in again.";
  if (e?.status === 429)
    return "Too many attempts. Please wait a little before trying again.";
  if (e?.status && e.status >= 500)
    return "We couldn’t reach sign-in right now. Please try again in a moment.";
  if (error instanceof TypeError)
    return "We couldn’t connect. Check your connection and try again.";
  if (typeof e?.detail === "string") return e.detail;
  return "We couldn’t sign you in. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Before hydration credentials must not be sent through a native form or URL.
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const signIn = useCallback(
    async (method: "email" | "google", request: () => Promise<unknown>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPending(method);
      setError("");
      let stage: "email" | "google" | "session" = method;
      try {
        // The backend sets the httpOnly cookie. Never store its token in JS.
        await request();
        stage = "session";
        const user = await authAPI.me();
        login(user);
        router.replace(safeAuthReturn(new URLSearchParams(window.location.search).get("next")));
      } catch (err: unknown) {
        setError(signInError(err, stage));
        setPending(null);
        inFlight.current = false;
      }
    },
    [login, router],
  );

  const handleGoogleCredential = useCallback(
    (credential: string) =>
      signIn("google", () => authAPI.googleSignIn(credential)),
    [signIn],
  );

  return (
    <>
      <noscript>
        <p className={s.notice}>
          Enable JavaScript to sign in. Your email and password are not
          submitted while it is disabled.
        </p>
      </noscript>
      {error && (
        <div
          className={s.error}
          role="alert"
          tabIndex={-1}
          ref={errorRef}
          id="sign-in-error"
        >
          <CircleAlert size={18} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <>
          <div className={s.google} inert={!ready || pending !== null}>
            <GoogleSignInButton
              onCredential={handleGoogleCredential}
              label="signin_with"
              width={280}
            />
          </div>
          <div className={s.divider}>
            <span>or continue with email</span>
          </div>
        </>
      )}
      <form
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          void signIn("email", () =>
            authAPI.login({ email: email.trim(), password }),
          );
        }}
        aria-label="Sign in"
        aria-busy={pending !== null}
      >
        <fieldset className={s.fields} disabled={!ready || pending !== null}>
          <div className={s.field}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className={s.field}>
            <label htmlFor="password">Password</label>
            <div className={s.passwordField}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
              />
              <button
                type="button"
                className={s.reveal}
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-controls="password"
              >
                {showPassword ? (
                  <EyeOff size={19} aria-hidden="true" />
                ) : (
                  <Eye size={19} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <button type="submit" className={s.submit}>
            <span>{pending ? "Signing in…" : "Sign in"}</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </fieldset>
        <p className={s.srOnly} role="status">
          {pending ? "Signing in. Please wait." : ""}
        </p>
      </form>
    </>
  );
}
