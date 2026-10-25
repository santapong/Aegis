# First cash-planning release — local validation

October 2, 2026 · **M0–M1 implemented and verified locally for an owner pilot.** No production deployment, commit, push or version tag was made. The public landing and earlier fictional demo remain separate artifacts. See the [release guide](../../releases/2026-10-02-first-cashflow-release.md) and [implementation plan](../../plans/2026-10-02-cashflow-implementation.md).

## Source and environment

Validation used the working tree of `/mnt/data/company/apps/Aegis`, branch `agent/comet-asset-prompt`, starting HEAD `e2c4a9c68d6304799ff5bc28b9fef7cf951f3878`. This checkout already contained unfinished public-design, documentation and LINE work. A whole-tree diff must not be attributed to this release. Starting status and source copies are retained outside the repository in `/mnt/data/aegis-first-release-2026-10-02/baseline/`.

The source manifest records hashes of application code, migrations, tests, scripts and required local assets after the final checks. It excludes environment files, dependencies, build output and database backups. It identifies this dirty working-tree build; it is not a release commit. `checks.json` summarizes results and artifact hashes.

Local checks used Python 3.11.11, FastAPI 0.136.1, Pydantic 2.13.4, SQLAlchemy 2.0.49, pytest 9.0.3, MCP 1.30.0, PostgreSQL 16 and Node 26.8.1. `uv lock --check` passed after adding MCP to the test extra. Existing locked package versions and artifacts were retained.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Full backend regression, including MCP and LINE | 157 passed, 1 skipped | [backend-regression.log](backend-regression.log) |
| Cash API on actual PostgreSQL, including concurrent confirmation | 20 passed | [cash-postgres-tests.log](cash-postgres-tests.log) |
| Cash API on SQLite | 19 passed, 1 skipped | [cash-sqlite-tests.log](cash-sqlite-tests.log) |
| Legacy MCP ownership and cash-edit restrictions | 7 passed | [mcp-regression.log](mcp-regression.log) |
| Frontend types | Exit 0 | [frontend-types.log](frontend-types.log) |
| Production frontend build | Exit 0; 41 pages generated | [frontend-build.log](frontend-build.log) |
| New cash Python and rehearsal/restore scripts, Ruff | Passed | [cash-lint.log](cash-lint.log) |
| API session and validation checks, Node and Bun | Passed | [client-session-checks.log](client-session-checks.log), [client-session-bun.log](client-session-bun.log) |
| Migration rehearsal with legacy rows, SQLite | Passed | [migration-sqlite.log](migration-sqlite.log) |
| Migration rehearsal with legacy rows, PostgreSQL | Passed | [migration-postgres.log](migration-postgres.log) |
| Local dump/restore comparison | Table counts and every base forecast equal | [backup-restore.log](backup-restore.log) |
| Fresh browser console after reload and guide navigation | No warning/error entries in observed interval | [browser-console.json](browser-console.json) |
| Working-tree whitespace check | Passed | `git diff --check` |

The SQLite skip is the PostgreSQL-only concurrent-match test; that test passed in the separate real PostgreSQL run. Backend warnings concern existing Passlib `crypt` and debts-route `regex` deprecations. The build logs a Node module-registration deprecation. None was treated as a clean dependency/security audit. CI configuration was updated, but remote CI was not executed in this task.

Cash tests exercise owner boundaries, exact cents/date limits, missing anchors, currency/account/direction mismatches, overdue and future-record warnings, month-end/leap/weekend recurrence, linked-source deduplication, retry keys, stale revisions, partial/over-allocation, correction history, paired transfers and stale destination rejection, historical adoption/exclusion and LINE undo protection. Concurrent PostgreSQL matching permits one confirmation and rejects the stale contender without duplicating cash or allocations. Saving/refreshing a comparison does not mark other comparisons stale; changing cash inputs does.

