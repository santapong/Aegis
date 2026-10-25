# Meridian landing — local verification

Date: 2026-09-28. Checkout: `agent/comet-asset-prompt`, based on `e2c4a9c`, with pre-existing LINE integration and first-draft landing changes. Direction A was explicitly selected by the owner. This report verifies the subsequent local implementation, not a release or owner acceptance of every final detail.

## Result

The `/landing` route now follows Aegis Meridian: unchanged Aegis icon, Syne/Inter typography, charcoal canvas, amber actions and teal product examples. The page follows one month into Record / Arrange / Review, longer goals, optional AI explanations, ownership, FAQ and registration. All demos are labeled illustrative and make no financial mutations or AI requests.

Calendar and Timeline share the same events and selected-event context. The example correctly distinguishes completed calendar plans from upcoming contributions and separately recorded transactions. The export copy matches the implemented CSV and transactions/plans/budgets NDJSON endpoints. The existing public AuthGate and dashboard route-group SSR fix from the first draft remain in place.

## Verification evidence

- `build.log`: production build, lint and TypeScript validation passed on Next.js 15.5.12 / React 19 / Node 24.19.0. `/landing` is statically prerendered; the build reports 117 kB first-load JS. This is a build estimate, not a measured device performance result.
- `browser-checks.json` and `browser-checks.log`: 70 passing assertions in visible Brave/Chromium 152.0.7977.83.
- Both Calendar and Timeline at 320, 390, 768, 1024, 1440 and 1920 CSS pixels: no unintended document/heading overflow, visible sample buttons at least 44px in both dimensions.
- All three goal choices at all six widths; correct progress amount/target; rent/savings detail changes; selected event preserved across views; keyboard Home and arrow tab behavior.
- Mobile navigation open/close, Escape focus restoration, close-on-anchor navigation; all five native FAQ disclosures exercised by keyboard.
- Registration, sign-in, docs and changelog destinations rendered, and signed-out `/` returned to `/landing`. No account creation, authenticated backend operation, transfer or external AI call was exercised.
- Header/footer images decoded after entering the viewport. The initial image check incorrectly treated an off-screen lazy image as a load failure; scrolling it into view and waiting for decoding established the actual behavior.
- Reduced-motion emulation; no canvas and no running decorative animations in the checked state.
- Production page with JavaScript disabled and external requests blocked: visible headline and sample month; native FAQ works. Interactive examples remain static in that mode.
- Desktop, tablet and mobile screenshots visually reviewed. The final opening was shortened so the continuation strip appears sooner. `full-page.png`, `desktop-final.png`, viewport and section images capture the resulting composition.
- `git diff --check` passed. React/Next review: server-rendered content, local client state limited to navigation and examples, no new dependencies, no request waterfall or effect-driven derived state.

Not tested: Safari, Firefox, physical mobile hardware, native 200% text zoom or 400% browser zoom, production hosting origin, authenticated account workflows, server-side AI and export execution. This is not an accessibility certification or a conversion result. Independent release review and remote CI remain shipping gates; no push, merge, tag or deployment occurred.

## Running preview

Local URL: <http://127.0.0.1:3098/landing>.

The transient user service `aegis-meridian-preview.service` runs the standalone snapshot from `/tmp/aegis-meridian-runtime-2026-09-28`. It is separate from the design board's `aegis-landing-board.service` on port 3099. These are local review services, not enabled boot-time deployments. Recheck service state before relying on this dated record.

```sh
systemctl --user status aegis-meridian-preview.service --no-pager
curl -I http://127.0.0.1:3098/landing
```

To stop this task's preview:

```sh
systemctl --user stop aegis-meridian-preview.service
```

To build another snapshot, run the production build from `frontend/`, copy `.next/standalone/` into a fresh task-owned runtime directory outside `.next`, copy `.next/static/` into that runtime's `.next/static/`, and copy `public/` into its `public/`. Start `server.js` there with `HOSTNAME=127.0.0.1` and `PORT=3098`, after checking that the port and chosen user-service name are available. Keep source files editable in `frontend/src/app/landing/`; the runtime is generated output.

## Rebuild recovery observed in this task

The initial preview ran from `.next/standalone`. A second build paused before compilation. Inspection found only `.fuse_hidden*` files beneath the generated Sharp and libvips directories; the repository filesystem reported `fuse`. Next's cleanup was waiting while the preview held those native libraries open. Stopping the task-owned preview immediately let the same build proceed; it completed successfully. The final runtime was copied outside `.next` and then passed all browser checks.

The supported recovery is to separate build output from the running preview, and to stop only the verified owner of held generated files when needed. The evidence does not establish a general diagnosis for unrelated build stalls. There was no deletion of user source or change to framework/build checks.

This scoped procedure was added to `/home/santapong/.codex/skills/draveniq-theme/references/release-checklist.md`, linked by the skill entrypoint. Backup: `/home/santapong/.codex/learning/backups/2026-09-28-aegis-meridian/release-checklist.md`. Skill structural validation passed; the runtime checks above are separate execution evidence. No canonical theme asset or token was changed.
