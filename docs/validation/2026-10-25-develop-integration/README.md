# Aegis develop integration — 25 October 2026

User request: merge the prepared Aegis changes into develop. This integration
combines the LINE ledger/backend checkout and the Horizon frontend, preserving
both original dirty worktrees. Canonical tasks: [TASKS.md](TASKS.md).
Integration branch: `integration/aegis-line-horizon-20261025`, target initially
`origin/develop` at2ba31eb (fresh fetch). Original sources shared basee2c4a9c.

The requested24h setup lifetime, private locally generated QR, renewal and
read-only budget/menu shortcuts are included. The Horizon frontend is integrated
with its accepted visual direction. This is development integration, not a
public release, production financial cutover, real-phone test or LINE activation.

## Verification and preserved corrections

- Backend application source:117files match the earlier Robot/regression
  candidate. Its missing report HTML template is restored from the unchanged
  tracked source. Prior SQLite266passed/20skipped and selected64passed including
  actual PostgreSQL contention are retained [as prior evidence](../2026-10-25-robot/README.md), not claimed as reruns here.
- Fresh Robot HTTP/PostgreSQL acceptance:20passed/0failed, including setup
  lifetime/expiry/renewal, persistent identity, signature/owner isolation,
  idempotent confirmation, exact budget/refund arithmetic, stale currency facts
  and read-only shortcuts. Independent ZXing QR decoding runs inside that suite.
- Initial integration source selection accidentally included unignored
  `.next-horizon*` directories. The first build was explicitly stopped (143)
  before acceptance; generated directories were removed and `.next-*` ignored.
  No compiled preview output is included in Git.
- Clean buildv2:97static pages/types PASS. Its first proxy test FAILed:
  skipTrailingSlashRedirect alone still let the wildcard rewrite omit the final
  slash, resulting in a FastAPI redirect outside the browser origin. The actual
  browser showed the new truthful load error. Original native failure and
  [screenshot](browser-first-proxy-failure.png) are retained.
- Repair: preserve the slash in both Next normalization and an explicit
  slash-bearing API rewrite before the generic rewrite. The test assertion is
  unchanged. Final buildv3/types PASS (97static pages,250.05s). The unchanged proxy
  rerun PASSed1/1. Auth/me, finance status/report and canonical budget collection
  also returned200 through the frontend without Location redirects.
- Actual visible browser: fictional login; stored unreviewed cap; keyboard Enter
  currency confirmation; reviewed THB5,000 cap/THB0spent/THB5,000remaining; persisted
  after refresh. Desktop client/scroll1280/1280; phone320/320 with navigation closed.
  [Successful desktop](browser-budget-success.png), [phone](browser-budget-mobile-320.png),
  [before review](browser-currency-review.png), [browser receipt](browser-result.json).
  This is CUA browser evidence, separate from the native Robot HTTP suites.
- An optional extra independent balance read used a wrong harness endpoint and
  ended with KeyError. It was not rerun after cleanup; no such balance assertion
  is claimed. The required browser/Robot results above are separate.

The budget page now shows loading/retry states. Reviewed tracked caps and chart
amounts use THB; unreviewed cap values do not adopt the user's unrelated display
currency. This does not repair the separate historical dashboard vocabulary/
currency finding in the earlier report. Actual financial release acceptance,
full browser-engine coverage and live handset delivery remain outside this run.

## Resources and source identity

One owned Pi run, one heavy phase at a time, no paid providers, fake credentials,
no real account data. Per-phase600s and whole-run1800s deadlines; configured
aggregate CPU<=1core/PIDs<=256, checked at actual Docker cgroups. The Pi lacks a
memory controller; RSS1.5GiB/headroom8GiB/temperature70C/storage watchdogs are soft
safeguards. Admission requires below65C. Test PostgreSQL uses256MiB tmpfs; owned
root limit768MiB. Monitor expiry now stops owned containers rather than silently
ending observation. Cleanup verified: zero owned containers, test PostgreSQL tmpfs destroyed,
watchdog ended, dependencies/build cache removed, SSH tunnel closed; fictional
browser signed out/tab closed/viewport reset. Guard lifetime1404.76s, sampled
peak RSS1,294,516,224bytes, owned bytes before cleanup418,051,489; no threshold
or monitoring events. n8n health/readiness remained200/200, firmware0x0.
See [cleanup](cleanup.json) and [guard](guard.json).

[Input provenance](input-manifest.json), [tested source hashes](tested-source-manifest.json),
[source comparison](source-comparison.json), [scoped risk record](RISK.md) and
[exact-pattern secret check](secret-pattern-check.json) retain limits. These
checks do not certify security; a pre-existing Next/sharp advisory requires
release follow-up. No comprehensive current dependency/container scan was run.
The normal independent-review/draft-PR path is not claimed complete; the owner
selected direct develop integration. Remote CI is separate and currently pending.


Final build ID: `dJIgBtRiRnAaPdOYUkwcM`. All423 transferred source files match
expected hashes except the build-generated TypeScript include for
`.next-robot/types`; see [source check](source-check.json). The test README and
integration/CI evidence received documentation-only updates after execution.
The full raw whitespace check reports historical Markdown/patch/license spaces;
the selected application/CI source whitespace check passes. No license text or
historical failure artifact was rewritten to obtain a clean result.