The client-session check runs the actual API module with controlled network/store substitutes: an old session's successful response is rejected, its 401 cannot log out a newer owner, current-session responses succeed, and structured validation messages do not expose raw input. The cash screen also remounts drafts when the authenticated owner changes and clears owner query caches. This is not a penetration test.

## Example acceptance and browser evidence

API fixtures use an October 10, 2026 as-of date and October 31 end date. The live pilot runs on October 2: its fictional actuals were moved to October 1 so the server can accept them truthfully. It does not accept future actual movements. The same cash engine produces these example results:

| Story | Verified result in THB |
| --- | --- |
| Mina base | Cash 47,000; closing 48,900; closing above 5,000 buffer 43,900 |
| Mina laptop, 45,000 on October 12 | Closing 3,900; below buffer October 12; minimum −500/first negative October 16 |
| Business X base | Cash 89,000; closing 98,000; closing above 10,000 buffer 88,000 |
| Client's 90,000 receipt moved to November 5 | October closing/minimum 8,000 on October 26; headroom −2,000; no negative October day; later receipt retained |
| Late receipt plus equipment moved to November 2 | October closing/minimum 20,000; headroom 10,000; two later items retained |
| Utilities payment 1,200 and match | Cash 45,800; remaining costs 4,900; closing stays 48,900; match cash effect zero |
| Contractor payment 65,000 and match | Cash 24,000; closing stays 98,000; undo allocation and record reversal restore base |
| Client receipt 30,000 and partial match | Cash 119,000; receipt remainder 60,000; closing stays 98,000; undo/reversal restore base |

Live browser checks additionally recorded a 100 THB transfer from personal to business, inspected both workspace balances, and recorded the return leg. Both movements remain in the audit. A new business workspace/account had unknown cash until a checked opening amount of 1,000.25 was entered; its 100 buffer left headroom 900.25. A server-rejected 1,000.999 opening amount retained the draft and was corrected to valid cents. A payment match was previewed, confirmed, undone and its original entry reversed through the UI.

The calendar's October 16 value agreed with the personal cash source table. Saved workspaces and scenarios survived reload. Escape restored focus and preserved an unsaved same-target form. Changing the target record replaced its date defaults rather than carrying another record's unsaved date. Scenario date inputs were checked both onscreen and in the saved comparison output.

Responsive checks used 1280×720, 390×844 and 320×800. At phone widths, the document and main content had no horizontal overflow, the sidebar could close, forms remained reachable, and exact amounts did not wrap mid-number. Final viewport overrides were reset. These are browser checks, not independent customer comprehension or accessibility certification.

- [Business receipt-delay desktop](business-scenario-desktop.png)
- [Personal laptop desktop](personal-laptop-desktop.png) and [source text](personal-laptop-dom.txt)
- [Stable business phone view](business-mobile-390.png)
- [Payment-match preview](match-preview.png)
- [390-width setup form](mobile-setup-dialog.png), [320-width form](mobile-320-dialog.png)
- [Personal calendar](personal-calendar-dom.txt), [incomplete setup](setup-incomplete-dom.txt)
- [Contractor payment](business-contractor-dom.txt), [partial receipt](business-partial-receipt-dom.txt), [two-date comparison](business-two-date-dom.txt)
- [In-app cash-planning guide](cash-guide-dom.txt)

## Migration and restoration evidence

Both migration rehearsals created an old-schema fictional owner, plan and linked transaction, then upgraded to the cash revision. Existing IDs, owner, amount, plan link, description and indexes were retained; historical transactions stayed unassigned. A second upgrade was harmless. An empty cash-schema downgrade/re-upgrade worked. Once a workspace existed, downgrade was explicitly refused. These are disposable fixtures, not a migration of customer data.

