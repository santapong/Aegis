# M4 workspace LINE capture

October 2, 2026. Status: contract prepared under the all-milestone workflow; implementation, independent review and real-channel pilot are separate gates.

## Outcome and chosen boundary

An owner explicitly connects a THB workspace and cash account to a separate finance LINE channel. A message creates a review draft. The owner confirms the destination, amount, direction and date before Aegis records cash. Optional matching happens in Aegis through the existing settlement review. Undo uses the shared reversal boundary; a matched record requires explicit unmatching first. This records entered money and never transfers funds.

| Choice | Decision and reason |
| --- | --- |
| Destination | Required owner-scoped workspace/account/currency selection at link-code creation, rechecked when consumed and on each write. No fallback to the first account, most recent workspace or old account-only link. |
| Old history | Add nullable target fields to codes/identities. Legacy links need an explicit reconnect before new drafts/confirmation; retain old drafts and records. Cancel and safe undo of historical unassigned captures remain available. Adopted historical records retain app reversal guards. |
| Link lifetime | One-use ten-minute hashed codes; connection-generation ID freezes each new draft to that reviewed link. Disconnect cancels pending drafts and queued replies; reconnect cannot revive an old draft. |
| Draft freshness | Freeze workspace revision, link generation and destination labels with the parsed money. A changed workspace or link requires a new reviewed draft; confirmation never refreshes a stale stamp silently. |
| Posting | Extend `cashflow.mutate` with caller-owned transaction mode. Shared movement/audit/alert work flushes inside a savepoint without committing or rolling back the webhook's outer transaction. Expected validation failures leave an explanatory reply; unexpected failures retain no event receipt or partial cash. |
| Event atomicity | Authenticated event receipt, cash mutation, draft transition and durable reply commit together. Stable channel/event ID deduplication handles duplicate and reordered events. A posted cash record without its durable receipt/reply is not an accepted outcome. |
| Correction | Extract the existing app reversal action as a shared service and reuse it in app/chat. Preserve original record, exact counter-entry, matches, owner/account/currency and retry-key rules. No hard deletion of workspace cash. |
| Delivery | Preserve durable outbox IDs as LINE retry keys, unchanged recipient/body on retry, bounded backoff and a stop before retry-key retention expires. Expose pending/attention states without implying provider acceptance proves handset receipt. |
| Next connector | Decide after actual authorized LINE use and separate research of current provider requirements. WhatsApp and Instagram are not enabled or promised by this implementation. |

## API and migration

Add nullable workspace/account IDs to `LineFinanceCode` and `LineFinanceIdentity`; add nullable identity connection-generation ID. Migration `a1002cf00004` follows M3. Existing legacy identity rows remain null and require reconnect. A populated destination refuses destructive downgrade; application rollback keeps additive schema/history.

`POST /api/line-finance/link-code` requires `workspace_id`, `account_id` and explicit `confirmed_currency: THB`. Status reports the reviewed destination, whether a legacy link needs destination review, pending drafts and outbox state. Existing webhook signature, separate channel and private-user-only routing remain in place. Account preferences do not convert a workspace's money; the workspace/account currency is authoritative for new captures.

Frontend Settings loads owned workspaces/accounts and presents destination confirmation before generating a code. Connected status names the destination, current review state and delivery queue. Changing destinations requires disconnect and a fresh link; in-flight older requests cannot overwrite a newer session's state. The user's existing Aegis identity and unrelated chat integrations remain intact.

## Verification and operational limits

Use SQLite and genuine PostgreSQL fixtures to prove explicit destination ownership, legacy no-guess behavior, zero posting before confirmation, stale draft rejection, duplicate confirmation, concurrency, shared matching/correction, disconnect/relink, unsupported inputs and interruption before outer commit. Retain signature and delivery retry/accepted-409/expiry checks. Rehearse populated migration and restored backup preservation.

Local mocks cannot close M4.3. A real pilot needs the owner's authorized separate channel, authenticated setup, known private test participant, intended hosting URL and labeled disposable records. Capture actual prompt/confirmation/delivery, duplicate/interruption, cross-workspace isolation, disconnect and undo evidence without storing credentials or private channel IDs in public artifacts. Review that use before M4.4's next-connector decision. Independent review, owner feedback, remote CI and ship gates stay open until executed.

## Current official reference board

Inspected October 2, 2026. LINE requires signature verification before event processing; duplicate event IDs and possible reordered delivery motivate the durable receipt boundary. Redelivery must be enabled in channel settings and is not a guaranteed recovery mechanism. [Receiving webhooks](https://developers.line.biz/en/docs/messaging-api/receiving-messages/), [signature verification](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/).

Retry keys allow safe retry of supported push requests with the same content/destination within the documented retention window. Stop after acceptance; accepted API requests still do not prove that a user received the message. The existing worker's 23-hour stop remains within the documented 24-hour window. [Retry failed API requests](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/). This is a design adaptation based on those requirements; actual Aegis delivery must be proven separately.
