# Aegis public UX/UI review — 29 October 2026

The current Horizon/Union frontend has a coherent visual identity and useful
personal/business examples. The executed public journeys support its navigation,
theme continuity and narrow-screen behavior. The first run found a real docs
discoverability defect: `import csv` produced an empty topic list although the
transaction-import guide exists. The prepared change shares the header search's
all-word matching with the topic filter and includes section titles.

This is a scoped inspection and regression check, not representative-user
research or acceptance of authenticated financial operations.

## Which Vercel project is the product?

Fresh public renders and the signed-in Vercel dashboard confirmed two projects.
The connector lacked a team grant, so it did not supply a fresh inventory.

| Project | Public address | Observed purpose |
| --- | --- | --- |
| `aegis` | https://aegis-eight-azure.vercel.app | Current Union landing, demo, docs, same-origin access forms and protected application |
| `draveniq-aegis-landing` | https://draveniq-aegis-landing.vercel.app | Older static landing with the previous logo, colors and copy; its Open app link leads to the product |

The main project overview showed **Ready**, production
`dpl_GFPMNtyuYFXy15yqXVURvyy1ZrXy`, Git `main` at `a28bb9b` and the canonical
domain above. Its team-list card said “No Production Deployment”; the detailed
overview and successful public render resolve that inconsistency.

The duplicate design can confuse visitors. A future redirect or retirement is a
separate routing decision; no project, domain or production setting was changed.

## Observed findings

1. **Fixed and verified on the updated build:** the topic filter used
   one contiguous phrase while the header accepted separate task words. Reuse
   `findDocArticles` for both; preserve category filtering and empty recovery.
2. **Operational follow-up:** the old public landing still exposes the previous
   identity. Use `aegis` as the canonical product and decide separately whether
   old bookmarks should redirect there.
3. **Strengths in the sampled flows:** the current palette and typography are
   consistent; fictional examples expose assumptions and changing amounts;
   mobile-menu Escape restores focus; keyboard entry reaches main content;
   theme changes retain form inputs and demo changes; narrow public pages do
   not overflow at 320 px in either appearance.

The review inspected actual screenshots before assigning findings. Screenshots
show the current main landing, the old landing, a delayed-income example and the
original false-empty search. Automated layout assertions establish width fit,
not every visual detail or contrast ratio.

## Execution record

| Attempt | Target | Actual outcome |
| --- | --- | --- |
| `run-01` | Live canonical production | **13 tests: 10 PASS, 3 FAIL** |
| `probe-02` | Same live production; only the two corrected locator cases | **2 tests: 2 PASS, 0 FAIL** |
| dependency phase, attempt 02 | Isolated updated source | **Interrupted**, no build/UI result; disk-size walk returned nonzero during installation; the monitor stopped the owned unit |
| `run-03` | Matching updated production build on an owned Pi loopback preview | **13 tests: 13 PASS, 0 FAIL, 0 SKIP**; fresh light/dark search renders inspected |

The size-walk stderr was not retained, so its exact failure cause is unknown;
concurrent installer changes are a hypothesis. The corrected bounded traversal
completed the actual install/build/run without increasing limits.

Original failures are retained. The disclosure uses native `summary`, so treating
it as an ARIA button was a locator error. The signup error was already correctly
focused, but a broad alert selector also matched Next's route announcer. The
corrected selectors passed without product changes. Only the multiword topic
search was a corroborated product defect.

The suite uses actual Robot Framework **7.5**, Python Playwright **1.62.0** and
its existing ARM64 Chromium **151.0.7922.34 / revision 1234**. It uses a custom
keyword library, not Robot Framework Browser. The final case set also checks
word order, capitalization, repeated whitespace, section words and category
filtering. See `frontend/tests/robot/README.md` for reproduction and boundaries.

Next **15.5.28** compiled, checked types and generated all **94** static pages
successfully. Frozen dependency setup took 29.39 s, the build 152.62 s and the
preview/Robot/visual phase 106.76 s. Native Robot execution itself took 40.09 s.
There were 866 browser request events, zero uncaught page errors and zero
blocked write attempts. Console/network error absence beyond those observations
was not independently qualified. The isolated preview deliberately had no live
backend; anonymous redirect behavior does not establish real authentication.

`source.json` records the reviewed source bundle and exact final test hashes. The
original live deployment is distinct from the updated artifact; an old deployed
page or a DOM-injected patch cannot qualify the repair.

## Isolation and evidence

The busy workstation was not used for compilation or a new automated browser.
Pi phases use one CPU, **1536 MiB hard aggregate RAM**, swap zero, 192 PIDs and
600 seconds each. The host watchdog stops only named owned units below 8 GiB
available host RAM, at 70°C, on current firmware faults or task disk over 2 GiB.
The disk ceiling is a soft watchdog, not a filesystem quota. Prepared source
excludes environments, credentials, dependencies and generated build output.

The shared Pi lane was respected during other projects' runs. The interrupted
attempt's units were stopped before other reservations proceeded. Final effective
limits were read back in every phase. The largest cgroup memory peak was
**1,181,728,768 bytes** (about 1.10 GiB), maximum sampled temperature **65°C**,
minimum available host RAM **11,901,108,224 bytes** (about 11.08 GiB), and maximum
sampled logical task storage **1,416,313,739 bytes** (about 1.32 GiB). No final
resource-stop or OOM event was observed. Per-interval CPU/swap/PSI pressure was
not qualified by this controller; hard executor limits and the listed host
guards are the supported controls.

All named owned units are inactive, their cgroups were verified empty before
lane release, the preview and SSH forward are stopped, and the owned Pi directory
was removed after copying evidence. Core Docker/nginx/Tailscale, Redis,
PostgreSQL and n8n-readiness checks remained healthy; routes remained tailnet
only. See `summary.json` and `native/` for the retained result identities and
cleanup receipt. The initial harness was not frozen before its first run; its
failed locators remain in the original native output, while the corrected final
library is hashed.

Raw local reports are retained under
`/mnt/data/company/.aegis-ux-20261029/`, including native Robot output, logs,
screenshots, browser observations and resource receipts. The private Vercel
operator screenshot stays outside the Git change.

## Limits and delivery

Every browser context is synthetic and has no personal session. A write guard
blocks all methods except GET/HEAD/OPTIONS; an attempted write fails the case.
No registration, real financial write, LINE operation, production restart or
deployment is part of these checks. The signup case deliberately mismatches
synthetic passwords; demo edits change fictional browser state only.

Actual sign-in, saved financial state, full keyboard/screen-reader coverage,
contrast certification, other browser engines, real-device performance and
representative-user task success remain unqualified by this public suite.
There is no numerical “UX score” inferred from automated pass counts.

The source change is isolated on `feature/ux-robot-20261029`; production release
and CI status must be reported separately from local verification.
