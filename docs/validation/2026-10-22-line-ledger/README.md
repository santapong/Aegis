# LINE money workflow execution evidence

October 22–23, 2026, Asia/Bangkok. All financial data used here is fictional. Source is the isolated `feature/line-money-ledger-20261022` worktree; original dirty checkout preserved. No commit/push/deployment or live-channel activation is implied.

| Evidence level | Observed result | Boundary |
| --- | --- | --- |
| Baseline/source review | Existing cash/LINE MVP reconciled against October 18 SDD; next free design slot used | Source is not deployment proof |
| Local unit/regression | [Kali full suite](backend-sqlite.log): 252 passed, 16 skipped at that checkpoint | Later source additions are separately qualified on Pi |
| Real PostgreSQL | [Ledger/report/concurrency](ledger-postgres.log), independent cutover-race and integration checks | Dedicated disposable databases and actual Alembic chain; SQLite does not establish locking |
| Migration/restoration | [SQLite + PostgreSQL receipt](migration-restore.md), [machine receipt](migration-restore.json) | Populated predecessor preservation, unused downgrade/reupgrade, posted downgrade refusal, full-row DB/evidence restore; tiny fictional fixture only |
| Native n8n | [Fixture summary](n8n-fixture-results.json): three imports/executions, no HTTP nodes, network disabled | Live HTTP/provider/error paths remain distinct; exports are inactive/manual/fictional |
| Frontend | [Browser/type/build notes](frontend.md) | Desktop/320px fictional flow; final cold production console check was interrupted by workstation resource correction |
| Pi qualification | [October 23 receipt](../2026-10-23-rpi/README.md) | Serial ARM64 tests, enforced CPU quotas, soft memory/temperature watchdog; kernel memory controller absent |

Independent review identified and drove fixes for reversed-row classification, replacement evidence validation, future exact timestamps, owner/cutover races, trip slug/deletion behavior, signed duplicate candidates, Bangkok reporting boundaries, dashboard exact formatting, stale review notifications, and n8n retry classification. Changed paths were rechecked in the matching test scope.

Ruff on changed finance files passes. Whole-app lint retains inherited findings in untouched modules; [whole-app output](ruff.log) must not be described as globally green. Bandit `-ll` completed without findings in [its log](bandit.log).

Real LINE delivery, real receipt/OCR acceptance, deployment-specific backup scheduling/encryption/retention, operator G1/G2 and production activation G3 remain unrun. Accountless legacy callers fail closed after ledger cutover and must adopt canonical drafts; automatic legacy-history replay and live projection repair are not claimed.
