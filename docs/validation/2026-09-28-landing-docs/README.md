# Landing clarity and public Documentation — 2026-09-28

Implemented the owner's request for a clearer visitor experience, updated header, and Documentation page. Kept the approved Aegis Meridian direction and Focus sign-in. [Decision and source grounding](../../design/011-landing-clarity-and-documentation.md). [Visual review with before/after captures](audit.md).

## Checked

- `build.log`: one sequential production build, successful exit 0, lint and TypeScript passed.
- `checks.json`: 32 passing current-run assertions in the visible Codex in-app browser. No failing assertions.
- Landing and docs at 320, 390, 768, 1024, 1440 and 1920 CSS pixels: no document overflow or measured heading/code/table/header clipping.
- Shared header navigation, active docs state, mobile open/close, Escape and focus return, mobile contents keyboard disclosure, FAQ keyboard behavior, existing anchors, anchor placement below the sticky header.
- Actual landing → first-month guide, docs → landing, AI explanation → relevant docs section, docs → login → docs routes.
- Preserved sample timeline/calendar, selected-plan retention and goal selector.
- Original icon loads. Desktop and mobile screenshots inspected (01–10 files); existing Focus login form remains available.
- `ssr-checks.json`: HTTP 200 and meaningful content outside scripts/styles in server HTML for landing/docs/login. No separate no-JavaScript browser session in this run.
- `git diff --check` passed.

## Boundaries

No new dependency, account action, real authentication, backend execution, Docker setup, provider request, public deployment, commit or push. Guide instructions checked against current source; they are not evidence that a fresh install was executed. No claim of customer testing or complete accessibility compliance. Unrelated LINE work remains unchanged.

Docs are now a public server-rendered route using the marketing header for all visitors. Changelog retains the authenticated-app-shell behavior. The approved login files were not edited in this task.

## Preview

- Landing: http://127.0.0.1:3098/landing
- Documentation: http://127.0.0.1:3098/docs
- Sign-in: http://127.0.0.1:3098/login
- Service: `aegis-meridian-preview.service`, transient user service.
- Current runtime: `/tmp/aegis-landing-docs-runtime-2026-09-28`, copied only after successful build completion. Runs outside `.next` to avoid the established FUSE/native-library build-cleanup conflict.
- Previous runtime retained at `/tmp/aegis-focus-runtime-2026-09-28`.

The screenshot review uses actual local rendered pages. No additional third-party inspiration study was needed for these bounded improvements to the already selected direction.
