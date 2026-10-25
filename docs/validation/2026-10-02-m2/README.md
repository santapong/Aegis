# M2 everyday cash review — local verification

October 2, 2026 · Asia/Bangkok. **M2.1–M2.4 implemented and checked in the local owner pilot.** This is execution evidence, not owner/customer acceptance or production availability. See the [release guide](../../releases/2026-10-02-m2-everyday-cash-review.md), [M2 contract](../../design/013-m2-everyday-cash-review.md) and [implementation plan](../../plans/2026-10-02-cashflow-implementation.md).

## Source and scope

Working tree: `/mnt/data/company/apps/Aegis`, branch `agent/comet-asset-prompt`, HEAD `e2c4a9c68d6304799ff5bc28b9fef7cf951f3878`. No fresh remote fetch, commit, push, tag or production deployment was performed. The checkout already held M0–M1 and public-design/LINE changes. Do not attribute the whole Git diff to M2.

Pre-M2 copies: `/mnt/data/aegis-m2-2026-10-02/baseline/`. [Baseline preservation](baseline-preservation.json) compared 318 captured files and found no unexpected changes at its check time. The subsequently appended canonical design checkpoint is an intentional documentation change. [Source hashes](source-sha256.json) identify the tested cash code, migration, tests, scripts, guide and CI configuration; they are not a release commit. Environment files, dumps, dependencies and build output are excluded.

Environment: Python 3.11.11, SQLAlchemy 2.0.49, pytest 9.0.3, PostgreSQL 16, Node 26.8.1 and Next.js 15.5.12. API fixtures freeze today to October 10; the visible pilot uses the actual October 2 date and fictional actuals on October 1.

## Final automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Complete backend regression, including legacy MCP/LINE | 176 passed, 2 PostgreSQL-only tests skipped | [backend-regression-complete.log](backend-regression-complete.log) |
| M0–M2 cash API on actual PostgreSQL | 40 passed, including concurrent matching/import confirmation | [cash-postgres-complete.log](cash-postgres-complete.log) |
| M0–M2 cash API on SQLite | 38 passed, 2 PostgreSQL-only tests skipped | [cash-sqlite-complete.log](cash-sqlite-complete.log) |
| Production frontend build, types and lint | Exit 0; 41/41 pages generated | [frontend-build-complete.log](frontend-build-complete.log) |
| Cash Python, new migration, tests and rehearsal/restore scripts | Ruff passed | [ruff.log](ruff.log) |
| Actual API module with controlled session/network substitutes | Old 401 preserves newer sign-in; old success rejected; current response accepted; readable validation | [client-session.log](client-session.log) |
| M1→M2 migration and rollback guards, SQLite | Passed | [migration-sqlite.log](migration-sqlite.log) |
| M1→M2 migration and rollback guards, PostgreSQL | Passed | [migration-postgres-r2.log](migration-postgres-r2.log) |
| Restored PostgreSQL backup | Every table row and all four base forecasts equal | [backup-equality.log](backup-equality.log) |
| Fresh browser warning/error entries after final reload | None in observed interval | [console-final.json](browser/console-final.json) |
| Whitespace, source hashes and local services | Passed at handoff | [handoff-checks.json](handoff-checks.json) |

Existing warnings concern Passlib `crypt`, the debts route's `regex`, pytest discovery configuration and Node module registration. SQLite migration reflection emits legacy foreign-key warnings; its foreign-key check and preservation assertions pass. These are not dependency/security certifications. Remote CI was configured to run both cash test files on PostgreSQL but was not executed here.

New tests cover server-held CSV rows, malformed amounts/dates/currency, reviewed duplicates, partial matching, stale/atomic confirmation, retries, reversal and concurrent posting; recurrence intervals, split/clamped/weekend collisions, source-link isolation and exception-preserving extension; reserved versus transferred goals, owner/account/currency boundaries and unchanged legacy principal/progress; and alert deduplication, acknowledgment, source records, missing inputs, resolution and revisiting more than 20 dated scopes.

## Visible browser tasks

Controlled page: `http://127.0.0.1:3106/cashflow`, **M2 everyday review · fictional**, all active accounts, October 2–31, base plan. Only task-created fictional local records were used; no bank connection or real financial transaction occurred.

