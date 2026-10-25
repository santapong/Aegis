# M4 LINE capture — local implementation and real pilot runbook

October 2, 2026. This is a reviewable runbook, not evidence that a channel is configured or a deployment happened. [Contract](../design/015-workspace-line-capture.md), [user/operator guide](../line-finance.md), [workflow](../plans/2026-10-02-all-m-workflow.md), [local evidence](../validation/2026-10-02-all-m/README.md).

## Local result and release boundary

Settings requires an explicit THB workspace and active account, plus destination confirmation. The bot freezes that connection and workspace revision in each draft. A confirmed actual uses the app's cash/audit boundary in the same transaction as its event receipt and reply. A stale draft requires re-entry. Matching happens through the existing app review; undo retains a cash reversal and requires unmatching first.

Migration `a1002cf00004` preserves existing M3 cash and historical LINE rows. Old identities remain unassigned. Populated SQLite/PostgreSQL rehearsals and unused downgrade/reupgrade pass; downgrade refuses destination history. The local pilot was backed up before upgrading. Preserve schema/history for an application rollback.

A separate Aegis Finance Messaging API channel now exists under DravenIQ, verified October4. October5 Bangkok setup: owner credentials loaded privately, intended bot validated, trusted signature checks and LINE Verify Success passed, webhook/redelivery enabled. Real own-account link, handset delivery and cash/correction pilot remain unverified; no customer migration, public application deployment or Git release has been performed by this workflow. The public landing remains a separate deployment. The same owner-authorized independent reviewer signed off the local cash, packaging and Compose repairs; [review evidence](../validation/2026-10-02-all-m/independent-review.md) defines that scope. Personal/business comprehension sessions, remote CI and required release checks remain open.

## Required inputs before the real pilot

Resolve the separate finance channel, intended HTTPS test hosting URL, known private test participant, and owner-controlled secret entry. Never reuse Contractor's channel. The owner performs passwords, MFA and channel-console credential steps. Keep secrets and private participant/channel IDs out of committed evidence. Agree on the labeled fictional records and permitted test messages before sending them.

A separate independent reviewer must read the scoped source/contracts before rollout. Repository ADLC requires an agent other than the implementer to sign off; the owner's standing agent rule requires explicit authorization for that reviewer. This local review gate is satisfied within the documented scope by the one authorized reviewer. A new material source change requires affected verification and review; the implementer's checks alone cannot replace it.

Setup checkpoint, October4 14:34:43 UTC: the Manager is accessible, Messaging API status visibly reads Enabled, and the DravenIQ provider lists Aegis Finance as a Messaging API channel. The owner approved API terms and activation under DravenIQ. The agent's selected-radio guard timed out before Agree; the subsequent enabled state is verified without attributing the final click. The earlier Manager agreement barrier is historical. The channel's Messaging API settings page is open for the owner's credential step. The agent has not issued/read tokens or secrets, configured a webhook or sent a real message. HTTPS test host and private participant are requested; M4.3 remains open. Safe screenshots are outside Git in `/mnt/data/aegis-line-pilot-2026-10-04/`.

## Bounded pilot sequence

Preparation update, October5 Bangkok: a new separate local reviewed-image pilot is running with fictional personal/business fixtures. Nine local checks and four trusted-HTTPS public route checks pass. The owner explicitly approved a temporary Cloudflare webhook and own-account THB1 expense/confirmation/undo pilot. The URL is saved in LINE; Use webhook remains off, runtime credentials are not loaded and the finance reply worker is not started. Owner credential entry/sign-in remain required. [Non-secret preparation evidence](../validation/2026-10-02-all-m/line-pilot-preparation.json). Exact URL, safe screenshot and prepared scripts stay outside Git at `/mnt/data/aegis-line-pilot-2026-10-04/prepared/`; protected files are under `/home/santapong/.local/share/aegis-line-pilot-20261004/`. This is preparation/exposure evidence, not real M4.3 delivery or release completion.

1. Back up the intended pilot database; rehearse the relevant additive migration and restore equality on a disposable copy. Review the exact application artifact and secret configuration. Deploy only to the authorized target after review; record version and CI links.
2. Configure the separate finance channel and delivery worker/scheduler through the operator's secret interface. Verify the webhook URL and signature behavior; enable webhook delivery and review redelivery settings. Check missing/bad signature does not write cash.
3. Sign into the test owner account. In Settings, choose a named fictional THB workspace/account and confirm it. Generate a link, send it privately within ten minutes, then check the linked destination. An old or reused code must fail. Do not capture the private command in public screenshots.
4. Send `expense 1 Aegis pilot fictional` on the agreed local date. Capture a redacted draft showing destination/amount/date and verify cash has not changed. Confirm that exact draft. Verify one original cash record and audit event in the chosen account, cash reduced by THB 1, and the confirmation visibly received on the participant's phone.
5. Repeat the confirm command and reproduce a duplicate webhook using the same authenticated test event identity without exposing its raw body publicly. Verify one cash effect. Interrupt delivery at the agreed boundary, restore it, and observe the unchanged retry key and one accepted reply. A provider acceptance log alone is insufficient for phone receipt.
6. Exercise an unlinked test sender and a different owned workspace/account. They cannot post into the selected destination through foreign IDs or silently change the destination. Change the selected workspace's revision after a draft; confirm must explain staleness and record no cash. Send and review a new draft.
7. Match a labeled actual to a test plan in the app and verify unchanged cash. Chat undo should require unmatching. Unmatch, then undo; original plus reversal remain and net cash returns to its initial value. Repeating undo changes nothing.
8. Create an unconfirmed draft, disconnect in Settings, and verify it and queued replies are cancelled while recorded history remains. Reconnect with another explicitly selected destination; the old draft cannot be revived. Test ambiguous amount, transfer, future date and receipt image explanations.
9. Record actual dates, source/artifact identity, observed handset receipt, one-cash-effect calculations, failures and remediation. Keep customer records and credentials out of evidence. Leave any failed item open.

## Comprehension and connector follow-up

Use the separate personal/business task prompts in the completion audit without coaching. Ask the owner which capture steps were useful, confusing or slower than manual entry. Only then decide the next connector using the [bounded research board](../plans/2026-10-02-next-connector-evidence.md). Research alone cannot close M4.4.

## Rollback

Stop authorized webhook/delivery exposure first, retain the outbox and original financial history, and roll back the application artifact. Do not attempt destructive downgrade of populated LINE destinations. A request already accepted or in flight at LINE may still arrive; record that limit in the pilot evidence. Resume only after the affected failure is repaired and reverified.
