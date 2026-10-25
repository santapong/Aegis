# LINE ledger operations

Prepared and locally rehearsed on October 22, 2026. The ledger and real message delivery remain disabled by default. The [migration/restore receipt](../validation/2026-10-22-line-ledger/migration-restore.json) covers fictional SQLite and PostgreSQL data; it is not a production deployment, daily backup schedule, real OCR run or handset-delivery result.

## Deployment and workers

Run the public authenticated API, PostgreSQL, persistent media capture worker and private evidence storage on hosting that survives HTTP request completion. n8n may coordinate text/extraction jobs over outbound HTTPS. Capture must continue independently of n8n or a home Pi being unavailable. Private tailnet routes alone cannot receive LINE callbacks.

`docker-compose.line-ledger.yml` is an optional overlay on the existing base Compose file. It adds separate `text`, `capture` and `extract` processes under the `line-ledger` profile and a separately gated `deliver` process under `line-ledger-delivery`. No profile was activated during preparation. The API completes migrations before workers start; workers bypass the image's migration entrypoint. A one-shot init service assigns the evidence volume to the image's non-root `appuser` and restricts its directory to mode 0700. API, extraction and delivery mounts are read-only; capture is the only worker that writes evidence.

The overlay fixes `FINANCE_INTEGRATION_DELIVERY_ENABLED` to `false`, including when an operator environment contains `true`. Starting its delivery profile before a separately reviewed activation override exits without sending. Its restart policy is `no`. Both feature and delivery activation require the owner gates in the SDD; preparing this overlay does not grant activation authority.

Configuration belongs in the hosting secret interface or a private home-filesystem file, never in Git, workflow exports or logs. Configure the existing names: `DATABASE_URL`, `JWT_SECRET_KEY`, `FINANCE_LEDGER_ENABLED`, `LINE_FINANCE_CHANNEL_ID`, `LINE_FINANCE_CHANNEL_SECRET`, `LINE_FINANCE_ACCESS_TOKEN`, `LINE_FINANCE_DESTINATION`, `FINANCE_INTEGRATION_SERVICE_TOKEN`, `FINANCE_INTEGRATION_DELIVERY_TOKEN`, `FINANCE_INTEGRATION_EVIDENCE_DIR` and `FINANCE_INTEGRATION_DAILY_PUSH_BUDGET`. Image extraction additionally requires the explicitly chosen `FINANCE_INTEGRATION_OCR_PROVIDER`, `FINANCE_INTEGRATION_OCR_MODEL` and `FINANCE_INTEGRATION_OCR_KEY`. The service and delivery tokens have separate scopes. n8n does not need the LINE channel secret.

After explicit rollout approval, an operator can select the non-delivery worker profile with the reviewed private configuration:

```sh
docker compose -f docker-compose.yml -f docker-compose.line-ledger.yml \
  --profile line-ledger up -d ledger-text ledger-capture ledger-extract
```

This command is documented, not executed. It requires a built image containing the new source, an approved database migration, persistent storage and valid configuration. The capture/extract processes reject missing credentials instead of fabricating provider readiness. Production public TLS, restart supervision, disk capacity, secret access, off-device storage and worker runtime checks remain operator acceptance tasks. The overlay's configuration was parsed with all profiles, a validation-only empty environment-file override and delivery disabled; no worker image was built or started from it.

## Health, failures and retries

The existing API image's HTTP probe cannot establish worker health. The overlay disables that inherited worker probe. Observe the process supervisor and durable database progress: oldest queued job age, available/expired leases, retry counts, failed/needs-review jobs, capture failures, outbox age and the conservative daily push-attempt budget. Report queue time separately from provider time. A running worker alone does not prove job completion.

Safe diagnostics include correlation/event/job/draft/journal IDs, timing, state and error code. Do not log message bodies, extracted account details, image bytes, tokens or provider response bodies. Restrict n8n execution-data access and retention; avoid saving successful execution bodies containing financial content.

Read-only queue inspection:

```sql
SELECT kind,state,count(*) AS jobs,min(available_at) AS oldest_available,
       min(lease_until) AS oldest_lease
FROM finance_integration_jobs GROUP BY kind,state;

SELECT state,count(*) AS messages,min(next_at) AS oldest_next,
       max(attempts) AS highest_attempt_count
FROM finance_notification_outbox GROUP BY state;

SELECT day,attempts FROM finance_delivery_budgets ORDER BY day DESC;
```

Job leases are fenced by generation and an opaque capability. Restart a failed worker only after diagnosing the safe error code and confirming its configuration. Expired leases can be reclaimed; an old worker cannot overwrite the new generation. Financial confirmation retries use the original draft version and idempotency key. Do not create a replacement financial transaction merely because a success notification failed.

Delivery claims durably reserve an attempt and frozen recipient/body before calling LINE. Retries retain the same retry key. An ambiguous timeout can consume an attempt without establishing handset delivery. The implementation holds old delivery records for review after its bounded retry window; do not reset their IDs or repost financial effects. Unlinking cancels future access and pending work; it cannot recall a provider request already in flight.

## Daily encrypted backup contract

The pilot requires a successful encrypted off-device backup at least daily. Record actual backup completion times, the latest recoverable database snapshot time, evidence coverage and failures; a timer being installed is not a successful backup. No production timer, encryption recipient, storage destination or retention interval has been configured by this work.