| Task | Observed result |
| --- | --- |
| Save `review-demo.csv` | Cash unchanged; two similar 65.25 THB rows need review; a 10 USD row stays invalid and retains its source currency. |
| Confirm the first row with keep-distinct and a partial utilities match | Cash falls once from 5,000 to 4,934.75; utilities remainder becomes 34.75; October closing stays 4,900. The unselected row remains unposted. |
| Reload the batch | One of three rows remains recorded/disabled; no duplicate posting. [Saved review](browser/csv-after-reload.txt). |
| Reserve 1,000 for an emergency goal | Cash/closing unchanged; headroom falls from 4,400 to 3,400. The unsaved form survives Escape and workspace switching. |
| Enter two installments of 100 | Expected October 15 and November 15, without inferred interest or principal updates. |
| Split receipts of 250 on days 15/31, forward weekend rule | October 15 remains; nominal October 31 shifts to November 2 and stays outside the visible plan. |
| Review membership, extend through December 2032 | The exception retains 12.50, expected October 11 and due October 10. |
| Add a 6,000 laptop cost on October 20 | Cash/buffer/reservation alerts identify October 20; closing/lowest −962.50, headroom −2,462.50. Sources include the opening, recorded movement, planned amounts and named reserve. |
| Mark the negative alert reviewed | No cash change; condition remains visible. [Explanation](browser/alert-explanation.txt). |
| Move laptop to November 5 | October closing 5,037.50, lowest 4,887.50 on October 11, headroom 3,537.50. October gap alerts resolve; later laptop retained. [Resolution](browser/resolved-alerts.txt). |
| Record a checking→savings transfer of 100 and link a goal | Included-account net cash unchanged; goal creates no second movement/reserve. [Allocations](browser/allocations.txt). |
| Return to Business X | M1 base remains 89,000 cash, 98,000 closing and 88,000 headroom. |
| Read updated everyday guide | Correct import/reserve/alert tasks and actual UI labels render at the documented anchor. [Guide](browser/cash-guide.txt). |

All amounts above are THB except the invalid USD row. Final M2 example: **4,934.75 cash; 5,037.50 closing; 4,887.50 lowest; 500 buffer; 1,000 reserved; 3,537.50 closing headroom**. [Final overview](browser/overview-final.txt), [desktop preview](browser/m2-overview-desktop.png). The chart threshold includes buffer plus reservations; exact values and their sources remain inspectable.

At 320×800, document/body widths stayed 320; the goal dialog was 286 pixels wide with equal client/scroll width. Escape returned focus to **Add a goal allocation**. At 390×844, CSV review document/body widths stayed 390. Actions remained reachable and no page overflow was observed. The viewport override was reset. These are targeted keyboard/responsive checks, not a complete accessibility audit or independent comprehension study.

- [Saved goals/installments](browser/m2-goals-saved.png)
- [320-width goal form](browser/mobile-320-goal.png)
- [390-width CSV review](browser/mobile-390-import.png)

## Migration and restoration

Fresh dedicated rehearsals migrated to M1, inserted fictional prior records and a partial settlement, then upgraded to `a1002cf00002`. Both engines preserved prior IDs, values, exception dates, settlements and ordinary indexes. Cash remained exactly 940 and closing 900. Repeated upgrade was harmless; an unused M2 downgrade/re-upgrade succeeded. Once an M2 review row existed, downgrade raised the explicit history guard and preserved schema/data.

Pre-upgrade pilot dump: `/mnt/data/aegis-m2-2026-10-02/pre-m2-pilot.dump`. Final dump: `/mnt/data/aegis-m2-2026-10-02/m2-owner-pilot-final.dump`. It was restored to `aegis_cash_m2_restore_test` on localhost:5548 and compared against `aegis_cash_test`: every row in every table and all four October 2–31 base forecasts matched. This is a dated snapshot, not a guarantee after later edits.

