# Aegis accepted frontend design specification

Date: 2026-09-28, Asia/Bangkok. **Owner-accepted visual baseline for the public experience developed in this session.** The owner said frontend design was finished after selecting Meridian, Aegis Focus, revised docs, and the business/personal demo. This supersedes earlier pending-review wording for these surfaces; earlier artifacts remain historical evidence.

Acceptance does not establish a production launch, every authenticated screen's acceptance, paid-service readiness, backend correctness, or independent customer comprehension testing. Checked local branch: `agent/comet-asset-prompt`, base `e2c4a9c`, with uncommitted design and unrelated LINE/backend changes. No commit, push, or deployment is implied.

## Product and identity

Aegis helps a person record money movements, arrange upcoming plans, and review finances. Business X demonstrates a single owner's cash planning, not full company accounting. Preserve distinctions between transactions, plans, budget limits, savings targets, and contributions.

DravenIQ inspired contrast, restraint, and hierarchy. **Aegis retains its name, original icon, typography, and warm amber/teal identity.** Do not replace its mark with the DravenIQ dragon or revive the rejected navy/cyan first draft.

| Role | Accepted value/rule |
| --- | --- |
| Mark | Existing `frontend/src/app/icon.png`, aspect preserved and unchanged |
| Display | Syne via each public route's `--font-syne` |
| Interface | Inter via `--font-sans`, accessible system fallbacks |
| Code | JetBrains Mono via `--font-mono` |
| Canvas | `#0A0C0E` |
| Main/supporting text | `#EDE7DC` / `#B5BBB9` |
| Primary action | Amber `#E8913C`, dark label |
| Brand accent | Teal `#2E6B72`, mainly accent/surface with light text |
| Readable demo teal | `#8EB9AA` for foreground/chart use |
| Landing surfaces/border | `#101317`, `#14181D` / `#2B3337` |
| Docs surfaces/border | `#101619`, `#141B1E` / `#303B3E` |
| Theme scope | Deliberately dark opaque public pages, independent of saved workspace theme |

Preserve scoped semantic tokens: coherent identity does not require identical surfaces everywhere. Avoid decorative 3D, star fields, automatic comet motion, excessive glow, and copied competitor assets on accepted pages. Quiet static orbital lines belong to Focus login, separately from the mark.

## Surface contracts

### Meridian landing and header

Direction A, called “Developer A” by the owner, is Meridian. Headline: “Know what's coming. Plan what matters.” Pair the promise with a calendar/timeline example. Sequence: definition/sample → Record / Arrange / Review → real-life plans → optional AI → ownership/self-hosting/export → FAQ/account action.

Calendar and Timeline depict the same dated plans and retain selection. Completed plans are not automatically paid transactions. Partial sample totals are not a complete bank balance. Current secondary hero action opens `/demo`.

Shared header connects explanation, plans, data, demo, docs, sign-in, and getting started. Mobile navigation closes on selection/Escape and restores focus. Preserve server-rendered navigation and fallbacks.

Source: `frontend/src/app/landing/`, `frontend/src/components/marketing/`.
Evidence: [Meridian contract](009-meridian-landing.md), [references](2026-09-28-landing-exploration/02-references.md), [clarity/header extension](011-landing-clarity-and-documentation.md).

### Aegis Focus sign-in

Compact centered access panel, original icon, quiet orbital lines, one clear amber submit, and minimal copy. Compact screens simplify surrounding art/framing with the same form order.

Preserve real email/password handlers, configured Google availability, reveal/autofill, pending/error feedback, retry inputs, signup/help, and hydration/no-JavaScript credential safeguards. Do not invent password recovery, passkeys, SSO, testimonials, financial records, or security certifications.

Source: `frontend/src/app/login/{page.tsx,login-form.tsx,login.module.css}`.
Evidence: [Focus selection and references](2026-09-28-login-research/references.md). `010-meridian-sign-in.md` is superseded split-login history.

### Documentation

`/docs` is a searchable hub. Everyday guides and developer docs have different prerequisites and task paths. Preserve concrete examples, exact UI labels, expected results, troubleshooting, collection navigation, accessible contents, real search/copy controls, downloadable CSV, and legacy anchors.

Everyday articles cover first steps, transactions, budgets, plans, optional AI, and exports. Developer articles cover local setup, API, and architecture. This count is current structure, not a permanent limit.

Plan completion does not create a transaction. Contributions and targets remain separate. CSV export is not a complete database backup. Developer examples must match actual auth/endpoints.

Source: `frontend/src/app/docs/`, `frontend/public/docs/example-transactions.csv`.
Evidence: [docs correction/references](2026-09-28-docs-research/references.md). The mixed document structure in `011` is superseded.

### Public demo

`/demo` offers Business X and Mina's personal month, fictional October 2026 stories. Users inspect recorded/planned entries, add an expense, delay income, see budget changes/arithmetic, switch stories without losing drafts/edits, and reset the current story. State is in-memory and resets on reload; no real account, provider, payment, or stored finance record changes.

