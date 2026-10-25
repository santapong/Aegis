# Serial Aegis verification on Raspberry Pi

Check date: October 23, 2026, Asia/Bangkok. The owner reported Kali CPU saturation/hanging and requested Raspberry Pi testing. Earlier verification had run several local pytest/Next/n8n jobs concurrently without CPU quotas on a four-core workstation. Kali had recently rebooted at inspection; no Aegis test/build process remained. The historical cause of the hang is not established by that snapshot.

## Runtime and boundaries

Source is the isolated `feature/line-money-ledger-20261022` worktree. Only source/tests/lockfiles were transferred; `.env`, credentials, local databases, virtual environments and `node_modules` were excluded. The Pi used new disposable ARM64 containers and a new test PostgreSQL instance; existing production services, database volumes, channel configuration and Tailscale routes were not changed.

The Pi was healthy before testing: approximately 0.42 load,12 GiB available RAM,53.8°C, root 30%. Actual cgroupv2 controllers are `cpuset cpu io pids`; **memory is absent**. Docker discarded the initial 2 GiB RAM-limit request. That initial idle container was stopped before tests. No kernel/boot setting was changed and no reboot was performed.

The revised, narrower profile uses an enforced CPU quota, low CPU shares, a PID limit and a host watchdog. Python checks additionally inherit a 1 GiB per-process address-space limit. The watchdog stops only the task's explicitly named containers above 1536 MiB summed RSS, below 8 GiB host available RAM or at 70°C. Summed RSS overcounts shared pages; this is a conservative soft watchdog, **not a hard aggregate RAM cap**. A workflow requiring a strict kernel RAM cap remains unqualified.

One heavy job ran at a time. For the PostgreSQL run, `cpu.max` was `75000 100000` for the test process container and `25000 100000` for its disposable database—a combined one-core budget. The database shared the disconnected test container's loopback namespace, with no host ports. Production PostgreSQL was not used. Dependency installation occurred before network disconnection.

## Executed results

| Check | Actual outcome |
| --- | --- |
| Full backend suite on ARM64/Python3.11-series | [260 passed, 18 skipped](backend-sqlite.log),152.05 seconds |
| Selected ledger/integration/report suite with real disposable PostgreSQL | [56 passed](backend-postgres.log),49.90 seconds; includes actual concurrent money/identity cases |
| ARM64 frontend production build | [Passed, 43 static pages](frontend-build.log), one page worker |
| Sequential TypeScript + exact-money client checks | [Types passed](frontend-types.log); [client boundary checks passed](frontend-client.log) |
| Native ARM64 n8n2.33.3 | [Three inactive fixtures passed](n8n-fixture-results.json); zero HTTP nodes, network disabled |

The full backend run's 18 skips were not reported as passes. The subsequent PostgreSQL scope exercises the dedicated database fixtures; some read-adapter fixtures within that selected run remain SQLite. Existing deprecation warnings are retained in logs.

At completion of backend/database checks, sampled peak summed RSS was approximately388MiB, available RAM remained above12 GiB, and no watchdog threshold triggered. Exact final observations and cleanup/health evidence are in [the resource receipt](resource-qualification.json) and final watchdog receipt. These observations do not establish a causal learning benefit or a production capacity guarantee.

Live LINE/OCR credentials, real message delivery, owner account cutover and production activation were not exercised. No heavy Aegis verification was resumed on Kali after the correction.

## Final cleanup and observation

All task test containers and the disposable PostgreSQL volume were removed. The watchdog was stopped. Production n8n still had its October18 start timestamp and returned readiness200; no live workflow/database/channel was changed. [Post-test health](pi-health-after.log) is retained, including unrelated endpoints that were already unavailable before testing. Kali had no owned Aegis test/build/preview process and no Docker containers at the final check; other desktop/browser/I/O activity remained.

Across the serial verification stages the sampled peak summed RSS was 985.7MiB. No watchdog threshold triggered. The one-worker Next configuration is persisted in source; a page-worker setting alone does not impose a whole-build CPU quota. Future heavy Aegis verification should use the qualified serial remote procedure rather than another concurrent local wave.