Compared cash rows: 4 workspaces, 5 accounts, 5 anchors, 14 commitments, 90 occurrences, 4 settlements, 3 transfers, 4 scenarios, 69 audits, 1 import batch/3 rows, 2 allocations, 1 installment schedule and 5 alert scopes/21 alerts. Counts include history and do not imply active payments/conditions. Dumps stay outside Git and contain only fictional pilot records.

## Resolved trial-and-error

- The first PostgreSQL harness compared constraint-backed index names as ordinary indexes. M2 intentionally replaces two uniqueness constraints, causing a harness failure. Excluding reflected `duplicates_constraint` indexes retains ordinary-index/data checks; recurrence/source-link API tests verify new constraint behavior. The fresh `_r2` rehearsal passes; the first log is retained.
- BigInt literals failed the ES2017 frontend target. Constructors preserve exact-cent display arithmetic without changing that target; final build passes.
- A hard limit of 20 alert scopes exhausted new dated reviews. Mutation reevaluation now covers the latest 20 scopes, retains older history and refreshes older scopes on revisit. The 25-scope regression passes on both engines; the failed intermediate log is retained.
- Invalid CSV rows initially used workspace-formatted currency. They now show original currency/amount until valid; the visible USD row remains invalid/unposted. No currency conversion was added.
- Development API errors during a mounted-filesystem cold restart recovered via **Retry** once healthy. Final warning/error observations are empty. Preview/release output folders stayed isolated; zero-downtime deployment is not established.

## Reproduce and resume

Use the separate local test setup in the [M0–M1 evidence](../2026-10-02-first-release/README.md). From `backend`, with test dependencies and no customer database selected:

```sh
DEBUG=true JWT_SECRET_KEY=local-cash-test-secret-padding-32-chars DATABASE_URL=sqlite:///./cash-test.db .venv/bin/pytest -q
DEBUG=true JWT_SECRET_KEY=local-cash-test-secret-padding-32-chars DATABASE_URL=sqlite:///./cash-test.db .venv/bin/pytest -q tests/test_cashflow.py tests/test_cashflow_m2.py
DEBUG=true JWT_SECRET_KEY=local-cash-test-secret-padding-32-chars DATABASE_URL=sqlite:///./cash-test.db AEGIS_CASH_TEST_DATABASE_URL=postgresql://postgres:aegis-local-test-only@127.0.0.1:5548/aegis_cash_test .venv/bin/pytest -q tests/test_cashflow.py tests/test_cashflow_m2.py
```

These values are disposable local test settings. PostgreSQL cash fixtures create/drop unique schemas in the dedicated database. From `frontend`:

```sh
node ../scripts/verify-cash-client-session.mjs
AEGIS_DIST_DIR=.next-cashflow-release NEXT_TELEMETRY_DISABLED=1 BACKEND_INTERNAL_URL=http://127.0.0.1:8000 NEXT_PUBLIC_API_URL='' NEXT_PUBLIC_GOOGLE_CLIENT_ID='' npm run build
```

Set backend `PYTHONPATH` and local DEBUG/JWT settings for `scripts/rehearse-cashflow-m2.py --url …`. SQLite requires a fresh nonexistent file under `/mnt/data/aegis-m2-2026-10-02/`. PostgreSQL requires a fresh `aegis_cash_m2_migration_test` or `_r1`–`_r9` database on localhost:5548; the script creates it. The successful run used `_r2`; do not repeat against a populated name.

After a separate restore, `scripts/verify-cashflow-m2-backup.py --source … --restored …` permits only localhost:5548 `aegis_cash_test`/`aegis_cash_m2_restore_test`. Supply local DEBUG/JWT/PYTHONPATH for application imports. It compares rows/forecasts; it does not perform the restore.

At handoff the task-local services were active: `aegis-cashflow-api.service` on 127.0.0.1:8000 and `aegis-cashflow-web-isolated.service` on 127.0.0.1:3106. Docker `aegis-cashflow-test-20261002` exposes PostgreSQL only on 127.0.0.1:5548. Recheck these volatile resources before reuse. The cash flag stays disabled by default outside this pilot.

Independent review, remote CI and owner/customer feedback remain pending. MySQL certification, load/security audits, real-bank data, managed provisioning, M3 business documents/13-week snapshots and M4 workspace chat capture remain outside these checks. No public feature rollout occurred.
