# Meridian sign-in — local verification

Checked 2026-09-28 on `agent/comet-asset-prompt`, based on `e2c4a9c` with
the previously completed landing and unrelated LINE integration changes present.

## Result

The sign-in page matches the selected Meridian landing. It uses the existing
Aegis icon, Syne/Inter, amber actions and a static teal illustration. Compact
layouts prioritize the form. The existing email and conditional Google auth
connections, cookie session design, user store and destination are preserved.
No new package, backend change, real account, public deployment or git push.

## Evidence

- `build.log`: production build, lint and TypeScript passed on Next.js 15.5.12,
  React 19 and Node 24.19.0. `/login` is static; the build estimate is 120 kB first
  load JS / 5.24 kB route JS, not a measured device transfer budget.
- `checks.cjs`, `checks.json`, `checks.log`: **47 passing checks**, isolated
  headless Brave/Chromium with synthetic auth responses. No request from this
  test was forwarded to a real auth backend.
- Six widths: 320, 390, 768, 1024, 1440 and 1920 CSS pixels. No page/heading/control
  overflow, interactive targets at least 44px, form-first compact layout.
  `viewport-*.png` captures were reviewed along with visible in-app browser views.
- Required email/password and malformed email stop before a request; autofill
  attributes; password show/hide preserves the value; keyboard sequence and
  visible focus; pending state disables controls and announces progress.
- POST body contract, error focus/announcement, retained input and retry for
  401, 429, 503, non-string validation detail, network failure and a failed
  session lookup. `loading.png` and `invalid-credentials.png` show two states.
- Synthetic success verifies the client redirect to `/` and authenticated user
  state without storing the returned token or password. This is **not** evidence
  of a real login, server cookie correctness or a functioning dashboard backend.
- Home, registration and documentation destinations rendered. Existing public
  landing remains accessible. No decorative canvas or running animation in the
  reduced-motion check; Aegis image decoded.
- JavaScript disabled plus external requests blocked: visible heading, form and
  explanation; inputs/submit remain disabled. The first fallback check used the
  Playwright text selector, which skips `noscript`; a rendered screenshot and
  direct `noscript p` visibility check established the real fallback. No app
  change was required for that test correction. See `no-javascript.png`.
- No client exceptions through the tested validation/error flows. React review:
  static server shell, local client form state, effect use limited to hydration
  readiness and focus, one in-flight auth operation, no token persistence or
  decorative WebGL import. `git diff --check` passed.

Not tested: real email authentication (local port 8000 backend was not running),
live Google sign-in (client ID not configured in this preview), Safari/Firefox,
physical mobile hardware, 200% text zoom / 400% browser zoom, live deployment or
authenticated account features. This is not accessibility certification or
owner approval of every final detail. Registration retains its existing design.

## Preview and reproduction

Open <http://127.0.0.1:3098/login>. The existing transient local user service
`aegis-meridian-preview.service` now runs the final snapshot at
`/tmp/aegis-sign-in-runtime-final-2026-09-28`; both sign-in and landing are served.
It is not enabled at boot and is not a deployed hosting origin.

```sh
systemctl --user status aegis-meridian-preview.service --no-pager
curl -I http://127.0.0.1:3098/login
node docs/validation/2026-09-28-meridian-sign-in/checks.cjs
```

The test uses the installed workspace Playwright and Brave. Override
`AEGIS_PLAYWRIGHT_PATH`, `AEGIS_BROWSER_PATH` and `AEGIS_PREVIEW_URL` for another
environment. It launches a fresh isolated browser and mocks all API requests.
Build from `frontend/` using `bun run build`; copy `.next/standalone`,
`.next/static` and `public` into a fresh runtime **outside `.next`** before
switching the task-owned preview service. This reuses the prior verified
[preview procedure](../2026-09-28-meridian-landing/README.md).

Editable source and scope: [design note](../../design/010-meridian-sign-in.md).
Before-change backups: `/tmp/aegis-before-sign-in-2026-09-28/`. Restore only the
sign-in work if rolling back; preserve the earlier landing and unrelated work.
