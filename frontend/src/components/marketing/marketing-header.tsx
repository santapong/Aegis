"use client";

import { AegisBrand } from "@/components/brand";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import s from "./marketing-header.module.css";
import { ThemeToggle } from "@/components/theme-toggle";

export function MarketingHeader({
  current = "landing",
}: {
  current?: "landing" | "docs" | "demo" | "welcome";
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);
  const landing = current === "landing" ? "" : "/landing";
  const links = [
    { href: `${landing}#how-it-works`, label: "The approach" },
    { href: `${landing}#your-plans`, label: "Your plans" },
    { href: `${landing}#your-data`, label: "Your data" },
    { href: "/demo", label: "Demo" },
    { href: "/docs", label: "Resources" },
  ];
  return (
    <header
      className={s.header}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          close();
          trigger.current?.focus();
        }
      }}
    >
      <div className={s.inner}>
        <Link
          href="/landing"
          className={s.brand}
          aria-label="Aegis home"
          onClick={close}
        >
          <AegisBrand />
        </Link>
        <nav className={s.desktop} aria-label="Main navigation">
          {links.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              aria-current={
                current !== "landing" && href === `/${current}`
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className={s.actions}>
          <ThemeToggle />
          <Link href="/login" className={s.signIn}>
            Sign in
          </Link>
          <Link href="/register" className={s.cta}>
            Start planning <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button
            ref={trigger}
            type="button"
            className={s.toggle}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <X size={21} aria-hidden="true" />
            ) : (
              <Menu size={21} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        className={s.mobile}
        aria-label="Mobile navigation"
        hidden={!open}
      >
        {links.map(({ href, label }) => (
          <Link
            key={label}
            href={href}
            onClick={close}
            aria-current={
              current !== "landing" && href === `/${current}`
                ? "page"
                : undefined
            }
          >
            {label}
          </Link>
        ))}
        <Link href="/login" onClick={close}>
          Sign in
        </Link>
        <Link href="/register" className={s.mobileCta} onClick={close}>Start planning <ArrowRight size={15} aria-hidden="true" /></Link>
      </nav>
      <noscript>
        <nav className={s.fallback} aria-label="Navigation without JavaScript">
          <Link href="/landing">Overview</Link>
          <Link href="/demo">Try the demo</Link>
          <Link href="/docs">Documentation</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </noscript>
    </header>
  );
}
