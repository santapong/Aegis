# Fictional Aegis phone pilot — 23 October 2026 (Asia/Bangkok)

The owner chose the separate Aegis Finance bot and a fictional THB 1,000 account. The text → preview → owner Confirm → posted-reply phone test passed. Final balance: THB 999, exactly one matching expense journal. The owner then chose pause and both pilot n8n workflows were verified inactive. The one-use connection command and login are kept in owner-private local files, excluded from this repository and from chat output.

Final machine summary: [final.json](final.json). This acceptance is limited to the fictional text flow; slip OCR, load qualification and production financial cutover are not claimed.

## Verified setup

- New Pi PostgreSQL database, user and persistent volume; one `pilot` cash account with a posted opening of `100000` satang. No existing finance database was migrated or replayed.
- New API, standalone frontend, exact-route gateway and temporary Cloudflare tunnel. Only signed POSTs to `/api/integrations/line/webhook` reach the API publicly. The dashboard is available to this workstation through a localhost-only SSH forward; application/auth endpoints are not published.
- Expected bot `Aegis Finance`, basic ID `@584vqkxf`, verified against LINE's bot-info API before webhook change. The prior webhook is backed up privately. LINE's real webhook test returned success/HTTP 200; invalid signatures returned 403 and other public paths returned 404.
- Existing queue-mode n8n workers reached only the new API after that API joined their existing attachable network. No worker, existing assistant, production database, nginx or Tailscale route was replaced or restarted.
- At setup, two dedicated workflows were activated: ingestion `yUUJliO9439EVaoh`, delivery `rRNIFwkxyjNMcULA`. Both have successful native scheduled executions and were later paused at the owner's choice. Ingestion claims text jobs only. The initial empty-queue checks established credentials/connectivity; they did not establish phone delivery.
- The private frontend's authenticated API returned the expected exact opening balance. Source export defaults remain inactive and uncredentialed.

Sanitized machine receipt: [readiness.json](readiness.json). That snapshot preceded phone linking; later results require their own receipt.

## QR onboarding feedback

When the owner needed help with dashboard login/linking, a fresh authenticated
one-use command was prepared in an owner-private local file, then encoded locally
as a QR for LINE's prefilled bot-chat link. No QR service received the token.
The identity subsequently linked, and after the completed test the owner
explicitly called the QR idea good and asked to preserve the lesson. This
supports offering the private QR early for similar phone onboarding. The exact
phone scan/transfer path was not independently captured, and onboarding time or
comparative benefit was not measured. The ten-minute, one-use capability is
enforced by the server; an old QR must not be treated as a permanent login.

## Observed phone link

At 01:27 ICT, the owner reported sending the link command. The read-only [linked-state snapshot](linked.json) verifies an active identity, one processed inbox event, a provider-accepted reply and the unchanged `100000` satang balance. Actual n8n execution [17177](link-delivery-execution.json), started at 01:26:55 ICT, successfully traversed the real `LINE push frozen body` and `Record provider outcome` nodes. No payloads, recipients or capability tokens are included in that receipt.

The owner initially selected the answer reporting a preview, while two database checks still showed no expense event/job/draft. The owner then clarified that the expense had not been sent. That initial selection is superseded by the explicit clarification and subsequent source observations.

## Verified expense preview

After the owner reported sending the expense command, the [preview receipt](preview.json) verifies exactly one matching draft, the expected fictional source account, no validation errors, no financial journal and an unchanged `100000` satang balance. The real text job completed in [n8n execution 17269](expense-ingestion-execution.json) at 01:30:45 ICT. The preview was accepted by LINE through [execution 17272](preview-delivery-execution.json) at 01:30:50 ICT. These receipts contain node names and safe state only. The owner was then asked to tap Confirm.

## Verified owner confirmation and pause

The owner explicitly reported a posted confirmation reply after tapping Confirm. The [posted receipt](posted.json) verifies one posted matching draft, exactly one matching expense journal, no other financial journals beyond opening, and `99900` satang in the fictional account. Three processed inbox events and three provider-accepted outbox records cover linking, preview and confirmation. The journal notification is bridged once. [Native execution 17314](posted-delivery-execution.json), started at 01:32:30 ICT, traversed the real provider push and outcome nodes successfully. The handset observation is owner-reported, independently of the database/provider observations; no phone screenshot was captured.

At the owner's explicit choice, only these two pilot workflows were deactivated. [Paused workflow metadata](paused-workflows.json) verifies both inactive. The private app/database, gateway/tunnel and resource guard were retained for review, so this is not a complete runtime teardown or webhook restoration. New text will not be processed by the paused n8n ingestion workflow. The immutable fictional transaction remains available for inspection.

[Resource snapshot after the phone test](resources-after-phone-test.json) records approximately 459 MiB current summed RSS, approximately 12.2 GiB available host RAM, temperature 56.2°C and no watchdog events. Idle point samples of the five pilot containers totaled approximately 0.14% of one CPU; the shared n8n main/workers totaled approximately 0.67%. These are brief samples after processing, not a sustained-load benchmark or a complete CPU trace of the request.

## Resource scope

Heavy preparation ran on the Pi with one build at a time. Runtime Docker CPU quotas are API 0.35, database 0.15, frontend 0.20, gateway 0.05 and tunnel 0.10 cores. Existing shared n8n processes have their existing resource settings. Idle point samples were below 2% of one CPU per pilot container; they are not sustained-load benchmarks.

The active watchdog observes summed process RSS, available host RAM and temperature; it stops only the named pilot containers above its thresholds. The kernel still lacks memory cgroups, so this is not a hard aggregate memory cap. At the readiness snapshot, sampled preparation peak RSS was approximately 1,216 MiB, current RSS approximately 514 MiB, temperature 56.75°C, with zero guard events. See the JSON for exact values and check time. No Aegis build/test was launched on Kali for this pilot.

## Executed owner-phone acceptance

1. Owner sends the private expiring link command to this bot in a one-to-one chat. Require the observed identity link and LINE acceptance of the connection reply; owner verifies the handset reply.
2. Owner sends `expense 1 Aegis phone pilot fictional account:pilot`. Require a ready draft/preview and an unchanged `100000` satang balance.
3. Owner taps Confirm. Require exactly one matching expense journal, balance `99900`, successful n8n processing and provider acceptance. Handset receipt needs the owner's observation. This is a tracking journal, not bank settlement.

All three steps above passed for this one fictional expense. A bare number is ambiguous; use the explicit command. Slip OCR is not configured for this pilot: do not send real financial documents. The six-action rich menu was not provisioned. The current Edit web link points at the workstation-local app; it is not phone access to Aegis. Initial text plus LINE Confirm did not require phone web access. Duplicate-phone-tap, provider-outage, crash/restore and sustained-load tests were not performed during this phone pilot; do not infer them from this happy path.

## After testing / rollback

The two pilot workflows are already deactivated. Preserve the immutable fictional journal and sanitized receipt. Use the privately saved old endpoint to restore this test bot if requested; do not change the other LINE assistant. Stop/remove only containers labeled `codex.task=aegis-phone-pilot-20261023`, close the private SSH forward and invalidate any unused challenges when retiring the runtime. Database/volume deletion and production cutover are separate decisions. No private credentials, actor IDs, link tokens, tunnel origin or execution bodies belong in repository evidence.
