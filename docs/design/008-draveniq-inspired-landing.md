# Aegis landing — financial clarity

Date: 2026-09-28. Status: historical first draft, superseded visually by the owner-selected [Meridian direction](009-meridian-landing.md). The public-route SSR/auth corrections below are retained. Not released.

## Brief and scope

Help a visitor understand Aegis as a personal finance workspace for tracking spending, planning on a calendar, and following savings goals. Primary action: create an account. Secondary action: explore a local, clearly labeled interactive sample. Keep Next.js 15 / React 19 and the existing authentication destinations. Changes are limited to the public landing, its rendering prerequisites, and documentation. Existing uncommitted LINE integration work is outside this change.

## References and direction

Pages read on 2026-09-28:

- https://www.monarch.com/ — organizes the story around tracking, budgeting, and planning. Transfer the progression from understanding today to planning ahead; do not borrow its bank connectivity, reviews, or pricing.
- https://www.copilot.money/ — explains features through concrete transactions and financial views. Transfer the use of specific sample outputs; do not borrow automation, awards, or account connections.
- https://linear.app/ — pairs restrained navigation and strong hierarchy with visible product views. Transfer product-first storytelling, not enterprise claims or its identity.

Considered: an expressive cosmic hero, a typography-only editorial page, and a product-led interactive preview. Choose the preview because a calendar and savings example explain this product directly and shorten the old 220vh decorative scroll sequence.

## Theme adaptation

DravenIQ-inspired, with Aegis's existing AEGIS wordmark and Syne display typography, and the already loaded Inter interface font. No DravenIQ dragon or new official Aegis mark. Landing-only semantic tokens use Void #060A12, Silver #DCE7F4, Cyan #26D9F2, Blue #0067DF, and the supplied dark surface/text/status values. Controls use 12px radii, cards 16px, panels 24px, and 44px targets. This page is intentionally dark independent of the application theme. Existing application themes remain available.

The primary illustration is HTML/SVG sample product content. No WebGL, external image dependency, continuous decorative animation, or hidden-on-load reveals. Prior comet source remains available but is not loaded by this landing. Color and opacity transitions honor reduced motion.

## Truth and acceptance

- Remove unverified p95 latency, merchant counts, release/version badge, and zero-price structured offer.
- Label all sample amounts and illustrative screens. Do not imply a live account or claim the illustration is an authenticated screenshot.
- Overview, calendar selection, and goals must be operable with pointer and keyboard. Sample actions never change stored finances or call AI.
- Account, sign-in, docs, changelog, and source links use real existing destinations.
- Explain provider setup for AI and manual entry; do not market the unshipped LINE integration.
- Check 320/390/768/1024/1440/1920 layouts, focus, mobile menu, sample controls, FAQ, reduced motion, SSR/no-JS content, type checking and production build.
- Record local validation separately from owner approval, backend account-flow verification, CI, and deployment.

The no-JavaScript production test exposed a second prerequisite: the root
`app/loading.tsx` streamed the entire public page into a hidden React suspense
segment. Scope that existing skeleton and the unchanged root dashboard page to
`app/(dashboard)/`. Next.js route groups preserve the `/` URL while removing the
dashboard loading boundary from `/landing`. Existing per-page data loaders stay
in place. Reference: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
and https://nextjs.org/docs/app/api-reference/file-conventions/loading, checked
2026-09-28. This is a rendering fix, not a change to authentication requirements.

Rollback: restore the landing route files, AuthGate public rendering order, and
Backdrop route classification; move the unchanged dashboard page and loading
files from `(dashboard)` back to `app/`. No database, dependency, or
application-theme migration.
