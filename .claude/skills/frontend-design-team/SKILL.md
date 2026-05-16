---
name: frontend-design-team
description: Coordinate a specialized frontend design team (Design Lead, Visual Designer, Design-System Steward, UI Engineer, Motion Designer, Accessibility Reviewer, Copy Writer, Visual QA) to redesign or extend Aegis frontend pages, themes, and components. Trigger when the user asks to "redesign", "restyle", "reskin", "build a new theme", "improve the design", "polish the UI", or hands off a Claude Design (claude.ai/design) bundle. Also trigger for design polish — typography, palette, spacing, motion, accessibility microcopy — anything where visual coherence and design-system fidelity matter more than raw feature work. **Boundary with multi-agent-orchestration**: this skill owns work where the deliverable is a *visual / design-system change*; the other owns work where the deliverable is a *feature with new behavior*. When a request blends both (e.g. "build the trips detail page with the galaxy treatment"), invoke multi-agent-orchestration as the parent and have it spawn a Design Lead from this skill's roster.
---

# Aegis Frontend Design Team

This skill turns a frontend / design request into a **coordinated, parallel pass** by a small team of design-focused sub-agents (spawned with the `Agent` tool) instead of one linear thread. It is the design-side counterpart to `multi-agent-orchestration` — that skill orchestrates *features*; this one orchestrates *design*.

Use it whenever the work is visual, typographic, structural, or system-level — including taking a Claude Design (`claude.ai/design`) handoff bundle and turning it into pixel-faithful production code.

---

## When to invoke

Trigger this skill when the user asks for:

- **Theme work** — new palette, new theme, palette tuning, dark/light variants, multi-theme switching
- **Page redesigns** — "redesign /dashboard", "the login page needs the new look", "make /settings feel like the rest"
- **Design-system work** — new primitive, new card variant, new KPI tile, new chart style, new icon set, token cleanup
- **Polish passes** — typography ramp, spacing scale, motion / micro-interactions, hover states, focus rings
- **Accessibility passes** — contrast, keyboard navigation, screen-reader labelling, reduced-motion paths
- **Design handoff** — the user pasted or fetched a `claude.ai/design` URL, an HTML/CSS/JSX mockup, or a Figma export and wants it implemented
- **Copy / content polish** — eyebrow chips, microcopy, empty states, error messages, button labels

Skip this skill for one-off CSS tweaks, pure logic / backend work, or feature work where the visual direction is already settled (just a new route in the existing look) — use plain edits or `multi-agent-orchestration` instead. **Rule of thumb**: if the request changes how Aegis *looks*, design-team. If it changes what Aegis *does*, orchestration. If both, orchestration is the parent and pulls in design-team roles via its UX Reviewer slot.

---

## The team (role catalog)

Each role maps to a sub-agent invocation. Pick the smallest set that covers the work; for a small polish pass, 2–3 roles is enough.

