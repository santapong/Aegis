# Aegis Focus — research-based login verification

Checked 28 September 2026 on `agent/comet-asset-prompt`, based on `e2c4a9c`.
The owner explicitly requested login-specific research and redesign while
preserving Aegis identity. This follows the earlier landing-inspired iteration;
that iteration was not based on a separate login study.

## Research and implementation

Six actual signed-out pages were visually inspected: Linear, Mercury, Sunsama,
YNAB, Lunch Money and Notion. Sources, screenshots, limitations and adaptations
are in [the reference study](../../design/2026-09-28-login-research/references.md).
The [HTML board](../../design/2026-09-28-login-research/index.html) shows three
composition sketches, six references and the resulting Aegis desktop/mobile UI.

Aegis Focus centers the form, moves the original icon above it, preserves the
Meridian palette and Syne/Inter, and keeps static orbital decoration separate
from the original mark. There is no sample financial data on this page. Existing
client auth handlers are unchanged. A native help disclosure explains account
access and the absence of email password recovery truthfully.

Current editable source: `frontend/src/app/login/page.tsx` and
`frontend/src/app/login/login.module.css`. `login-form.tsx` is unchanged in this
research revision. Earlier AuthGate/Backdrop integration remains in place.
Unrelated LINE/backend changes, landing and registration were preserved.

## Checks and evidence

- Final `build.log`: production build, lint and TypeScript passed; exit 0. No
  dependency, framework configuration or backend authentication change.
- `checks.cjs` / `checks.json` / `checks.log`: **51 passing assertions** in isolated
  headless Brave/Chromium. All auth API responses are synthetic and no test
  request is forwarded to the real backend.
- 320, 390, 768, 1024, 1440 and 1920 CSS pixels: no document/heading/control
  overflow, 44px link/button/input targets, no illustrative planner preceding
  access. Saved viewport captures visually reviewed, plus the visible in-app
  desktop preview. Narrow layouts remove decorative artwork and card framing.
- Existing input requirements, malformed email, autofill hints, password reveal,
  keyboard focus/order, pending/disabled state, POST body handling, retained
  values on errors, retry and errors for 401/429/503/non-string 422/network/session
  lookup. Synthetic success reaches `/` and stores user state without password
  or returned token. This is client-contract evidence, not a real login.
- New help opens/closes with keyboard and preserves typed input. Native help,
  static content and the disabled-form explanation work with JavaScript off
  and external requests blocked. See `no-javascript.png`.
- Home, registration and documentation render; original icon loads; no canvas
  or running decorative animation in reduced-motion mode; no client exceptions
  through the tested error flows. `git diff --check` passed.
- React review: existing client form isolated from static server content, no
  new effects, package or data request, no token persistence change. The static
  SVG is a decorative background with pointer events disabled and hidden from
  assistive technology; all form content is semantic HTML.

Two research screenshots taken immediately after resizing the in-app browser
contained scaling artifacts. They are excluded from the board/mobile conclusions;
the final Aegis viewport captures are separately verified browser-test outputs.

An intermediate build was mistakenly started before the prior build had finished
tracing. Both shared `.next` and a log; cleanup caused a missing trace file in the
first build. The remaining task-owned build was stopped, both exits confirmed,
and a single sequential build then passed. The intermediate log is retained as
`build-overlap-attempt.log`; only the clean final `build.log` is build evidence.

Not tested: live password/Google authentication (backend on port 8000 not running
and Google client ID not configured), Safari, Firefox, physical mobile hardware,
native 200% text/400% page zoom, production deployment, authenticated dashboard
or password reset. This is not an accessibility certification or conversion
result. The owner approved the Aegis Focus design direction on 28 September
2026 (“This one is good”). This visual approval does not change the verification
limits above or the local-only release state below.

## Running local previews

- Login: <http://127.0.0.1:3098/login>, user service
  `aegis-meridian-preview.service`, runtime `/tmp/aegis-focus-runtime-2026-09-28`.
- Reference board: <http://127.0.0.1:3100/>, user service
  `aegis-login-references.service`, serving `docs/design/2026-09-28-login-research`.

Both are local transient services, not enabled boot services or public deployments.
No commit, push, merge, tag or deployment was performed.

```sh
systemctl --user status aegis-meridian-preview.service aegis-login-references.service --no-pager
node docs/validation/2026-09-28-login-research/checks.cjs
```

The test accepts `AEGIS_PLAYWRIGHT_PATH`, `AEGIS_BROWSER_PATH` and
`AEGIS_PREVIEW_URL` overrides. Build with `bun run build` in `frontend/`, wait for
successful completion, copy standalone/static/public output to a fresh runtime
outside `.next`, then switch the task-owned preview service.

Before-research source backup: `/tmp/aegis-login-before-research-2026-09-28/`.
The prior running snapshot `/tmp/aegis-sign-in-runtime-final-2026-09-28` also
remains available. Restoring either must preserve unrelated working changes.
