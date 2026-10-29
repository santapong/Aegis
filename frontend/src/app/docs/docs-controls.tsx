"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Copy, Search, X } from "lucide-react";
import { articles, audienceLabel, docHref, legacyTopics } from "./catalog";
import { findDocArticles } from "./search";
import s from "./docs.module.css";

export function DocsBar() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = words.length
    ? findDocArticles(articles, query)
    : [];
  useEffect(() => {
    setQuery("");
  }, [pathname]);
  return (
    <div className={s.docsBar}>
      <div className={s.barInner}>
        <nav aria-label="Documentation sections">
          {[
            { href: "/docs", label: "Library" },
            { href: "/docs/guides", label: "User guide" },
            { href: "/docs/developers", label: "Developers" },
            { href: "/docs/topics/connections", label: "AI & MCP" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (
                  href === "/docs"
                    ? pathname === href
                    : pathname.startsWith(href)
                )
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div
          className={s.searchArea}
          role="search"
          aria-label="Search documentation"
        >
          <div className={s.searchInput}>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search documentation"
              aria-controls={words.length ? "docs-search-results" : undefined}
              placeholder="Search guides, topics, errors…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          {words.length > 0 && (
            <div id="docs-search-results" className={s.searchResults}>
              <p role="status">
                {results.length
                  ? `${results.length} ${results.length === 1 ? "guide" : "guides"} found`
                  : "No matching guides"}
              </p>
              {results.length ? (
                <ul>
                  {results.map((article) => (
                    <li key={article.slug}>
                      <Link
                        href={docHref(article)}
                        onClick={() => setQuery("")}
                      >
                        <span>{audienceLabel(article.audience)}</span>
                        <strong>{article.title}</strong>
                        <small>{article.description}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={s.noResults}>
                  Try “CSV”, “calendar”, “budget”, or “401”. You can also browse
                  the guide collections below.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <noscript>
        <p className={s.noScript}>
          Search needs JavaScript. All guide collections and articles are
          available from the links below.
        </p>
      </noscript>
    </div>
  );
}

export function CodeBlock({ label, code }: { label: string; code: string }) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 3000);
    return () => clearTimeout(timer);
  }, [status]);
  return (
    <div className={s.codeBlock}>
      <div className={s.codeHeader}>
        <span>{label}</span>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setStatus("Copied");
            } catch {
              setStatus("Select and copy the code below");
            }
          }}
        >
          {status === "Copied" ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          <span aria-live="polite">{status || "Copy"}</span>
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function LegacyDocsLinks() {
  const router = useRouter();
  useEffect(() => {
    const href = legacyTopics[window.location.hash.slice(1)];
    if (href) router.replace(href);
  }, [router]);
  return (
    <noscript>
      <nav className={s.legacyLinks} aria-label="Earlier documentation topics">
        {Object.entries(legacyTopics)
          .filter(([id]) => id !== "common-questions")
          .map(([id, href]) => (
            <Link id={id} key={id} href={href}>
              {id.replaceAll("-", " ")}
            </Link>
          ))}
      </nav>
    </noscript>
  );
}

export function DocPageActions({href}:{href:string}) {
  const [status,setStatus]=useState('');
  const [pending,setPending]=useState(false);
  return <div className={s.pageActions}><a href={href} target="_blank" rel="noreferrer">Markdown ↗</a><button type="button" disabled={pending} onClick={async()=>{setPending(true);try{const response=await fetch(href);if(!response.ok)throw new Error('unavailable');await navigator.clipboard.writeText(await response.text());setStatus('Page copied');}catch{setStatus('Open Markdown to copy');}finally{setPending(false);}}}><Copy size={14} aria-hidden="true" /> {pending?'Preparing…':'Copy page'}</button><span role="status">{status}</span></div>;
}