The operator must choose the encrypted destination, recovery-key custodian, evidence retention and backup retention before everyday use. Preserve the secret-encryption key/JWT-key recovery material through a separate private recovery mechanism; a database dump alone cannot recover encrypted user settings after their key is lost. Never put recovery secrets beside a public manifest or source checkout.

Use a least-privilege PostgreSQL backup identity through private `PGSERVICEFILE`/`PGPASSFILE` configuration or the hosting secret interface. Do not put a database password in a command argument or print the environment. `pg_dump` supplies a consistent database snapshot. Dump the database first, then copy immutable evidence. Prevent retention/deletion for the entire backup interval. Capture writes and fsyncs each private object before its database row commits, so an object referenced by the dump must exist before the later evidence copy. Newly captured objects not referenced by that dump may appear as extra private files; they are not extra financial transactions.

Use a backup/retention lock shared by all future retention jobs. Do not enable evidence deletion until this lock and the owner's policy are implemented. A backup job must fail if a referenced object is absent or mismatched; it must not silently accept an incomplete archive.

The following shell shape is a deployment template. Paths, encryption recipient and off-device copy command need the owner's reviewed private configuration. `age` is not installed by this work. Keep the staging directory on a filesystem that actually honors mode 0700/0600, and verify those modes. The known `/mnt/data` mount has previously ignored chmod; a successful chmod exit is insufficient evidence.

```sh
set -euo pipefail
umask 077
exec 9>/private/aegis-backup-retention.lock
flock -x 9
stage=$(mktemp -d /private/aegis-backup.XXXXXXXX)
trap 'rm -rf -- "$stage"' EXIT

# PGSERVICE/PGSERVICEFILE/PGPASSFILE are injected privately by the operator.
pg_dump --format=custom --no-owner --no-acl --file "$stage/database.dump"
cp -a /private/aegis-evidence "$stage/evidence"
(cd "$stage"; find evidence -type f -name '*.bin' -print0 | sort -z | \
  xargs -0 -r sha256sum > evidence.sha256)
tar -C "$stage" -cf "$stage/backup.tar" database.dump evidence evidence.sha256
age --encrypt --recipients-file /private/aegis-backup-recipients.txt \
  --output /private/outgoing/aegis-backup.tar.age "$stage/backup.tar"
# Copy the encrypted archive off-device and verify the received archive hash.
# Verify the database-referenced object inventory during the isolated restore.
```

Install a daily scheduler only after the backup command, private paths, recipient and destination have been reviewed and a restore has succeeded. Alert on a missed successful run or an actual recovery-point interval over the owner's approved target. Keep the scheduler and its notifications private. The fictional rehearsal measured a single backup/restore, not a production daily recovery-point interval.

## Restore and qualification

Restore into a new isolated database and a new private evidence directory. Never point `pg_restore`, an Alembic downgrade or fixture scripts at the live database. Disable public ingress, provider credentials, all delivery and retention in the restore environment. Decrypt locally using the separately held recovery identity; keep plaintext staging private and remove it after verification.

1. Verify the encrypted artifact's transport hash, decrypt it and verify its evidence manifest.
2. Create a fresh isolated database; use `pg_restore --no-owner --no-acl --exit-on-error`. Restore the evidence directory with private modes and correct service ownership.
3. Check the Alembic revision and all table counts. Check every journal has at least two nonzero same-owner postings and a zero sum. Rebuild balances from postings and verify projection control-account effects.
4. Compare idempotency outcomes, draft states, correction/refund links and legacy amount/category/trip/tag values with the backup manifest. Each database evidence row must resolve to a private file of the recorded size and SHA-256. Extra unreferenced files remain private and need review, not automatic deletion.
5. Replay a known confirmation key and completed capture capability in the isolated fictional environment; verify no second journal, projection or evidence row appears. Do not exercise real provider credentials during this check.
6. Record database/evidence snapshot times, measured restore time, source revision/file hashes, results and limitations. Only then propose an owner-reviewed recovery or cutover action.

Reproduce the complete local fictional rehearsal using the existing Python environment and the explicitly allowed disposable PostgreSQL container:

```sh
/mnt/data/company/apps/Aegis/backend/.venv/bin/python scripts/rehearse-line-ledger.py \
  --output docs/validation/2026-10-22-line-ledger/migration-restore.json
```

The script refuses a different container/port, creates unique databases, uses an empty private working directory with no `.env`, captures a generated 77-byte PNG through the real capture service, and removes its fixture databases and temporary files. `--sqlite-only` omits PostgreSQL; such a run must not be presented as PostgreSQL validation. It never changes the existing test database or an API preview database.

## Migration and operational rollback

Back up and rehearse before migration. The executed rehearsal upgraded populated `a1002cf00004` history, performed an unused-new-schema downgrade/reupgrade, and preserved original amount/category/trip/tag values. After new postings existed, downgrade was refused without changing any persisted row on both SQLite and PostgreSQL.

Operational rollback after any opening/posting disables exposure, ingress and provider workers while preserving the additive schema and all journal/evidence history. Reverting application code must not reopen an accountless legacy writer; the owner-specific cutover guard stays active after an opening even when the feature flag is disabled. Never drop financial tables, overwrite an opening balance or invent an adjustment to hide a reconciliation difference. Use reviewed reversal/replacement or a scoped migration procedure.

For credential rotation, first stop the affected scoped workers and pause new intake if its signature credential changes. Rotate through the provider and private secret interface, restart only the intended components, and verify a deliberately signed sample before resuming. Unlink through authenticated settings. Keep outstanding journal history, idempotency records and evidence references; credentials and revoked identities do not confer permission to rewrite money.
