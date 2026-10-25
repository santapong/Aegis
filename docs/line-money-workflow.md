# Aegis LINE money workflow

Implementation checkpoint: October 25, 2026, Asia/Bangkok. The [October 18 SDD](design/016-line-money-ledger-sdd.md) implementation is in an isolated worktree, with the setup/budget extension documented below. The separate fictional-money Pi phone pilot passed text → preview → owner Confirm → posted reply on October23: one THB 1 expense changed THB 1,000 to THB 999. Its two n8n workflows remain paused at the owner's choice. Slip OCR and production acceptance remain pending. See the [pilot receipt](validation/2026-10-23-phone-pilot/README.md).

## What was reconciled

The original checkout at `/mnt/data/company/apps/Aegis` contained extensive uncommitted cash-planning, public-design and text-only LINE work on `agent/comet-asset-prompt`, base `e2c4a9c`. A fresh October 22 fetch retained `origin/main=9071ddf` and `origin/develop=2ba31eb`. That work was preserved in an isolated snapshot at `/home/santapong/worktrees/aegis-line-ledger-20261022`, branch `feature/line-money-ledger-20261022`; the original checkout was not reset, committed or deployed.

The cash-planning MVP used legacy Numeric transactions. It did not satisfy the SDD's balanced BIGINT journals, card/refund semantics, precise immutable openings, source-job fencing or private slip extraction. The implementation therefore adds an explicitly disabled finance ledger rather than guessing a migration from old anchors.

## Prepared flow

1. Open **Accounts**, create a THB bank/savings/cash/card account and confirm the posted opening snapshot at an explicit cutoff. Openings are not income. Existing history is not automatically replayed.
2. Configure the separate LINE channel and link an observed private-chat identity with an expiring single-use challenge. Do not send the same channel to both the historical and new financial webhooks.
3. Typed entries or captured image evidence become versioned drafts. Account/date/direction/currency ambiguities remain visible. **Review → Edit / Confirm / Cancel** is required before money changes.
4. Confirmation commits the journal, exact read projection, audit, idempotency outcome, draft state and durable notification together. Delivery happens independently; a messaging timeout cannot repost money.
5. Read exact tracked balances and net position in Accounts/Review. Transfers, openings and card repayments do not become income/spending. Refunds and reversals retain signed effects. Correct financial facts with reviewed reversal/replacement; classify effective records through the audit path.
6. Import a statement with stable row identities. Match an existing journal before creating a draft for an unmatched line. Pending holds are separate, and differences remain visible rather than being plugged with invented income.

Amounts in APIs are integer satang strings. Existing accountless HTTP/CSV/MCP/seed writers fail helpfully after cutover. Use canonical financial drafts and exact read endpoints; the old positive-only transaction DTO cannot represent transfers, refunds or corrections. Historical currency must be confirmed explicitly before joining THB reports. Legacy budget/trip caps also require explicit currency confirmation.

## Runtime and workflow artifacts

- Three sanitized inactive exports: [ingestion](../workflows/n8n/aegis-ingestion.inactive.json), [delivery](../workflows/n8n/aegis-delivery.inactive.json), [operations](../workflows/n8n/aegis-operations.inactive.json).
- Target n8n version **2.33.3**, checked against the installed instance's native node source. All workflows use a manual trigger and `fixture_mode=true`; they contain no credential associations or private pinned data.
- Native imports and fictional fixture executions were run in ephemeral local n8n containers with networking disabled. The HTTP/provider branches require separate configured acceptance; fixture success does not prove live integration.
- [Six-action rich-menu template](../workflows/line/aegis-rich-menu.template.json) and [image](../workflows/line/aegis-rich-menu.png). The October 25 source uses six postback actions, including inline budgets and help. No menu was provisioned.
- [Operations/backup/restore runbook](deployment/line-ledger-operations.md) and [opt-in worker overlay](../docker-compose.line-ledger.yml). Hosted capture must run persistently; an HTTP response does not launch a durable worker.

`FINANCE_LEDGER_ENABLED=false` and `FINANCE_INTEGRATION_DELIVERY_ENABLED=false` remain the source defaults. The real vision adapter requires explicit provider/key/model configuration. The owner selected a separate fictional account for phone testing: only that new Pi database/runtime has these flags enabled and its separate Aegis Finance webhook connected through an exact-route gateway. The two pilot n8n workflows ran for the successful text test and were subsequently deactivated at the owner's choice. The application stays private. No production financial migration/cutover, paid vision call, push or tag was performed. Pilot activation is not G3 production approval.

## Verification and resource correction

[Execution evidence](validation/2026-10-22-line-ledger/README.md) separates unit/source checks, real PostgreSQL/migration/concurrency checks, native offline n8n fixtures, browser observations and unrun live acceptance.

The owner reported Kali CPU saturation/hanging after concurrent tests/builds. Local heavy verification was stopped; the workstation had rebooted and no Aegis test/build remained at inspection. Subsequent qualification moved to an isolated Pi test container, one job at a time, with an enforced one-core CPU quota and a memory/temperature watchdog. The Pi kernel lacks the memory cgroup controller: Docker memory flags are **not** an enforced aggregate RAM cap. No kernel change or reboot was attempted. See the dated Pi receipt for actual outcomes.

## Remaining operator gates

### October 25 setup and budget extension

The owner identified the expired QR/setup code as the problem and selected
monthly spending limits/remaining budgets plus LINE shortcuts. New source
challenges default to **24 hours**, remain single-use, and are replaced on
renewal. Existing issued codes retain their stored expiry. This application
capability is separate from LINE's native linking token and from the already
24-hour default web login. Established LINE identity links remain persistent.

Configure `LINE_FINANCE_BOT_BASIC_ID` with the verified bot's public `@` ID for
local QR and Open LINE presentation; a channel or webhook destination ID is not
interchangeable. The API generates the QR in-process and marks the challenge
response no-store. The phone user must still check the intended bot and press
Send. No external QR service receives the code.

New source shortcuts: `budgets`/`งบ`, `balances`/`ยอดเงิน`, `pending`/`รอตรวจ`,
and `help`/`tools`. Budget replies use exact recorded spending and signed refund
effects, show each active limit's period and remaining/over-limit amount, and
preserve unknown-currency warnings. The Budgets page now exposes explicit THB
limit review; stale reviewed facts reject and can be refreshed. It does not
create an account transfer or financial posting.

See [extension contract](design/018-line-onboarding-and-budget-tools.md) and
[dated verification](validation/2026-10-25-line-tools/README.md) for actual test
scope. These source changes are not deployed. The October 25 read-only check
confirmed both fictional pilot workflows still inactive. Activation, real phone
scanning, a stable phone-accessible application URL and menu provisioning remain
separate from local implementation.

- **G1:** verify real account names, posted openings, cutoff, historical currency and migration mode.
- **G2:** deliberately review real channel text/slip presentation, evidence privacy, categories/trips, duplicate attachment, correction and delivery/retry behavior. Record chosen provider/model and measured queue/capture/extraction timings.
- Choose evidence retention, encrypted off-device backup destination/key custody and daily scheduling; repeat restoration in the chosen deployment.
- **G3:** approve production migration/exposure and channel/worker/workflow activation after live acceptance. Defaults stay inactive until that decision.

The SDD's embedded ClickUp/PR instructions were treated as handoff context. No external tracker was changed and no PR was opened. The owner's GitHub web workflow remains the appropriate publication step after source review.
