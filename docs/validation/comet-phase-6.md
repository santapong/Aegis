# Comet Phase 6 validation

**Date:** 2026-08-13

**Implementation:** complete

**Physical-device sign-off:** pending device/browser access

This report separates checks that were actually observed from checks that need
external hardware. It must not be read as evidence for a device that was not
available.

## Automated and local evidence

| Check | Result |
|---|---|
| TypeScript | `tsc --noEmit --incremental false` passed |
| Production build | Next.js 15.5.12 generated 27/27 routes and exited 0 |
| Landing bundle | 119 KB first load after Phase 6 stabilization |
| Clean local runtime | `/landing` returned HTTP 200 after moving the production `.next` cache aside and starting Turbopack |
| Deterministic states | Normal, fixed-progress, reduced-motion still, and context-test URLs all returned HTTP 200 |
| Static review | Independent review found no blocker in restoration, still-mode, timing, cleanup, or reduced-motion paths |
| Integrated GPU available | Intel UHD Graphics 630, direct Mesa acceleration, OpenGL ES 3.2 capability |

The host GPU establishes that the development machine is a representative
integrated-GPU target. HTTP and build checks do not by themselves prove GPU
frame time; use the browser diagnostics below when a controllable session is
available.

## Repeatable capture states

Use these routes at a fixed viewport and DPR:

| Baseline | Route |
|---|---|
| Desktop still | `/landing?comet-still=0.5` |
| Mobile still | `/landing?comet-still=0.5` at `390×844` |
| Reduced motion | `/landing?comet-still=0.5&comet-reduced-motion=1` |
| Context recovery | `/landing?comet-context-test=1` |

`comet-still` clamps to `0..1`, renders exactly one fixed frame, disables
parallax, and never starts the animation loop. This makes screenshot diffs
stable instead of dependent on capture timing.

## Context-restoration evidence

The explicit test route calls `WEBGL_lose_context.loseContext()`, restores after
250 ms, and records lifecycle state on the canvas:

- `data-aegis-webgl-status="lost"` during loss
- `data-aegis-webgl-status="restored"` after scene reconstruction
- `data-aegis-context-restores="1"` after the first successful recovery

The recovery path recreates every shader, buffer, texture, vertex array, and
framebuffer through a new `CometScene`. It resets timing and parallax and then
resumes the correct mode: animation, deterministic still, reduced motion, or
hidden-tab pause.

## Frame-pacing evidence

Development builds publish one sample every 240 animation frames:

- `data-aegis-frame-average-ms`
- `data-aegis-frame-p95-ms`
- `data-aegis-long-frames` (intervals above 25 ms)

These values measure browser frame intervals, not GPU timer queries. Record the
attributes after at least 240 visible frames at desktop and mobile viewports.
Only introduce adaptive DPR, particle count, or bloom quality if repeated p95
measurements exceed the display's frame budget under otherwise idle conditions.

## Physical-device sign-off checklist

The following evidence remains intentionally unchecked because no browser-control
session or attached Android/iOS device was available:

- [ ] Store desktop, mobile, and reduced-motion screenshots from the fixed
  routes above.
- [ ] Record 240-frame diagnostics on the Intel UHD 630 browser session.
- [ ] Record the same diagnostics on one physical mid-range mobile device.
- [ ] Confirm the context-test route reaches `restored` in Chromium and
  Safari/WebKit where available.
- [ ] Confirm there are no shader, alpha, layout, or console regressions on the
  Vercel production deployment.

These checks are release sign-off, not missing renderer functionality. Never
replace them with guessed numbers or emulator-only claims.
