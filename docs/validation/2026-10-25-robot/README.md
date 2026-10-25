# Aegis Robot Framework and integration validation

25 October2026, Asia/Bangkok. **Testing found an unresolved browser integration
failure. Direct API checks pass; this is not a release approval.**

Canonical work record: [TASKS.md](TASKS.md). All identities, tracking accounts,
amounts and LINE events in this run were fictional. No production records,
channel settings, live messages, existing Pi services or Git remotes were changed.

## Actual results

| Check | Result | Evidence |
| --- | --- | --- |
| Robot Framework7.5, real HTTP and PostgreSQL | PASS:20passed,0failed | [Native report](out/robot-rerun/report.html), [log](out/robot-rerun/log.html), [XML](out/robot-rerun/output.xml) |
| Full backend regression, SQLite | PASS:266passed;20SKIP | [Log](out/backend-sqlite.log), [exit](out/backend-sqlite-exit.json) |
| Selected database/ledger regressions | PASS:64passed, including genuine PostgreSQL lock tests | [Log](out/backend-postgres-rerun.log), [exit](out/backend-postgres-rerun-exit.json) |
| Integrated Horizon production build/types | PASS:97static pages | [Build](out/candidate-build-network.log), [exit](out/candidate-build-network-exit.json) |
| Browser login, tracked opening and QR→signed synthetic callback→linked state | PASS, actual frontend/API/PostgreSQL | Observed in the visible in-app browser; no response interception |
| Budget collection through the frontend | **FAIL** | [HTTP headers](proxy-observation.json), [browser capture](browser-budget-failure.png) |
| Corrected budget UI, stale-review UI and full candidate mobile run | NOT RUN | Requires routing repair and another bounded run |
| Native Robot frontend proxy regression added after the window | NOT RUN | `backend/tests/robot/frontend_proxy.robot` |
| Real phone camera, live LINE delivery/menu provisioning, production rollout | NOT RUN | No activation or deployment authorized by this testing task |

Counts are per runner/selection; they must not be added as unique test coverage.
Some read-adapter fixtures within the PostgreSQL selection still use SQLite.
The two new contention cases assert an actual PostgreSQL dialect and observe
`pg_blocking_pids` in both ordering scenarios. The Robot server independently
queries its real PostgreSQL database identity. No dry run is counted as a pass.

The20 Robot cases cover auth/cookie lifetime; local private QR generation and
independent ZXing decoding to the exact intended URI;20h linking,24h expiry,
renewal and consumption; seven-day identity state; signatures/private-chat
boundaries; preview without posting; effect-idempotent confirmation; exact
spending/refund/remaining arithmetic; currency and stale-facts review; read-only
English/Thai/menu shortcuts; disconnect; logout; and owner isolation.
Elapsed-time cases advance an integration clock; they are not a24-hour handset
soak. Auth rate limits are lifted only in the test bootstrap for fixture setup.

## Product findings

### P1 — budget collection requests leave the frontend origin

For an authenticated test user, the built frontend returned:

```text
/api/budgets/?active=true →308 /api/budgets?active=true
/api/budgets?active=true  →307 http://127.0.0.1:8000/api/budgets/?active=true
```

Next removes the slash that FastAPI's collection route requires. The backend's
absolute redirect points at its internal port rather than the browser-facing
origin. The browser displayed `Failed to fetch` and `No budgets set yet`, although
the fixture had a stored budget. The financial report endpoint remained200;
the comparison endpoint's409 was expected until currency review.

The frontend should preserve the collection slash, and collection requests must
remain on the frontend origin. [Proposed config patch](proposed-proxy-fix.patch)
adds `skipTrailingSlashRedirect`. This proposal is **unapplied and untested**.
Rebuild, run the new same-origin Robot regression, and repeat the actual budget
browser journey before claiming a repair. Also recheck the currency panel's
error after the collection route is corrected; no additional cause is claimed.
The misleading empty state during a fetch failure should be handled explicitly.

### Integration gap — Horizon snapshot omitted the new feature widgets

The inspected Horizon input still contained the old LINE panel, lacked the
budget-currency review component, and its previously built preview deliberately
rewrote APIs to localhost port9. Its prior503 styling checks did not qualify
financial behavior.

