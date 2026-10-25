# Horizon verification

25 October2026, Asia/Bangkok. Frontend identity work only; independent owner acceptance and deployment remain pending.

## Executed checks

-184 TS/TSX files transpiled without syntax diagnostics.
-Initial full TypeScript check passed in the ARM64 preview container.
-Horizon-only Git whitespace checks passed.
-Landing arithmetic exercised in the visible browser: personal43,900→35,900 with delayed income; Business X88,000→−2,000 after reserves. No real records changed.
-Landing mobile navigation opened, closed with Escape, and returned focus to its trigger.
-Landing checked at1440 and390 CSS pixels, with no horizontal document overflow.
-Docs, demo and welcome returned200 and rendered their new identity at desktop width.

Production-build and final browser receipts are appended below after execution.

## Corrections during verification

The initial frontend overlay retained deleted root `page.tsx`/`loading.tsx` files. This produced a duplicate-root preview routing failure. The isolated copy was aligned with the source baseline's deletions; landing then returned200. Future overlays must preserve source deletions, not merely add changed files.

A new SVG title initially used multiple JSX children. React warned about the title content; it was changed to one interpolated string. A docs-module selector initially omitted its local class; CSS compilation rejected it. `.page pre` corrected the scoped selector. These are actual recovered failures, not passing first attempts.

Phone screenshots exposed the legacy compact-login rules removing card padding, and a disabled amber-state colour surviving the palette conversion. Explicit Horizon padding and disabled-state contrast were added before final production verification.

The first production attempt compiled and passed types but failed at static generation because the isolated frontend omitted the repository's canonical `CHANGELOG.md`. The existing Dockerfile already documents its parent-path requirement. A read-only mount of that exact reviewed file was added to the test container; no application fallback or fabricated changelog was introduced.

## Execution and resources

Compilation was offloaded to the approved isolated Raspberry Pi container. No existing Pi container, database, LINE delivery setup, route or service was changed. Source transfer excluded credentials, `.env`, databases, dependency trees and existing build output. The installed ARM64 frontend image supplied Next15.5.12 and Node dependencies; no package install or image pull was required.

Pi cgroup controllers were `cpuset cpu io pids`; memory is absent. CPU quota was verified first at `100000 100000`, then lowered to `50000 100000` for the production phase. PID limit192 was verified. The1.5GiB aggregate RSS,8GiB host available-memory,70°C and2GiB temporary-disk boundaries are soft watchdog limits, not kernel RAM/storage caps. Each build/start command has a600-second timeout.

An initial monitor command requested only RSS from `docker top`; Docker rejected output without a PID field. That monitor did not sample the initial type-check run. Before preview compilation the monitor was corrected to request `pid,rss`, fail closed on process-inspection error, and its actual samples were checked. Subsequent dev/build samples are retained.

The webpack development server repeatedly restarted itself near its heap threshold. A serial production build replaced that strategy. This was an observed dev-runtime limitation under this budget; it does not establish a production memory problem.

## Learning outcome receipt

Mechanism: apply a shared semantic palette to reusable components, then inspect scoped surfaces and real rendered states. Prerequisites are a reconciled source baseline and preserved financial/authentication handlers. Boundary: a successful TS check does not validate CSS Modules, browser hydration or disabled-state contrast.

Expected working case: shared cards/navigation inherit Horizon across routes. Expected boundary case: a hard-coded scoped public stylesheet or legacy compact rule needs its own checked adaptation. The docs compilation and mobile access-card failures confirmed that boundary and were repaired.

The frontend verification guide's single-string SVG-title lesson applies to this React19/Next15.5.12 preview. It was retrieved, missed in the initial JSX, and applied after the observed warning; final browser results are the relevant check. Resource procedures also required actual monitor-output inspection. These observations do not measure a causal learning, quality, token or time benefit.