| Role | Subagent | Owns | Reads |
|------|----------|------|-------|
| **Design Lead** | `general-purpose` | Translates user intent into a one-page design brief (goal, palette, typography, geometry, motion, references). **Always first on multi-area design work.** Final-call arbiter when other roles disagree. | Handoff README, existing `globals.css`, recent design decisions |
| **Visual Designer** | `general-purpose` | Palette (hex + oklch), type ramp, spacing scale, card geometry, decorative motifs, illustration / SVG showpieces (orbital chart, black hole, constellation lines). Outputs token sets, not code. | The handoff CSS / JSX, the Aegis brand vocabulary |
| **Design-System Steward** | `general-purpose` | **Sole owner** of `frontend/src/app/globals.css` and `components/shell/*`. Owns the token map (`--void` / `--pane` / `--accent` / `--display-*` / `--card-radius` / `--hero-glow`), keeps the `.theme-*` blocks coherent, prevents drift. **Shared read-access** to `components/ui/*` — refactors there require sign-off from the relevant UI Engineer who maintains the primitive. Refuses changes that bypass tokens. | The visual designer's token sheet, current Tailwind v4 `@theme inline` block |
| **UI Engineer** | `general-purpose` | Translates the design into React + Tailwind + recharts. Owns route-level page implementations under `frontend/src/app/<route>/page.tsx` and the shadcn primitives in `components/ui/*`. Reuses `components/shell/*` primitives — does not modify them or invent new ones without the Steward's sign-off. | Design brief, token sheet, existing page being reskinned, the prototype JSX (read for structure, never copied verbatim) |
| **Motion Designer** | `general-purpose` | Keyframes, transitions, micro-interactions, framer-motion variants in `frontend/src/lib/animations.ts`, SVG `<animateTransform>` choreography (e.g. the Supernova black hole), reduced-motion fallbacks. | Existing animations, the `prefers-reduced-motion` clause in `globals.css` |
| **Accessibility Reviewer** | `general-purpose` | WCAG contrast ratios on every theme/token pair, focus rings, keyboard tab order, ARIA labels, `prefers-reduced-motion` paths, screen-reader text on icon-only buttons. Outputs a punch list, not a diff (hands fixes back to the UI Engineer). | The implemented diff |
| **Copy / Content Designer** | `general-purpose` | Eyebrow chips, page subtitles, empty states, error toasts, tooltip text, the 3-letter card codes (`DSH` / `HLT` / `BDG` / …), button labels, microcopy. Owns the Aegis voice (terminal-restrained, no exclamation marks, mono for chrome, serif for display). | Existing copy across pages |
| **Visual QA / Critic** | `general-purpose` | Independent eye. Runs the build, walks every theme through every touched page, compares against the handoff prototype, files a punch list with `route:component` references. Never the same agent that implemented the page. | The implemented diff, the handoff bundle, all three themes |
| **Explorer** | `Explore` | Read-only — "where is `<Card>` defined", "what calls `formatCurrency`", "every place that hard-codes a color". Cheap, use liberally before spawning implementers. | The codebase |
| **Planner** | `Plan` | Architectural plan for a token rework, a new shell component, or a multi-page rollout sequence. Used before kicking off the team. | The brief + codebase summary |

---

## Orchestration patterns

### Pattern A — Handoff implementation (Claude Design bundle)

The flow used to ship the galaxy theme rollout. Use whenever the user hands you a `claude.ai/design` URL or a similar bundle.

1. **Main thread**: fetch + extract the bundle, read its `README.md` and chat transcripts so the *intent* is clear before any agent is spawned.
2. **Design Lead**: produce a one-page brief — themes / pages / signature components, what to extend vs. replace, file map onto the existing repo.
3. **Planner** (1 agent): writes the implementation order — typically tokens → backdrop / shell → sidebar → page reskins → showpiece (black hole) → auth/public pages.
4. **Design-System Steward + UI Engineer** in parallel (single message, two `Agent` blocks): Steward ports tokens + shell components; UI Engineer rewrites the public-facing pages that don't auto-theme via the token redirect.
5. **Motion Designer** (1 agent, after Steward done): wires keyframes and reduced-motion fallbacks for any new animated elements (e.g. the black hole, the blinking caret, the starfield twinkle).
6. **Accessibility Reviewer + Visual QA** in parallel after implementers report done.
7. **Main thread**: integrate feedback, `npm run build`, commit, push, open **draft PR**.

### Pattern B — Page redesign (single route)

E.g. "redesign /transactions".

1. **Explorer** (1 agent): map every component the page uses, every CSS class, every recharts piece.
2. **Visual Designer + Copy Designer** in parallel: designer drafts the visual treatment; copy designer rewrites labels / eyebrow / empty state.
3. **UI Engineer**: implements.
4. **Visual QA** validates against the design brief.

### Pattern C — Design-system token cleanup

E.g. "the palette is drifting, consolidate".

1. **Explorer** (1 agent): grep for every hard-coded hex / `rgb()` / `oklch()` outside `globals.css`.
2. **Design-System Steward**: rewrites the token map, refactors offenders to use vars.
3. **Visual QA**: verifies all three themes still render correctly.

### Pattern D — Accessibility audit

