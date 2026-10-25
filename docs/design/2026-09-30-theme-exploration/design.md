# Aegis light and dark theme proposal

Date: 30 September 2026, Asia/Bangkok. Stage: **design review**, following the owner's request to design light/dark support first. No Aegis application source or user theme preference is changed by this preview.

## Recommendation

**Option 1 — Warm Ivory** is the recommended light companion to the accepted Meridian dark identity. Warm ivory page, white panels, dark green-charcoal text, amber actions, and deeper teal labels/charts. The soft canvas carries the warmth of the dark theme's text without making forms or financial values beige and low contrast.

**Option 2 — Cool Mist** uses cooler gray-white surroundings and blue-gray panels. It is a crisper alternative for long documentation/data sessions. It shares typography, amber buttons, deeper amber foregrounds, teal, and layout with Option 1.

Both use the same Meridian dark counterpart. Options change the light palette, not the product structure. Owner acceptance of the September 28 baseline remains intact; neither light option is accepted yet.

## Semantic colors

Exact proposed values are in [tokens.json](tokens.json). Use colors by role rather than inverting every existing hex value.

| Role | Warm Ivory | Cool Mist | Dark baseline |
| --- | --- | --- | --- |
| Page | `#F6F4EE` | `#F3F6F7` | `#0A0C0E` |
| Main panel | `#FFFFFF` | `#FFFFFF` | `#101317` |
| Recessed/secondary | `#EEEEE6` | `#E8EEF0` | `#14181D` |
| Text | `#1C2625` | `#172629` | `#EDE7DC` |
| Supporting text | `#586461` | `#526268` | `#B5BBB9` |
| Amber button / text | `#E8913C` / `#181D20` | same | same |
| Amber foreground/chart | `#995012` | same | `#E8913C` |
| Readable teal | `#245B61` | same | `#8EB9AA` |

Keep bright amber as a filled action with dark text. On light backgrounds, use deeper amber for small labels, chart strokes, and focus rings. Use deeper teal for readable links and income/selection detail. Pale tint, outline, dash, and labels complement color so it is never the only distinction. Decorative separators can be subtle; input/interactive boundaries require stronger contrast.

Original `icon.png` pixels are preserved. On light pages the icon remains in its existing quiet dark tile; no recolored or newly drawn logo is proposed. Syne, Inter, and JetBrains Mono retain their roles. Preview fonts use Google Fonts with system fallbacks.

## Surfaces represented

- **Landing:** accepted heading, plain definition, amber action, fictional dated plans, Record/Arrange/Review hierarchy. The smaller theme-study layout preserves the organizing structure; it is not an exact full-page clone.
- **Aegis Focus sign-in:** centered form, original icon, quiet orbital lines, distinct field/control boundaries, readable inline error and loading states. The preview does no authentication.
- **Docs:** distinct everyday/developer paths, selected navigation, search field, code and explanatory note. Search only filters the two review cards; actual app search remains unchanged.
- **Money plan:** balances, planned/actual lines, late-income comparison, reserve explanation, budget, and a draft field. This remains a feature concept, not a shipped forecast engine. Dates/values are fictional and match the September 28 story.

HTML previews are interactive design aids; they do not replace actual routes or handlers. They expose missing state/color decisions more clearly than a single image draft.

## Proposed production behavior

Provide **Light / Dark / System** in the shared header and Appearance settings. Explicit selection takes priority; System follows device preference. Apply a saved explicit choice before the first paint, then keep changes synchronized. Handle unavailable browser storage gracefully. Theme changes preserve typed values, selected views, search, dialogs, and scenarios.

Appearance mode should be separate from visual identity. Current source inspection found the app stores five named cosmic identities and migrates legacy light/dark values to those names; public routes currently define a fixed dark appearance. Do not reuse that migration to collapse an existing saved identity into a new light/dark value. A future implementation needs a deliberate mode field/migration and semantic token mapping for every supported identity, or an explicit narrower Meridian scope agreed with the owner.

Theme the actual header/mobile menu, overlays, dialogs, inputs, native controls, empty/populated content, selected/disabled/loading/error states, code blocks, tooltips, charts, and focus. Keep readable static fallbacks and reduced motion. No decorative WebGL is required.

## Reference and asset provenance

See [references.md](references.md). `references/landing-current.png` is the current local first screen at the browser's default narrow viewport. The historical `desktop-final.png` from September 28 supplies desktop composition context but predates later copy/header additions; current source/copy is authoritative.

A generated paired image is a visual draft, not implemented controls or exact typography. Prompt, input roles, filenames, and hashes are recorded in `manifest.json` when generated. The HTML/token comparison is the precise palette review.

## Review and implementation boundary

This task is complete when both options can be reviewed in light/dark on representative surfaces, important states remain readable, and the recommendation is explained. Selection and subsequent production implementation are separate stages because the user requested design first. No deployment, account connection, credentials, or live financial data is involved.

The prototype's arithmetic, source links, state retention, responsive behavior, and contrast sampling are recorded in [validation](../../validation/2026-09-30-theme-exploration/README.md). Sampled opaque pairs are not a whole-page accessibility certification.