After planned reserves, original remainders are Business X ฿88,000 and personal ฿43,900. Delayed income produces -฿2,000 and ฿35,900. **Business X's -฿2,000 is a gap against its ฿10,000 reserve intention; cash before allocation is ฿8,000.** It is not evidence of a bank overdraft.

These are explicit demo assumptions, not the production forecast calculation. Preserve single-owner business scope, documented self-hosting, and a proposed hosted service. No subscription price or service-level promise is accepted here.

Source: `frontend/src/app/demo/`.
Evidence: [scope and arithmetic](2026-09-28-demo/README.md).

## Interaction and accessibility

- Semantic HTML, readable text, visible keyboard focus, named controls, 44px target convention, keyboard disclosures/tabs, reduced-motion support.
- Preserve drafts across views; only explicit reset clears its documented scope.
- Check 320–1920px, especially 320/390px and desktop; no unintended page overflow or obscured actions.
- Essential content/navigation is server rendered. Public routes stay public for signed-in/out users without the workspace sidebar.
- Public pages own opaque backgrounds; preserve `AuthGate`, `Backdrop`, and `(dashboard)` route ownership.
- Numeric charts need units, period, a plain-language takeaway, and inspectable values. Color alone cannot convey actual/planned or positive/negative meaning.

## Extending the accepted design

Research the relevant feature and adapt useful interactions without reopening unrelated art direction. New chart/messaging concepts remain proposals until implemented and checked.

For cash flow, distinguish actual movement, dated plans, estimates, cash, reserves, and unallocated money. Explain assumptions; optional AI must not generate numerical certainty.

For chat, use explicit linking and draft confirmation. Local code is distinct from real-channel rollout. See [LINE notes](../line-finance.md) and the [new feature proposal](2026-09-28-cashflow-research/proposal.md).

## Evidence and future retrieval

Existing artifacts were inspected for this spec; checks were not rerun solely for skill creation:

- [Landing validation](../validation/2026-09-28-meridian-landing/README.md).
- [Focus validation](../validation/2026-09-28-login-research/README.md).
- [Revised docs validation](../validation/2026-09-28-docs-research/README.md).
- [Demo validation/reproduction](../validation/2026-09-28-demo/README.md): production build, 5 arithmetic tests/25 assertions, interactions, responsive evidence, final console checks. Read the artifact for scope.

Retrieve [aegis-design-spec](/home/santapong/.codex/skills/aegis-design-spec/SKILL.md) for future Aegis work. Reusable explanation lessons live in [product-explanation-design](/home/santapong/.codex/skills/product-explanation-design/SKILL.md); implementation/browser recovery remains in [frontend-design](/home/santapong/.codex/skills/frontend-design/SKILL.md).

## Authenticated cash planning — implemented October 2, 2026

The owner authorized the first M0–M1 release after reviewing the cash-workspace plan. The implementation extends the accepted identity into `/cashflow`: opaque charcoal, Syne/Inter, original icon, amber actions and restrained teal. Separate personal/business scopes, dated cash/history/plans, exact values, source calendar, scenarios and payment matching are now locally verified against the actual API. The public landing/login remain their accepted designs. Decorative sidebar percentages and status claims are hidden on cash planning because they were not derived from its records.

Read the [release contract](../releases/2026-10-02-first-cashflow-release.md) and [validation](../validation/2026-10-02-first-release/README.md) before extending these flows. This records verified implementation, not a new owner art-direction acceptance, an independent usability study, or public feature deployment. The separate light-theme proposals still require selection.

### M2 everyday review — October 2, 2026, after M0–M1

The owner's request to continue to M2 extends `/cashflow` with durable CSV review, **Upcoming plans**, **Goals & installments**, and source-backed **Cash alerts**. Preserve the same identity and precise distinction between cash, buffer, reserved purpose and headroom. An invalid import row displays its source currency rather than being relabeled as workspace money. Reservations leave cash unchanged; linking an existing transfer creates no second movement. Reviewed schedule extensions preserve individual payment exceptions and matches.

The [M2 release guide](../releases/2026-10-02-m2-everyday-cash-review.md) and [dated execution evidence](../validation/2026-10-02-m2/README.md) describe tested behavior and local examples. M2 is locally verified; independent review, remote CI and owner/customer task feedback remain pending. No additional visual acceptance, light-theme selection, bank connection, external alert delivery or public feature rollout is implied.

### Business review and explicit LINE destination — October 2, 2026

M3 extends the same authenticated cash surface with **Business review**: receivables/bills, partial settlement and credits, thirteen calendar weeks with daily lows, and immutable saved-forecast review. M4.1–M4.2 adds a scoped **Settings → LINE finance** destination chooser: owned THB workspace/account, explicit confirmation, stale-draft explanation and truthful setup/delivery status. Existing public pages and global tokens remain intact; no renewed art direction or light-theme selection occurred.

The [execution evidence](../validation/2026-10-02-all-m/README.md) and [completion audit](../validation/2026-10-02-all-m/completion-audit.md) identify exact local tests, browser sizes, migration/restore proof and source manifests. These establish observed implementation, not independent owner comprehension, real LINE delivery or deployment. Retrieve [cash integration checks](/home/santapong/.codex/skills/aegis-design-spec/references/cash-integration.md) for the verified recovery procedure.
