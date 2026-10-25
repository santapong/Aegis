# Researched Aegis documentation — 28 September 2026

Local implementation on `agent/comet-asset-prompt`, based on `e2c4a9c` plus existing uncommitted work. No commit, push or public deployment. Reference study and owner correction: [research](../../design/2026-09-28-docs-research/references.md).

## Delivered

- Public, server-rendered documentation home; six everyday-use articles and three developer articles, each with its own URL and metadata.
- Two audience collections, local search by topic/error, desktop collection navigation and article contents, native mobile contents and help disclosures.
- Concrete form values, numbered instructions, expected outcomes, CSV download, copyable API requests/responses, configuration and troubleshooting.
- Existing legacy topic hashes redirect to matching articles. Landing documentation links now target the specific guides. Accepted Meridian landing and Focus login design remain intact.

## Checks actually run

- `bun run build`: passed with TypeScript/static generation; final output in `build.log`. The log includes existing Node deprecation warnings.
- Isolated backend examples: **2 passed**, `examples.log`. These use disposable in-memory SQLite through existing repository fixtures. Checked missing/invalid authentication, bearer access independently of cookies, empty and populated lists, transaction creation, filtering/pagination, amount/limit validation and the actual downloadable CSV preview/confirmation. No customer database or external provider call.
- Read-only HTTP checks: **12 routes return 200**, one rendered H1 each, article sections present, internal documentation anchors valid, example download matches source, unknown article returns 404. See `routes.json`.
- Visible Chromium: both audience cards and collections, CSV/401/calendar searches, no-result state, Escape and Clear, keyboard Tab/Enter result navigation, CSV/API copy values, native FAQ opened with Enter, phone header open/Escape with focus return, article deep links and legacy `#optional-ai` redirect.
- Widths 320, 390, 768, 1024, 1440 and 1920: no document horizontal overflow on the hub or API article; saved measurements in `responsive-home.json` and `responsive-api.json`. At 320, search results stayed within the viewport. Desktop and phone anchor targets cleared the sticky navigation.
- Visual inspection found missing ordered-list markers caused by the CSS reset; explicitly restored decimal markers, rebuilt and verified the numbered mobile steps. Saved final corrected `03-first-expense-mobile.png` and `05-numbered-steps-mobile.png`.
- One hydration error was retained in the old tab history during the preview replacement sequence (09:18:55 UTC). No new error appeared on subsequent clean reloads; a fresh page session loading the hub and developer collection reported no console errors. Cause of that one historical event is not established.
- `git diff --check`: passed. All seven linked repository source paths exist locally; their remote HEAD availability was not asserted.

## Preview and rerun

Preview: <http://127.0.0.1:3098/docs>, provided by user service `aegis-meridian-preview.service`, with the final standalone build copied to `/tmp/aegis-docs-researched-final-runtime-2026-09-28`. Keep the live runtime outside `.next` and run builds sequentially.

From the repository root:

```sh
python3 docs/validation/2026-09-28-docs-research/check_routes.py
backend/.venv/bin/python -m pytest -q docs/validation/2026-09-28-docs-research/test_examples.py
```

## Limits

No fresh Docker installation, real-account financial workflow, external AI request, production deployment or human comprehension study was performed. The self-host instructions were checked against current scripts/configuration; illustrative UI values are teaching examples, not screenshots of saved customer records. Search covers curated article metadata, keywords and section titles. Owner acceptance remains separate from these technical checks. Existing unrelated backend/LINE changes were preserved.