The final PostgreSQL dump was restored into a separate task-created database. All table counts and all three base forecasts for October 2–31 matched exactly. Final cash-table counts: 3 workspaces, 3 accounts, 3 balance anchors, 9 commitments, 9 occurrences, 3 settlement rows, 2 transfer rows, 4 scenarios and 44 audit rows. Some settlement rows are reversed; counts are not claims of active payments. The backup includes local fictional authentication data and stays outside the repository at `/mnt/data/aegis-first-release-2026-10-02/owner-pilot-backup-final.dump`.

## Reproduce the checks

Use a separate local test environment. The existing generic regression suite uses SQLite; the cash PostgreSQL fixture creates and drops uniquely named schemas only inside `aegis_cash_test`. Do not point test tools at an installation's real database. The scripts enforce their stated disposable paths/database names.

From `backend`, with test dependencies installed and a disposable local configuration:

```sh
DEBUG=true JWT_SECRET_KEY=local-cash-test-secret-padding-32-chars DATABASE_URL=sqlite:///./cash-test.db .venv/bin/pytest -q
DEBUG=true JWT_SECRET_KEY=local-cash-test-secret-padding-32-chars DATABASE_URL=sqlite:///./cash-test.db .venv/bin/pytest -q tests/test_cashflow.py
DEBUG=true JWT_SECRET_KEY=local-cash-test-secret-padding-32-chars DATABASE_URL=sqlite:///./cash-test.db AEGIS_CASH_TEST_DATABASE_URL=postgresql://postgres:aegis-local-test-only@127.0.0.1:5548/aegis_cash_test .venv/bin/pytest -q tests/test_cashflow.py
uv lock --check
```

From `frontend`:

```sh
npx tsc --noEmit
node ../scripts/verify-cash-client-session.mjs
AEGIS_DIST_DIR=.next-cashflow-release NEXT_TELEMETRY_DISABLED=1 BACKEND_INTERNAL_URL=http://127.0.0.1:8000 NEXT_PUBLIC_API_URL='' NEXT_PUBLIC_GOOGLE_CLIENT_ID='' npm run build
```

Keep the running preview's `.next-cashflow-preview` folder separate from `.next-cashflow-release`. A shared Next build folder previously invalidated the running development route; the separate folders resolved that observed failure. Native date changes previously appeared on screen without reaching a saved scenario; functional draft updates plus `onInput`/`onChange` handling resolved the verified flow. Their individual causal contributions were not isolated.

For a new SQLite migration rehearsal, use a **fresh nonexistent** file under `/mnt/data/aegis-first-release-2026-10-02/`, pass it to `scripts/rehearse-cashflow-migration.py --url`, set `PYTHONPATH` to the backend, and provide the same local DEBUG/JWT configuration. PostgreSQL rehearsal requires the dedicated `aegis_cash_migration_test` database not to exist; its script creates that database. Do not reuse a populated database to repeat the rehearsal.

`scripts/verify-cashflow-backup.py --source … --restored …` compares only `aegis_cash_test` and `aegis_cash_restore_test` on localhost port 5548, after a separate restore. Supply local DEBUG/JWT configuration even though the comparison itself is read-only; model imports initialize application settings. The preview seed script requires `AEGIS_ALLOW_DISPOSABLE_CASH_SEED=yes` and its explicitly named fictional account. Verify that localhost port 8000 is the isolated API before using it.

## Pilot resources and remaining release gates

At handoff, the task-created API and web user services were active; the local app is **http://127.0.0.1:3106/cashflow**. PostgreSQL runs in `aegis-cashflow-test-20261002`, bound only to 127.0.0.1:5548. API service: `aegis-cashflow-api.service`; web service: `aegis-cashflow-web-isolated.service`. Future sessions must recheck these volatile resources before use. They do not establish public hosting.

M2–M4, owner feedback, deployment-specific data review/migration/backup/monitoring, public hosting, hosted billing and light-theme acceptance remain open. MySQL, bank feeds, real chat delivery, payroll, tax, team access, independent comprehension, performance/load testing and production security were not verified. A feature flag is disabled by default outside the isolated pilot. Downgrading away populated cash data is refused; rollback must preserve records and audit.
