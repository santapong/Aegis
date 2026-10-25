# Aegis Robot Framework acceptance

Outcome: exercise the LINE setup and budgets through real isolated HTTP and
PostgreSQL, add repeatable Robot Framework reports, and check the integrated UI.
Canonical task record: this file. Owner/coordinator: the current primary agent;
no child agents or external tracker changes are authorized for this task.

Source: LINE ledger `feature/line-money-ledger-20261022`, Git base `e2c4a9c`.
Frontend reference: `aegis-horizon-20261025`, same Git base, separately dirty.
Horizon currently lacks the new LINE panel/budget-currency review and its prior
preview intentionally rewrites APIs to localhost port9. Preserve that finding.
Build only a disposable integration candidate: Horizon source plus the reviewed
LINE feature delta, without writing to the parallel Horizon checkout.

| ID | Deliverable / acceptance | Owner | Dependencies | State | Evidence / next action |
| --- | --- | --- | --- | --- | --- |
| R1 | Robot suite makes real HTTP requests and checks auth, 24h linking, renewal, draft/confirm/replay, exact budgets and ownership | Primary / inherited model | — | Done | Final20/20passed; original16pass/4fail retained; XML/report inspected; QR decoded independently |
| R2 | Backend regressions and genuine PostgreSQL contention checks, including stale currency-review race | Primary / inherited model | R1 source fixture | Done | SQLite266pass/20skip; selected regressions64pass. Original63pass/1fail retained; both contention orders inspected |
| R3 | Horizon integration candidate built and actual browser→API→database journeys observed | Primary / inherited model | R1 API; candidate manifest/build | Review |97-page build passed; login/accounts/LINE worked; budget collection failed through proxy. Repair and full budget UI retest remain |
| R4 | Reports, source hashes, findings and complete owned cleanup | Primary / inherited model | R1–R3 outcomes | Done | Native reports, failure evidence, proposals and cleanup receipt retained; validation request delivered with an open product failure |

Budget: one responsible agent; one heavy phase at a time. Each stage at most
10minutes, planned verification runtime at most30minutes, one diagnosis-driven
repair per failed stage before re-scoping. No paid providers or real messaging.
Testing does not authorize deployment, workflow activation or a production merge.

The workstation has about5.4GiB available RAM, below the standard reserve; heavy
work remains on the previously approved Pi. Read-only preflight found about
12GiB available,61.15°C, firmware0x0, n8n health/readiness200 and no memory cgroup
controller. Recheck admission before execution. Reuse the approved soft-guard
profile: aggregate RSS stop1.5GiB, host reserve8GiB, temperature stop70°C,
admission below65°C, owned storage below1GiB and logs below50MiB. These are soft
RAM/storage safeguards, not hard aggregate caps.

Whole-stack CPU at most1core and configured PID total at most256. Serial full
backend/build phases may use0.75core/PID128 alone. PostgreSQL tests split the
one-core budget between runner0.75and database0.25. Robot/UI phases allocate
API0.35, PostgreSQL0.15, frontend0.25 and Robot runner0.15 (0.9cores total), each
PID64. Shared existing services and the reused visible desktop browser are
outside these controls; no new local browser or full local stack is launched.

Use existing ARM64 images, sanitized source only, pinned test dependencies,
test-only credentials and loopback-only preview access. Remove only containers,
volume/network and dependency trees labeled for `aegis-robot-20261025`. Start the
watchdog first, inspect actual CPU/PID controls and stop owned work if monitoring
fails. Preserve failed logs and verify cancellation/cleanup explicitly.
