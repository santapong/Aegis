# Cash-flow research board and skill validation

Checked 2026-09-28, Asia/Bangkok. This task changed design/research documentation and local skills, and added a standalone HTML concept board. It did not change app/frontend/backend code or deploy/connect any chat channel.

## Checks actually performed

- Both new skill packages pass skill-creator's `quick_validate.py`. Existing `frontend-design` gained one scoped retrieval link; its previous content is backed up. Markdown file links in both skills, their references, the canonical spec, and the proposal resolve locally.
- Static board script parses. Four scenario totals match known expected values: Business X original cash/after reserve 98,000/88,000; delayed 8,000/-2,000; personal original 48,900/43,900; delayed 40,900/35,900. Checked that reserve allocation never increases unallocated money and the delayed Business X cash first falls below its 10,000 buffer on 26 October. See `calculations.json`.
- Visible browser: changed stories, toggled delay, switched cash/after-reserve views, checked derived labels/agenda, preserved each story's delay when switching, and activated Reset by keyboard. Personal reset returns 48,900/43,900.
- Calculation disclosure opens/closes by Enter and exposes event values. Business delayed state keeps 8,000 cash distinct from -2,000 after reserve. Delayed income remains visible on 5 November outside the October period.
- Desktop and phone visual inspection: `desktop.png`, `mobile.png`. Increased chart type size after the first phone review and added a horizontal-scroll hint; charts deliberately scroll within their own regions on narrow screens. Body has no horizontal overflow at 320 and 390px (`responsive.json`); final 390px check after the typography change also showed none.
- No captured warning/error logs on the final local board check (`console.json`). HTTP 200 for the preview. `git diff --check` passes.

## Limits

This validates a review concept, not a production forecast engine, real bank balance, customer comprehension study, release, or external chat integration. No existing app build/test suite was rerun because app source was unchanged. Skill validation is structural plus manual scope review; no independent agent benchmark was run.

## Preview

Local board: `http://127.0.0.1:3102/`, task-owned user service `aegis-chart-research-preview.service`, Python static server bound to loopback, serving only `docs/design/2026-09-28-cashflow-research`. The accepted app remains at port 3098. Recheck process/port state before resuming. Preview uses Google Fonts with local system fallbacks; its icon is copied from the existing Aegis asset. No extra app dependency was installed.

## Learning

Owner acceptance and scoped lessons are recorded in the new [canonical spec](../../design/012-aegis-design-spec.md), [Aegis skill](/home/santapong/.codex/skills/aegis-design-spec/SKILL.md), and [general explanation skill](/home/santapong/.codex/skills/product-explanation-design/SKILL.md). See the [learning record](/home/santapong/.codex/learning/records/2026-09-28-aegis-design-and-explanation.md) for evidence, limits, and rollback.
