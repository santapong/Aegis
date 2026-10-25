# Migration and recovery rehearsal — October 22, 2026

Result: **passed on SQLite and actual PostgreSQL 16.15**. All inputs were fictional; no production database, live LINE identity, provider credential, public endpoint or API preview database was used. Exact machine-readable assertions, source hashes and inventories are in [migration-restore.json](migration-restore.json).

For each backend, `scripts/rehearse-line-ledger.py` executed:

- Real Alembic upgrade to predecessor `a1002cf00004`, then insertion of a legacy THB-unconfirmed expense `150.25`, category `rehearsal-food`, one trip and one tag association.
- Upgrade to `a1022lf00001`, unused-new-schema downgrade to the predecessor, and reupgrade, preserving all prior values and links.
- An opening of 2,000,000 satang and an explicitly confirmed 15,025-satang expense, linked to a PNG captured through the real private capture service. Resulting tracked position: **1,984,975 satang**.
- Populated downgrade refusal with byte-equivalent normalized table rows before/after the rejected attempt.
- Database backup first, immutable private evidence copy second, restoration into a separate empty database/directory, and equality of all rows across **61 tables**.
- Equality of four postings, two journals, two projections, three idempotency records, one evidence row and one entry/evidence link. Balances and projection effects were recomputed through the canonical services.
- Matching private image size/SHA-256, mode-0700 evidence directories and mode-0600 objects. The generated 77-byte PNG's SHA-256 is `e7e2154336f1a7eb8dd6dbe8609fd56b0416cde54d5c443677d78a612a3ab8c4`.
- Retry of the original confirmation key and completed capture capability after restoration, with no changed database rows or duplicate financial/evidence effect.

SQLite used the SQLite backup API; PostgreSQL used actual `pg_dump --format=custom` and `pg_restore --exit-on-error` inside the disposable local container. Measured backup-and-restore sections were 0.518 seconds and 1.707 seconds respectively; total backend rehearsals were 23.037 and 13.998 seconds. These tiny fixture timings do not estimate production recovery time.

Two uniquely named PostgreSQL fixture databases were dropped. Home-filesystem temporary databases, dumps and image directories were removed. The existing `aegis_ledger_test` database, container and preview `/tmp` SQLite database remained available. Core source hashes were unchanged during execution.

The existing predecessor SQLite schema emits SQLAlchemy reflection warnings about previously altered foreign-key declarations; these were observed, not hidden. The restored SQLite `PRAGMA foreign_key_check` returned no violations for the actual fixture. This is not a claim that every historical SQLite foreign-key declaration was repaired.

The optional [Compose overlay](../../../docker-compose.line-ledger.yml) was parsed with all profiles and a validation-only empty environment-file override; [compose-overlay.json](compose-overlay.json) records its delivery-false/default-disabled gates, startup ordering and mounts. No overlay worker image/service was built or activated. A default parse without profiles omitted those services; rendering all profiles was necessary for the structural assertions. No operator `.env` file was read.

Remaining owner/deployment gates: encrypted off-device destination and recovery-key custody, daily scheduling and measured production recovery-point interval, retention decisions, actual provider/channel setup, hosted worker runtime, public TLS, real slip extraction and handset acceptance. The fixture archive was intentionally unencrypted and destroyed after restoration; encrypted production backups are prepared as an operator procedure, not claimed to be running.
