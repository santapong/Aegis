# Production schema gate

The Vercel application is the linked root Services project, Node24. Production
DB configuration is sensitive/non-exportable. A local CLI env-run can fall back
to local dotenv settings, so that result is not authoritative production evidence.
No database connection value is printed or copied into this report.

The backend service build runs scripts/release_schema.py after its managed Python
installation. Outside Production it performs no DB work and refuses a migration
flag. Production builds require the expected schema head. Only an explicit
AEGIS_RELEASE_SCHEMA_TARGET=a1022lf00001 build flag authorizes forward migration.

The operator uses the deployment's actual DATABASE_URL. A managed direct URL is
selected only when endpoint/database/user match the canonical connection. One
transaction owns the advisory release lock, local5s statements/1s locks/10s idle,
4MiB work memory,32MiB maintenance memory and zero parallel workers, preserving
any stricter settings. Legacy tables above32MiB or100,000rows require a separate
plan. Existing legacy projections are locked and checksummed entirely inside
the transaction; no financial values or checksums are exported. Any mismatch
rolls back both DDL and data. Populated ledger/cash domains are never downgraded.

Four actual PostgreSQL rehearsal cases passed: default production gate blocks an
old schema; explicit upgrade preserves records and is idempotent; Preview/wrong
head refuse; another migration owner refuses; an injected preservation failure
rolls back the DDL and original amount. See out/schema-tests.log.

Release sequence: final CI; stage a Production-target deployment with --skip-domain
and the explicit build flag; inspect its schema/build outcome; then publish the
main/tag release. Native main builds verify the migrated schema without the flag.
The existing production remains assigned while the explicit staging build runs.
