# Design: incremental RSC migration for the dashboard

**Status**: design + migration plan. Spike not yet implemented because the cookie-forwarding wiring is the actual hard part and needs your call on a security tradeoff first.

## What this would change

**Today**: dashboard renders client-side. Browser loads the page shell (`/`), the React tree hydrates, `useQuery` fires `/api/dashboard/bundle`, fills the components. TTFB-to-data on a Vercel + Render deploy:
- HTML: ~80 ms
- Hydration: ~50 ms
- Bundle fetch: ~120 ms (rewrite proxy hop)
- **Total: ~250 ms** before any KPI value appears

**With RSC**: dashboard renders server-side. Vercel serves HTML with the data already inlined. The browser sees full KPIs on the first paint. Interactive widgets (theme toggle, AI panel, hotkey palette) hydrate behind Suspense boundaries.
- HTML + data inline: ~100 ms (one round-trip; the bundle query runs server-side)
- **Total: ~100 ms**

That's a real ~150 ms LCP improvement. Whether you feel it depends on your latency budget.

## Why this is a tractable refactor and not a week-long pit of despair

It's tractable IF you accept the constraint: **only the data-loading boundary moves to RSC.** Every interactive child stays a `"use client"` component. You don't try to make the theme picker an RSC.

Practically that means the dashboard page splits in two:

```tsx
// app/page.tsx — Server Component (no "use client")
export default async function DashboardPage() {
  const bundle = await fetchBundleServerSide();  // runs on Vercel server
  return <DashboardClient bundle={bundle} />;
}

// app/dashboard-client.tsx — Client Component (existing code)
"use client";
export function DashboardClient({ bundle }: { bundle: DashboardBundle }) {
  // Everything the page does today: useState, motion, useAppStore, etc.
  // No useQuery for the bundle — it arrived via props.
  ...
}
```

That's a ~1-day refactor, not a week-long one. The week-long version was "convert every interactive widget", which RSC doesn't actually require.

## The hard part: forwarding the cookie

RSC `fetch()` runs on Vercel's server. The browser's `aegis_session` cookie doesn't auto-attach — Vercel has to read it from the incoming request and forward it.

```tsx
import { headers } from "next/headers";

async function fetchBundleServerSide() {
  const cookie = (await headers()).get("cookie") ?? "";
  const res = await fetch(`${process.env.BACKEND_INTERNAL_URL}/api/dashboard/bundle`, {
    headers: { cookie },  // <-- the line you'll forget
    cache: "no-store",    // <-- and this one
  });
  if (!res.ok) throw new Error(`Bundle fetch failed: ${res.status}`);
  return res.json();
}
```

Two gotchas:

1. **`cache: "no-store"`** is critical. Next.js's default fetch cache would otherwise share dashboard data across users. Without it, Alice's KPIs leak to Bob on a cache hit.
2. **`headers()` is async** in Next 15 (it was sync in 14). Await it.

If you skip either, you get a subtle bug that won't surface in dev (single user) and will surface in prod (the worst combination).

## Migration plan (when you want to ship this)

1. **Extract** `app/page.tsx` body into `app/dashboard-client.tsx` (just rename + add `"use client"`).
2. **Replace** the bundle `useQuery` in the client component with a `bundle` prop.
3. **Rewrite** `app/page.tsx` as a Server Component that fetches server-side and renders `<DashboardClient bundle={bundle} />`.
4. **Move** the request-error path: server-side fetch failures throw, caught by a colocated `error.tsx` boundary. No more `bundleError` state.
5. **Test**:
   - Cookie forwarding: log in as A, then in another tab log in as B. Refresh A's dashboard — should still show A's data, not B's.
   - Hydration: dev tools shows no hydration mismatch warnings.
   - Streaming: KPIs visible before JS hydrates (disable JS in browser → check).
6. **Keep the bundle endpoint**. RSC consumes it server-to-server, just like the client did. Zero backend changes.

## Open question for the operator

**Are you OK forwarding the cookie via `headers()` inside the RSC?** This means the backend's CORS allowlist must include `your-app.vercel.app` (already does), AND the Vercel server must be considered "trusted" to handle session cookies (it is — same origin from the browser's perspective).

The alternative is route-handler-based RSC: the page is still RSC but it `await`s a Next.js API route that lives in `app/api/...` which itself forwards the cookie. Extra hop, less clean.

Going with the direct `headers()` approach in the plan above. If you want the route-handler version instead, say so before implementation.

## Why I didn't ship the spike

I wrote the plan and the helper function but stopped short of moving `app/page.tsx` into client + server halves. Reasons:

1. The cookie-forwarding line is exactly the kind of thing that fails silently in dev and breaks in prod. Without a deploy + cookie + cross-user test loop, "looks right locally" is not enough.
2. The split touches every consumer of bundle data — KPIs, charts, anomaly list, insight cards, cashflow chart. A botched migration breaks the dashboard.
3. The win is real (~150 ms LCP) but not user-visible at our current scale. The dashboard bundle endpoint already cut us from 6 round-trips to 1.

**Pick one of three paths**:

- **Stay client-side** — the bundle endpoint already covers 80% of the win. Revisit RSC when you have real user complaints about dashboard cold-start.
- **Ship the spike now** — I'll do the split + cookie forwarding in a focused PR. Expect 4–6 hours of work + careful testing against a real Vercel deploy.
- **Ship the spike with feature flag** — keep the client-side path under `?legacy=1`, default new code path to RSC. Slightly more code; lets you roll back instantly if production breaks.

Default if you don't pick: stay client-side. The migration steps above are documented so any future operator (including future-you) can ship it in one session once it's a priority.
