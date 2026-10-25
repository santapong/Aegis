# Aegis develop integration — 25 October 2026

Owner: current primary agent; user explicitly requested merging into develop.
No child agents. This is the canonical task record for this integration.

| ID | Deliverable | Dependency | State | Acceptance / evidence |
| --- | --- | --- | --- | --- |
| I1 | Combine LINE ledger/backend and Horizon frontend in isolated integration checkout | fresh origin/develop | Done | Inputs manifest, original worktrees preserved; develop2ba31eb is ancestor of sharede2c4a9c base |
| I2 | Repair same-origin budget collection and truthful load states | I1 | Done | Final97-page build/types PASS; Robot20core+1proxy PASS; first proxy FAIL preserved; browser review/reload/320px PASS |
| I3 | Review scoped source/risk and retain prior regression provenance | I2 | Done | exact source comparison with prior backend checks; missing scans/release checks explicit |
| I4 | Commit and merge/push develop using plain git | I2,I3 | Done | Remote develop aff15e6 contains source044780d; main9071ddf unchanged; no deployment or LINE activation |

Budget: one heavy phase at a time on the previously authorized isolated Pi.
CPU total<=1core, configured PIDs<=256, phase<=600s, run<=1800s.
The Pi has no memory controller. Retain the authorized soft watchdog profile:
RSS<=1.5GiB, available>=8GiB, admission<65C/stop>=70C, no firmware events;
owned root<=768MiB plus test database256MiB tmpfs. CPU/PID controls are checked
at the actual Docker cgroups. Monitor expiry stops owned containers.
Synthetic fixtures, fake keys, providers empty, delivery disabled, loopback only.
No production service mutation or real LINE/provider calls are authorized.

The user's explicit request selects immediate develop integration using git;
the repository's normal draft-PR/independent-review path is not represented as
completed. Remote CI and release acceptance remain separate evidence.
