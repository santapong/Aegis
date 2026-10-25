# Direction A — Aegis Meridian landing

**Later owner acceptance, 2026-09-28:** the owner accepted the session's completed public frontend design. Continue from the [canonical accepted specification](012-aegis-design-spec.md). The pending-review wording below records the earlier implementation checkpoint.

Date: 2026-09-28. Status: Direction A selected by the owner in this task; implemented and locally verified. Evidence: [Meridian validation](../validation/2026-09-28-meridian-landing/README.md). Final implementation remains available for owner review. Not deployed.

## Decision and scope

The owner selected Direction A from `2026-09-28-landing-exploration/index.html` and requested the researched website principles be used. This supersedes the navy/cyan first draft described in `008-draveniq-inspired-landing.md`; its SSR/auth corrections remain applicable.

Goal: make personal money planning understandable through one consistent dated example. Primary audience: someone organizing everyday finances and future plans. Primary action `/register`; return path `/login`; secondary action explores a sample month without an account.

| Direction | Decision |
| --- | --- |
| A — Meridian | Selected: established Aegis identity, calendar-first story |
| B — Observatory | Historical alternative; do not blend in its scene or cyan palette |
| C — Money Journal | Historical alternative; do not introduce its editorial light theme |

## Reference application

- Sunsama: useful planner visible beside the promise; a short routine after the opening.
- Daybridge: familiar dated entries explain the product visually.
- Lunch Money: group capabilities by what people do: record, arrange, review.
- Actual Budget: accessible example plus practical ownership/setup information.
- Use the research matrix for the dated source observations and limitations. No reference screenshots, customer logos, testimonials, prices or capability claims enter the production page.

## Visual and content contract

Retain the unchanged Aegis app icon, Syne display and Inter interface roles. Scoped landing tokens: canvas `#0A0C0E`, secondary `#101317`, panel `#14181D`, text `#EDE7DC`, supporting `#B5BBB9`, amber `#E8913C`, teal `#2E6B72`. Teal is an accent/surface with light text, not a low-contrast text color. Solid amber primary actions with dark labels. Deliberately dark marketing view independent of the saved app theme.

Opening: asymmetric headline “Know what's coming. Plan what matters.” beside a working calendar/timeline example. Keep the next content visible near the first viewport; no full-screen decoration or automatic motion.

Sequence: promise + sample month → Record / Arrange / Review with product-inspired example details → selectable savings/trip/debt examples → optional explanation of the same sample → source/self-hosting/export → practical FAQ → account action.

One shared sample: income plan ฿65,000 marked complete on 25 September 2026, rent plan ฿18,000 marked complete on 28 September, planned savings contribution ฿3,000 on 30 September. Code inspection confirmed Calendar and Gantt derive from plans, not automatically from transactions; the production sample labels these statuses Completed/Planned, refining the board's shorthand “Recorded.” The separate transaction example uses the same rent amount, without implying automatic synchronization. Other spending is not represented; never describe their difference as disposable income or a complete balance. Distinguish records, plans, targets and completed progress. Demonstrations are illustrative and do not call backend or AI services.

## Implementation ownership and acceptance

One local frontend lane: `frontend/src/app/landing/{page.tsx,preview.tsx,landing.module.css}`, plus this decision and the unreleased changelog. Preserve all unrelated LINE work, the global application theme, authentication behavior and backend. Page content is server rendered; only navigation and bounded sample interactions need client state. No new package dependency.

- Calendar/Timeline show the same three events and retain selected-event context.
- Event and life-goal selections visibly update their related detail and expose accessible selected states.
- Account, docs, source and in-page links lead to real destinations; mobile menu closes on navigation and Escape restores focus.
- 320/390/768/1024/1440/1920px have readable layouts without unintended page or headline clipping. Interactive targets meet the 44px convention.
- Production build and relevant browser checks pass; visually inspect desktop/mobile and check the public SSR fallback with JavaScript disabled.
- Data claims and sample arithmetic remain consistent. No unsupported bank-sync, automatic transfer, paid-plan, savings-outcome or AI-availability claim.

Local preview should run as a user service, following the previous design-board recovery, so review is not tied to an execution cell. This is a preview, not a release.

## Rollback and release boundary

The first draft's three landing files are backed up under `/tmp/aegis-before-meridian-2026-09-28/` before replacement. Restore only those files for a local rollback; do not revert unrelated dirty files or the public-route rendering correction. No schema, credentials or deployment changes. Full repository review/CI/release gates remain subsequent shipping work; this task provides locally verified implementation for owner review.
