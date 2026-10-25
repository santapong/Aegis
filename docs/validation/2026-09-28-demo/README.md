# Aegis demo validation — 28 September 2026

Implementation: [design and scope](../../design/2026-09-28-demo/README.md). Local checkout `agent/comet-asset-prompt`, base `e2c4a9c`, with pre-existing uncommitted landing/login/docs and unrelated LINE/backend work preserved.

## Checks

- Final `bun run build`: passed, including type checks and 39 generated pages. See `build.log`; existing Node deprecation messages remain warnings.
- `bun test docs/validation/2026-09-28-demo/scenarios.test.ts`: **5 passed**, 25 assertions. Separate recorded/planned amounts, business shortfall, personal remainder, added expense/category isolation, decimals and immutable fixtures. See `calculations.log`.
- Desktop Chromium: changing income date updates totals, chart and plan date; positive expense submission updates records and the matching budget; zero is blocked by native validity. Personal expense of 4,000 yields 6,400 used of a 6,000 budget with explicit over-budget feedback. Story switching preserves changes; resetting restores the current story. Keyboard arrows switch the record tabs; submit returns focus to Add sample expense.
- A production first-load hydration error was reproduced in development. The detailed diff pointed to an SVG `<title>` containing an array of text/value children. Changed it to one interpolated string, then checked a clean page reload: no new hydration error. Evidence: `hydration-before-fix.json`, `dev.log`. This does not establish the cause of the previous documentation task's historical warning.
- Phone visual review: increased chart-axis text size and moved delayed income after October commitments. Hosting section labels distinguish the proposed service from supported self-hosting.
- Final production reload and interactions: no new browser errors (`console-final.json`). Confirmed default Business X remainder 88,000 and delayed remainder -2,000. Personal draft description/amount survive story switches, submitting 600 updates its budget to 3,000 of 6,000, and submission focus returns to the add control. Native calculation disclosure opens by Enter; mobile navigation closes on Escape and restores focus. Setup link reaches the actual local-setup article; its header returns to the demo.
- Responsive checks at 320, 390, 768, 1024, 1440 and 1920 pixels: no horizontal document overflow (`responsive.json`). Header keeps its expected 77/89-pixel height. Inspected desktop screenshots and the phone story/delayed-income state; desktop/phone evidence files were refreshed after the fix.
- Read-only HTTP checks: demo, landing, docs and login return 200 with one server-rendered H1 and valid ARIA label targets (`routes.json`). Reran existing 12-route documentation/anchor/CSV-download checks successfully. `git diff --check` passed. These server-HTML checks do not claim a JavaScript-disabled browser session.

## Reproduction and boundaries

The final preview is hosted locally at <http://127.0.0.1:3098/demo> by the task-owned `aegis-meridian-preview.service`, from `/tmp/aegis-demo-final-runtime-2026-09-28`. Build sequentially, copy standalone output and static/public assets to a fresh directory under `/tmp`, then update that service. Keep the live runtime outside `.next`. Temporary development port 3101 was stopped before the final build.

No real account or backend database was seeded or changed. Demo amounts and people are fictional; no external provider, banking or payment calls are involved. This validates the public demo interactions, not authenticated app behavior, a paid hosted launch, deployment security, business accounting or customer comprehension. Nothing was committed, pushed or publicly deployed.

## Reusable learning

Recorded the verified SVG-title hydration recovery in `/home/santapong/.codex/skills/frontend-design/references/verification.md`, using the existing skill-creator guidance. The frontend skill already links that verification reference, so future frontend checks retrieve it. Packaging validation passed; no independent cross-project effectiveness claim. Backup: `/home/santapong/.codex/learning/backups/frontend-verification-2026-09-28-aegis-demo.md`.