This run built an isolated candidate from Horizon source plus the current LINE
backend and feature delta. [Horizon integration patch](horizon-integration.patch)
contains that **unapplied** frontend delta while retaining Horizon styling.
It does not include the proposed proxy repair. The parallel Horizon checkout
was preserved; recheck/rebase against its current state before applying either
patch. The candidate's successful compile does not close the browser failure.

### Secondary dashboard observations

The authenticated dashboard mixed dollar-prefixed subtitle/chart text with THB
metrics and described tracked opening cash as `unassigned recorded net`.
The account page correctly showed THB10,000 and explained that openings are not
income. These dashboard labels require a separate correction/recheck; no
incorrect ledger posting was observed. Source: the dashboard page's subtitle
and `Historical trend · unassigned records` labels. This was not a broad design
or financial-report audit.

## Original failures and reruns

- [First Robot run](out/robot/report.html):16PASS/4FAIL. A fixed midnight clock
  made newly queued jobs, whose defaults used real UTC, unavailable to the
  selector. [Stored times](out/clock-diagnosis.json) support that diagnosis.
  The test-only clock was changed to live UTC plus an offset, the disposable
  database was recreated, and the same20cases passed. Queue cases use nominal
  UTC; advancing cases cover identity/capabilities, not delayed-queue semantics.
- [First PostgreSQL run](out/backend-postgres.log):63PASS/1FAIL. The observer kept
  its statistics snapshot while waiting for a newly opened backend, failed to
  release the lock, and the API hit its1s lock timeout. An AUTOCOMMIT observer
  reads fresh statistics. All64cases then passed without relaxing that timeout
  or changing the assertions.
- The [offline build](out/candidate-build.log) failed fetching Google Fonts.
  Public build-dependency access was enabled for the one rebuild; it passed.
- The [first database initialization](out/pg-initialization-failed.log) failed
  `chown`/`chmod` after all capabilities were dropped. Only the new disposable
  database container received the initialization capabilities it needed; the
  existing PostgreSQL instance was untouched.
- The first frontend dependency probe assumed `/app/node_modules`; image
  metadata and a checked probe found `/verify/frontend/node_modules`. This was
  a harness path correction, not an application failure.

Original outputs remain separate. The reruns do not erase their failures.

## Source, runtime and cleanup

Source Git base:e2c4a9c, dirty LINE-ledger and Horizon snapshots. The input/candidate
manifests identify the actual files; no commit, push, merge or deployment was
performed. The built artifact uses Next15.5.12 and Node22 on ARM64. Robot7.5 and
ZXing3.1.1 are test-only dependencies. Existing locked Python test dependencies
were used. The newly added proxy keyword/case and final explanatory lint comment
were not part of the executed20-case source snapshot.

The workstation was below its RAM reserve, so all heavy phases ran serially on
the approved Pi. Actual container CPU/PID controls were read. Aggregate configured
test CPU stayed at most1core and configured PIDs at most256. The largest retained
RSS sample was about985.8MiB. The Pi lacks a memory controller:1.5GiB RSS,
8GiB host reserve and70°C stops were **soft watchdog** safeguards. Database
storage was a256MiB tmpfs; ordinary owned storage stayed below its768MiB budget.
The watcher ran1800.98seconds; it is not a hard aggregate wall/RAM isolation claim.

[Cleanup](cleanup.json) confirms zero task containers, no watcher, removal of
temporary dependencies/build cache and the disappearance of disposable PostgreSQL
data. The private link file was removed; its first in-container unlink was denied
by the readonly mount and exact-path host removal was verified. The preview and
SSH forward are closed. A tiny bounded local cleanup removed only the session
signed by this fixture; other cookie values were not recorded. New browser runs
should use a dedicated test hostname/context to avoid sharing localhost sessions.
Native Robot reports were checked for common JWT/link-capability patterns.

Post-run n8n health/readiness remained200 and both existing LINE pilot workflows
remained inactive. See [Pi health](pi-health-after.log),
[workflow states](line-workflows-after.json), [guard](guard.json) and
[machine outcome](outcome.json). Dependency/CVE scanning, remote CI and live
provider qualification were NOT RUN. No coverage percentage, security assurance
or learning/resource-saving benefit is claimed.