1. **Accessibility Reviewer** (1 agent): full punch list with WCAG references.
2. **UI Engineer**: fixes mechanical issues (focus rings, ARIA labels).
3. **Design-System Steward**: fixes token-level issues (contrast on `--dim` against `--pane`, etc.).

---

## How to spawn the team (rules)

- **Parallelism rule**: if agent calls are independent, put them in a **single message with multiple `Agent` tool uses**. Sequential only when one consumes the other's output (e.g. Steward must finish before UI Engineer's page rewrite).
- **Token-first**: never let a UI Engineer drop a hex literal into a page. If a color isn't in `globals.css`, escalate to the Design-System Steward to add it. This is the single most common drift vector.
- **Reuse-first**: every UI Engineer prompt should remind them to reach for `components/shell/*` and `components/ui/*` primitives before writing new ones. Spawn the Explorer first to inventory what already exists.
- **Prototype is not code**: when working from a handoff bundle, the JSX / HTML files are *visual references*, never copied verbatim. Always include this caveat in the UI Engineer's prompt.
- **Independent QA**: the Visual QA / Accessibility Reviewer must be a different agent invocation than the one that implemented the diff. No self-grading.
- **Budget responses**: ask for short reports (≤ 200 words, "punch list", "route:component references") so the main thread's context stays clean.
- **Trust-but-verify**: after each agent reports done, read the actual diff before declaring success.

---

## Skeleton invocation (Pattern A — handoff implementation)

Step 1 — Design Lead drafts the brief (sequential, blocks the rest):

```
Agent(subagent_type="general-purpose", description="Design brief for <bundle>",
  prompt="You are the Design Lead for Aegis. The user handed off <bundle>.
          Read the bundle's README, chat transcripts, and main CSS file.
          Produce: (1) the themes / palette deltas, (2) the pages affected,
          (3) the new signature components, (4) what to extend vs. replace
          in the existing Aegis frontend, (5) implementation order.
          ≤ 400 words.")
```

Step 2 — Planner converts the brief into an ordered work list:

```
Agent(subagent_type="Plan", description="Implementation plan", prompt="...")
```

Step 3 — fan out implementers in one message (independent slices):

```
Agent(subagent_type="general-purpose", description="Tokens + shell", prompt="...")
Agent(subagent_type="general-purpose", description="Auth + landing pages", prompt="...")
Agent(subagent_type="Explore",         description="Inventory existing primitives", prompt="...")
```

Step 4 — Motion + Copy in parallel once shell is in place:

```
Agent(subagent_type="general-purpose", description="Motion keyframes", prompt="...")
Agent(subagent_type="general-purpose", description="Copy / eyebrow / empty states", prompt="...")
```

Step 5 — QA in parallel:

```
Agent(subagent_type="general-purpose", description="Accessibility audit", prompt="...")
Agent(subagent_type="general-purpose", description="Visual QA — 3 themes × N pages", prompt="...")
```

Step 6 — main thread integrates, runs `npm run build`, commits, pushes, opens **draft PR**.

---

## Aegis-specific conventions (the team must respect)