Disposition: preserve the existing verification procedures and the narrow recovery evidence. Record the owner's newly selected palette in Aegis's retrieval checkpoint; do not mark the rendered design owner-accepted.

### Prospective final boundary check

Before the final route sweep: shared semantic tokens should render Horizon cards/navigation throughout the authenticated fixture. With one changed assumption—selecting the retained Meridian appearance—the workspace should deliberately switch back to that saved theme, without losing entered settings. Returning to Horizon should restore its light palette. Public docs/landing should remain independently Horizon in either case. This checks the boundary between a new default identity and an existing user's explicit appearance preference; it is not a claim that every legacy theme was redesigned.

## Final executed result

The ARM64 Next15.5.12 production build passed compilation, type validation and generation of43 static pages. The canonical changelog mount repaired the earlier packaging failure. The built output was copied without cache/standalone dependency trees to the local isolated worktree; no local compilation ran.

Browser results on the production artifact:

-9 public/access paths returned200: landing, login, signup, welcome, docs hub, two representative docs articles, demo and changelog.
-16 authenticated routes returned200 with synthetic browser auth and503 responses for every API request. This verifies workspace styling and unavailable-service states, not live financial operations. Transactions' failure state has no h1; the retained source already behaves this way.
-Nine representative surfaces at320px had no horizontal document overflow; landing was also checked at390 and1440px.
-Email/password reveal and friendly503 feedback worked; the entered email remained. Signup rejected mismatched passwords and kept entered values.
-Settings switched Meridian→Horizon while retaining THB. Public landing remained ivory under the saved Meridian preference. The prospective shared-token/explicit-preference boundary passed.
-Landing, login and signup returned200 with JavaScript disabled; both credential forms retained a disabled fieldset.
-A reused development tab reported React418 during initial production navigation. Attribution was not isolated. A fresh production page then checked eight public/access surfaces with zero page errors. A separate fresh disposable browser context checked17 authenticated paths, including a trip-detail failure state, with zero page errors. See `browser-clean-workspaces.json`; do not describe the old-tab failure as a proven cache cause.

The initial broad route sweep used a generic alert locator that also matched Next's route announcer. The harness was corrected to select the actual focusable error region; application auth behavior was unchanged. The retained browser harness reflects that correction.

## Final resources and cleanup

Final successful Pi build/preview phase peaked at1,276,215,296 bytes summed RSS (about1.19GiB), within the approved soft1.5GiB threshold. The earlier dev phase peaked at1,588,772,864 bytes, below that threshold but close enough to motivate the production strategy. CPU and PID controls were read at runtime. No RAM/storage hard-cap claim is made. No thermal/resource threshold stopped the successful phase. Exact samples are retained in the resource receipts.

The task's Pi container was stopped and removed, its watchdog ended, its temporary directory was removed, and its owned SSH forward was terminated. No `aegis-horizon` container remained. n8n readiness still returned200. Existing phone-pilot and production services were not changed.

For owner review only, a small local **prebuilt** preview remains at `http://127.0.0.1:3119/landing`. Its effective cgroup controls are CPU25%, memory384MiB, swap0 and64 tasks, with an automatic30-minute lifetime. Startup/current memory was approximately172MiB; this is a small production server, not a local build. The preview does not connect to a financial backend. Public demo state is fictional and browser-only. It is not a deployment.

All selected screenshots and generated assets are retained locally. Git whitespace checks passed. No commit, push, merge or deployment occurred. Owner acceptance of the rendered frontend remains pending. The Aegis retrieval checkpoint was updated only to record the owner's renewed palette direction and point to this evidence; a task pass does not establish learning benefit.

The first unprivileged temporary-directory removal encountered files owned by the test container's root user. Exact-path `sudo -n rm -rf -- /home/santapong/aegis-horizon-20261025` removed only the owned test directory; absence was then verified. The initial failed cleanup is not treated as successful cancellation. No production path or Docker-wide cleanup was used.
