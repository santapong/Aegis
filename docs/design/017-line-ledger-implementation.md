# LINE ledger implementation decisions

Date: 2026-10-22. Status: implementation; independent review pending.

The October 18 SDD is retained in 016. This document resolves changes in the actual working baseline.

| Choice | Verdict |
| --- | --- |
| Extend Numeric legacy cash transactions into cards/refunds | Rejected: positive income/expense DTO cannot express exact journal effects or immutable corrections |
| Replace existing cash planning immediately | Rejected: inherited uncommitted work and existing matched/scheduled histories need explicit migration evidence |
| Add disabled finance ledger + explicit owner cutover | Selected: one canonical posting service with additive tables and fail-closed writer adapters |

Ledger writes serialize on the owner row in PostgreSQL. This intentionally favors a bounded single-owner pilot's correctness over maximum write throughput. Database composite FKs preserve ownership, deferred triggers enforce balanced committed journals, and append-only triggers protect financial records. SQLite retains service validation and compatibility only.

A new account is independent of a historical cash workspace account. No balance or currency is guessed from display settings or copied from old anchors. Existing rows remain historical; a deliberate confirmed-currency/replay mapping is required before combining them with THB reports. Accountless writers fail after ledger cutover.

Services flush but do not commit. HTTP/LINE/job boundaries own the single transaction. External messages and OCR execute outside financial commits. Source jobs and human action versions are separate authorities.

Structural downgrade is for disposable unused schemas only. Operational rollback disables ingestion/exposure and preserves posted history. Database/evidence backup and recovery verification are separate from source tests.
