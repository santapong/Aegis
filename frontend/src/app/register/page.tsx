"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AccessStory } from "@/components/access-story";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { AegisBrand } from "@/components/brand";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { GoogleSignInButton } from "@/components/auth/google-sign-in";
import s from "../login/login.module.css";
export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore(state => state.login);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [shown, setShown] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => setReady(true), []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const finish = useCallback(async (request: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError("");
    try { await request(); login(await authAPI.me()); router.replace("/"); }
    catch (err: unknown) { const e = err as { detail?: unknown; message?: string }; setError(typeof e.detail === "string" ? e.detail : "We couldn’t create your account. Please try again."); }
    finally { inFlight.current = false; setPending(false); }
  }, [login, router]);
  const google = useCallback((credential: string) => finish(() => authAPI.googleSignIn(credential)), [finish]);
  return <div className={s.page} data-theme="horizon-register"><header className={s.header}><Link href="/landing" className={s.backLink}><ArrowLeft size={16} /> Back to home</Link><div className="aegis-access-actions"><ThemeToggle /><Link href="/docs" className={s.docsLink}>Get to know Aegis <ArrowUpRight size={15} /></Link></div></header><main className={s.main}><AccessStory /><div className={s.access}><Link href="/landing" className={s.brand} aria-label="Aegis home"><AegisBrand /></Link><section className={s.formPanel} aria-labelledby="register-heading"><div className={s.formHeading}><h1 id="register-heading">A little more clarity.</h1><p>Create your account. Start at your own pace.</p></div><noscript><p className={s.notice}>Enable JavaScript to create an account. Credentials are not submitted while it is disabled.</p></noscript>{error && <div className={s.error} ref={errorRef} tabIndex={-1} role="alert">{error}</div>}{process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && <div className={s.google} inert={!ready || pending}><GoogleSignInButton onCredential={google} label="signup_with" width={280} /></div>}<form method="post" aria-label="Create an account" aria-busy={pending} onSubmit={event => { event.preventDefault(); if (password !== confirmPassword) { setError("Your passwords don’t match. Please check them and try again."); return; } void finish(async () => { await authAPI.register({ email: email.trim(), username: username.trim(), password }); await authAPI.login({ email: email.trim(), password }); }); }}><fieldset className={s.fields} disabled={!ready || pending}><div className={s.field}><label htmlFor="register-name">Your name</label><input id="register-name" name="username" autoComplete="nickname" required maxLength={50} value={username} onChange={e => setUsername(e.target.value)} placeholder="What should we call you?" /></div><div className={s.field}><label htmlFor="register-email">Email address</label><input id="register-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div><div className={s.field}><label htmlFor="register-password">Password <span style={{ color: "var(--muted)", fontWeight: 400 }}>· at least 8 characters</span></label><div className={s.passwordField}><input id="register-password" name="password" type={shown ? "text" : "password"} autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" /><button type="button" className={s.reveal} onClick={() => setShown(!shown)} aria-label={shown ? "Hide password" : "Show password"}>{shown ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div><div className={s.field}><label htmlFor="register-confirm">Confirm password</label><input id="register-confirm" name="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it once more" /></div><button type="submit" className={s.submit}>{pending ? "Creating your account…" : "Create account"}<ArrowRight size={17} /></button></fieldset></form><p className={s.register}>Already have an account? <Link href="/login">Sign in <ArrowUpRight size={14} /></Link></p></section><p className={s.notice}>Aegis helps you record and plan. You choose what to enter, and what comes next.</p></div></main><footer className={s.footer}><p>A clearer today. <span>A bigger tomorrow.</span></p><span className={s.footerDetail}>Solid ground. Open horizons.</span></footer></div>;
}