1. **Theme via `.theme-*` class on `<body>`.** Three production themes — Observatory (default), Constellation, Supernova. Switching lives in **Settings → Appearance**, never in a developer Tweaks panel.
2. **Tokens in `frontend/src/app/globals.css`.** Tailwind v4 `@theme inline` block — adding a token means appending `--color-foo: var(--foo)` there and defining `--foo` per theme.
3. **Token redirect strategy.** Legacy `--background` / `--card` / `--primary` / `--aegis-*` names re-map onto the cosmic tokens (`--void` / `--pane` / `--accent` / …) so existing pages auto-theme. New code targets the cosmic names; legacy aliases stay only for backward compatibility.
4. **Galaxy primitives live in `frontend/src/components/shell/`.** Current set: `<Backdrop />`, `<BlackHole />`, `<ConstellationLayer />`, `<CodeChip />`, `<GalaxyCard />`, `<Kpi />` (also exports `KpiGrid`), `<PageHead />`, `<PulsingDot />`, `<Sparkline />`, `<CosmicChart />`. Extend these — don't fork them. The full source-of-truth list is whatever is exported from that directory at the time of the change.
5. **Signature components.** Every card gets a 3-letter `<CodeChip>` at the top (DSH / HLT / ALT / SPD / TRD / INS / BDG / SAV / INV / DBT / PAY / CAL / GNT / RPT / DOC — non-exhaustive, see usages of `code-chip.tsx`). Every page gets a `<PageHead>` with eyebrow + pip + display title.
6. **Display font is theme-bound.** `var(--display-font)` + `var(--display-style)` + `var(--display-weight)` + `var(--display-tracking)`. Geist sans for Observatory; Instrument Serif roman for Constellation; Instrument Serif italic for Supernova. Never hard-code a font-family.
7. **Charts use recharts** with `stroke="var(--accent)"` etc. — never hex literals (exception: user-content colors like a savings goal's color-picker hex). Donut, area, bar, line, radial all have direct recharts equivalents.
8. **Animations**: prefer CSS keyframes in `globals.css` for ambient / decorative motion (twinkle, plume drift, pulse-glow, blinking caret). Use `framer-motion` for interactive overlays + reveals (modals, toasts, dropdowns, the sidebar drawer, page-mount staggers via `staggerContainer / staggerItem` in `lib/animations.ts`). The black hole uses SVG-native `<animateTransform>` (no JS frame loop) and reads `matchMedia('(prefers-reduced-motion: reduce)')` at mount to omit them when needed.
9. **Reduced-motion is non-negotiable.** Every keyframe needs a `@media (prefers-reduced-motion: reduce)` fallback. SVG SMIL animations (`<animateTransform>`) cannot be neutralized via CSS — guard them at the component level via `matchMedia`.
10. **Don't ship a developer Tweaks panel.** End-user theme switching only — engineering toggles (starfield opacity, twinkle) gate behind `process.env.NODE_ENV !== 'production'`.
11. **className composition uses `cn()`** from `@/lib/utils` (clsx + tailwind-merge). Never concatenate class strings by hand or with template literals.
12. **Shared animation variants live in `@/lib/animations`** — `fadeIn`, `slideUp`, `staggerContainer`, `staggerItem`, etc. Don't redefine them per file.

---

## Output checklist (every design orchestration ends with this)

- [ ] Design Lead brief embedded in the PR description.
- [ ] Tokens added to `globals.css` (not inline hex literals anywhere).
- [ ] Every new card uses `<CodeChip>` + `<PageHead>` pattern.
- [ ] All three themes render the touched pages without visual regression.
- [ ] `npm run build` green; no React hydration warnings; no recharts axis-fill complaints.
- [ ] Accessibility punch list resolved or filed as follow-ups in `ROADMAP.md`.
- [ ] Motion respects `prefers-reduced-motion`.
- [ ] Draft PR opened on the branch named in the active session's system instructions, with a role-by-role section in the body.

---

## Anti-patterns

- ❌ Letting the UI Engineer drop a hex literal into a page — always escalate to the Steward. (Exception: user-content colors, like a savings-goal color picker.)
- ❌ Copying prototype JSX verbatim — the bundle is a visual reference, not production code.
- ❌ Spawning a single mega-agent to "redesign everything" — fan-out is the whole point.
- ❌ Reskinning a page without first reading the page's existing react-query / data hooks — the team only changes presentation, not data flow.
- ❌ Adding a fourth theme without consulting the Design Lead — three themes is a deliberate cap.
- ❌ Inventing a new primitive (e.g. yet another card variant) when an existing one in `components/shell/` works. Reach for the Steward instead.
- ❌ Skipping the Visual QA pass on a multi-theme change.
- ❌ Self-reviewing — the implementer never QAs their own diff.
- ❌ Concatenating className strings by hand instead of using `cn()` — breaks tailwind-merge dedup and produces conflicting utilities silently.
- ❌ Importing `framer-motion` into a Server Component — it requires `"use client"`. Wrap or hoist the motion piece into a child client component instead.
- ❌ Bypassing the design-system: writing a one-off `style={{ color: "#5ad8ff" }}` instead of `style={{ color: "var(--accent)" }}`. Any color that should change with the theme is a token, not a literal.
