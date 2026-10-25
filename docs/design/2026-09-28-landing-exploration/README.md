# Aegis landing exploration

Created 2026-09-28 in response to the owner's request to create the structure first, find more websites, and explore the DravenIQ theme or Aegis identity. This is a local research/design artifact. It does not replace the existing `/landing` implementation.

## Review

- `index.html`: responsive board with content structure, three composition studies, working sample selections, and ten reference cards.
- `01-structure.md`: audience, primary action, question-led architecture and content boundaries; drafted before reference research.
- `02-references.md`: dated source matrix, observed patterns, adaptations, limits and capture coverage.
- `03-directions.md`: three distinct narratives, visual identities, complete page sequences, interactions and recommendation.
- `reference-notes.json`: compact curated observations used in the board.
- `reference-observations.json`: raw browser collection record; see the research matrix for partial captures and failures.

Open `index.html` directly, or serve this directory:

```sh
python3 -m http.server 3099 --bind 127.0.0.1 --directory /mnt/data/company/apps/Aegis/docs/design/2026-09-28-landing-exploration
```

Then open <http://127.0.0.1:3099/>. The board has no package installation, remote font, network API or build requirement. Typography uses system fallbacks; the source documents identify the intended application typefaces. The Aegis icon was copied unchanged from `frontend/src/app/icon.png`. Website screenshots remain reference evidence and are not proposed production assets.

## Verification

`validation/checks.json` records 60 passing assertions in visible Brave/Chromium 152: all three directions at 320, 390, 768 and 1440px; document and headline overflow; event, horizon and goal selections; arrow/End keyboard tab behavior; reference disclosure; local asset responses; no runtime errors; all directions and references readable with JavaScript disabled. The test run emulated reduced motion.

Rendered desktop and 390px composition screenshots were visually inspected. This caught missing spaces where desktop line breaks were hidden on mobile; HTML spacing was corrected and the checks/screenshots rerun. Initial document-width checks alone had not detected the text clipping inside an overflow-hidden panel.

This is not a full accessibility certification, third-party website interaction test, conversion result, account-flow test or browser-engine compatibility claim. Mock account actions are explicitly labeled placements. Sample amounts and conceptual art are not a live financial account. Existing application validation belongs to `docs/validation/2026-09-28-landing/` and was not rerun for this standalone artifact.

## Recommended next direction

**A — Aegis Meridian** was selected by the owner on 28 September 2026. The implementation decision is recorded in `../009-meridian-landing.md`; the working local application preview is <http://127.0.0.1:3098/landing>. B and C remain historical alternatives. This board stays available separately on port 3099 for comparison.

The board's preview is now served by the transient user service `aegis-landing-board.service`. The original execution-cell server was no longer listening when the owner returned; why it exited was not established. The user-service recovery was verified active with HTTP 200 in the following turn and rechecked during Direction A implementation. Inspect live service state before relying on this dated checkpoint.
