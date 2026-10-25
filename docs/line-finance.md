# Separate LINE finance bot

An additive exact-money implementation of the October 18 SDD is now prepared behind `FINANCE_LEDGER_ENABLED=false`. Its account/draft APIs and `/api/integrations/line/webhook` are separate from the historical connector described below. Read [the new workflow and acceptance boundary](line-money-workflow.md) before choosing a webhook or cutover. Never deliver the same channel event to both financial connectors. Existing cash workspace history is not automatically migrated.

Current implementation checkpoint: October 2, 2026. M4 workspace capture is implemented locally; real finance-channel delivery, independent review and deployment remain open. The September 23 account-only implementation is historical. [Contract](design/015-workspace-line-capture.md), [execution evidence](validation/2026-10-02-all-m/README.md), [pilot runbook](releases/2026-10-02-m4-line-capture.md).

## Connect a reviewed destination

In **Settings → LINE finance**, choose your THB cash workspace, then an active THB cash account. Check the statement naming that destination before generating a code. A workspace or account change clears the previous confirmation. No account is selected automatically. Your general display-currency preference does not convert workspace money.

The separate finance channel and reply delivery must be configured before the UI enables code generation. A missing setup stays visible. The backend link endpoint requires channel authentication configuration and an enabled cash workspace feature; the UI additionally requires reply delivery readiness. Codes are single-use, expire after ten minutes and are stored only as hashes. Send the command in a private chat with the chosen finance bot and use **Check connection** to see the destination.

Older account-only links have no reviewed workspace destination. Disconnect and explicitly reconnect before sending new cash drafts. Existing financial history remains. Disconnect cancels pending drafts and queued replies; it does not reverse recorded money. A request already accepted or in flight at LINE cannot be recalled by disconnection.

## Record and correct an entry

Supported examples: `expense 65 coffee`, `income 35000 salary`, `จ่าย 65 กาแฟ`, `รับ 35000 เงินเดือน`. Dates may use `YYYY-MM-DD`, `today`/`วันนี้`, or `yesterday`/`เมื่อวาน`. Ambiguous amounts, transfers, future actuals and unsupported currencies receive an explanation. Receipt images are unsupported. No OCR or financial input goes to an AI provider in this version.

An entry creates a draft naming its workspace, cash account, THB amount, direction and date. It records no money yet. Review it, then send the returned `confirm <id>` command. A workspace change or different connection makes the draft stale; send a fresh entry instead of silently accepting a refreshed revision. `cancel <id>` dismisses pending or stale drafts.

Confirmation uses the same cash writer as the app. Its event receipt, cash movement, audit, draft transition and durable reply commit together. Duplicate delivery or confirmation cannot create a second cash effect. Entries are scoped to the reviewed account; they do not enter an unrelated workspace or the unassigned legacy ledger.

Match a confirmed payment in **Cash planning → Review & match**, or use a business document's **Record or match a payment**. Matching an existing payment never posts it again. `undo <id>` creates a shared reversal that preserves the original workspace record and history. Unmatch an allocated payment in Aegis before undoing it. Correct an entry by undoing and sending a new draft. Safe undo of an old, still-unassigned legacy capture retains its historical behavior; once adopted into a cash workspace, correct it through Aegis.

`month` reports recorded income/expense activity for the linked account, in its workspace timezone. It is not a bank balance, unpaid invoice total or forecast. Aegis never transfers funds, connects a bank, converts currencies or treats a planned bill as paid through this bot.

## Delivery and configuration

Use a separate finance channel; preserve Contractor's channel and webhook. Store server-only `LINE_FINANCE_CHANNEL_ID`, `LINE_FINANCE_CHANNEL_SECRET` and `LINE_FINANCE_ACCESS_TOKEN` through the deployment's secret interface. Keep credentials out of browser bundles, source files, command history and chat. Enable `CASHFLOW_WORKSPACES_ENABLED` only after the application/migration checks.

The webhook is `/api/line-finance/webhook`. Verify the HMAC signature over original request bytes before processing. Group and room messages are ignored. Channel-scoped hashed event IDs deduplicate delivery; redelivery is not a guarantee of recovery. Review and enable the provider's redelivery setting explicitly for an authorized pilot. [LINE webhook guidance](https://developers.line.biz/en/docs/messaging-api/receiving-messages/), [signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/).

For a persistent backend, run `python -m app.services.line_finance_worker` as a supervised process with the same database and finance access token. The API does not launch that process automatically. For serverless hosting, an authenticated scheduler can POST `/api/line-finance/deliver` using a distinct server-only `LINE_FINANCE_DELIVERY_SECRET` of at least 32 characters; each call drains at most three replies. Do not launch an infinite worker inside a request. A Pi scheduler would require its own authorized setup.

The outbox keeps its UUID retry key and unchanged message/recipient after uncertain failures. Network, server and 429 responses back off. An accepted 409 requires LINE's accepted-request header. Retries stop at 23 hours, before the documented 24-hour retention expires. Settings reports waiting, needs-review and provider-accepted replies; API acceptance alone does not prove that a phone received them. Accepted reply text is scrubbed. Drafts and review-needed replies remain in the owner's database. [LINE retry contract](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/).

## Migration and rollback

M4 revision `a1002cf00004` follows M3 and adds nullable destination fields and a connection generation. Existing links remain null; no destination or financial amount is inferred. Back up and rehearse the whole relevant chain before applying it to a customer database. Populated SQLite and PostgreSQL preservation and unused downgrade/reupgrade were executed locally; MySQL and production migration have not been verified for this feature.

For application rollback, disable the authorized webhook/delivery process and retain the additive schema and financial history. M4 refuses downgrade while reviewed destinations or destination-bearing draft history exist, including history after unlink. It is not a data-erasure procedure. Never resolve a deployment rollback by silently deleting recorded cash.

## Verification boundary

Executed local checks cover signature rejection, explicit ownership/currency/account selection, legacy no-guess behavior, no posting before confirmation, stale drafts, duplicate and concurrent confirmation, shared matching/reversal, disconnect/relink and interrupted outer commit. Delivery mocks verify stable retry keys and expiry. See the dated logs for exact source and results. Mocks do not prove real delivery. Complete the bounded pilot runbook and independent owner task session before launch claims.
