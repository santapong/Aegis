# Aegis landing validation — 28 September 2026

Local implementation on the existing `agent/comet-asset-prompt` branch, based
on `e2c4a9c`. Owner design acceptance, remote CI, and deployment are pending.
Existing LINE integration changes were present before this task and were not
part of the landing work.

## Result

The public `/landing` now uses Aegis typography with DravenIQ-inspired navy,
silver, cyan and blue. It includes an interactive sample overview, calendar,
and savings goals; product explanations; self-hosting information; a native
FAQ; account, documentation, changelog and source links. All amounts and the
AI response are illustrative. No AI requests or financial mutations occur in
the sample. The page is deliberately dark and independent of the app's themes.

## Evidence

- Production build, including lint/type validation: `build.log` (Next.js
  15.5.12 / React 19). The build lists `/landing` as a static route.
- Browser checks: `browser-checks.json` and `browser-checks.log`.
- Visible Brave / Chromium 152.0.7977.83, using HTML/CSS/SVG without WebGL.
- All three sample views checked at 320, 390, 768, 1024, 1440 and 1920 CSS-pixel
  viewports. No whole-page horizontal overflow; calendar days retain 44px
  targets and use a contained horizontal scroll area when needed. Screenshot
  content widths exclude the browser's six-pixel vertical scrollbar.
- Calendar arrow keys, empty-day state, selected rent details, sample tab
  arrows/Home/End, all three goal progress indicators, all four keyboard-operated
  FAQ disclosures, mobile menu close-on-navigation and Escape focus restoration.
- Hero anchor, registration, sign-in, docs and changelog destinations rendered;
  signed-out `/` still arrives at `/landing`. No account was created or used.
- Reduced-motion preference at runtime; no continuous decorative animations.
- JavaScript-disabled production browser with external requests blocked:
  visible landing/overview and working native FAQ. No uncaught browser errors.
- Desktop/mobile screenshots saved alongside this report. Visual review is
  separate from owner acceptance or an accessibility certification.

The initial no-JavaScript test found that server HTML could contain the landing
while React's root loading boundary kept it hidden. Public AuthGate rendering
alone was insufficient. The unchanged root dashboard and its loader were moved
to `app/(dashboard)/`, retaining `/` and preserving its loading behavior while
removing that boundary from the landing. The browser test then passed. See
`../../design/008-draveniq-inspired-landing.md` for the design and rollback.

Not tested: Safari, Firefox, physical mobile hardware, native 200% text zoom or
400% browser zoom, signed-in backend operations, real hosting origin. The app's
other themes were not redesigned. No push, merge, release, or deployment occurred.

## Run and edit

Sources: `frontend/src/app/landing/page.tsx`, `preview.tsx`, and
`landing.module.css`. The first contains marketing content, the second contains
local demo interactions and responsive navigation, and the third scopes visual
styles to this landing.

From `frontend/`, use `node node_modules/next/dist/bin/next dev --hostname
127.0.0.1 --port 3098` (one line) to edit. The current local review server uses
the production standalone build at http://127.0.0.1:3098/landing.

To reproduce that production preview from `frontend/`:

```sh
node node_modules/next/dist/bin/next build
mkdir -p .next/standalone/.next/static
cp -a .next/static/. .next/standalone/.next/static/
mkdir -p .next/standalone/public
cp -a public/. .next/standalone/public/
HOSTNAME=127.0.0.1 PORT=3098 node .next/standalone/server.js
```

The rendering lesson was added to the local DravenIQ theme release checklist,
with its prior version backed up in
`/home/santapong/.codex/learning/backups/2026-09-28-aegis-landing/`.
Skill structure validation passed; the theme's logo and canonical tokens were
not changed. The existing skill entrypoint links this checklist for future work.
