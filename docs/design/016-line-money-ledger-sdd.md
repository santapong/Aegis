# Aegis LINE Money Management Software Design Document

Version: 1.0  
Date: 18 October 2026  
Owner and pilot operator: Santapong  
Implementation executor: Codex  
Repository: https://github.com/santapong/Aegis  
Source baseline: main at 9071ddf0f75f4cf903a6739c41a7ff7e0c6af22c  
Status: design and implementation handoff; production integration not implemented or verified  
Time zone: Asia/Bangkok  
Initial currency: THB

## 1. Purpose and delivery outcome

Extend the existing Aegis personal-finance product so its owner can provide opening account balances, send payment slips or typed income/expense messages through LINE, confirm the proposed entries, and manage categories, trips and budgets in Aegis.

LINE is the daily interface. n8n orchestrates extraction and messaging. Aegis owns identity, transaction validation, financial posting, balances, reporting and review. PostgreSQL stores financial truth. An OCR/model output is a proposal and never an instruction to change balances.

The first usable vertical slice is: create account openings in Aegis, link a LINE identity, type an expense, review and confirm it, then see the exact tracked balance in both LINE and Aegis. Add slip extraction after that slice is correct.

This document supplies implementation decisions, interfaces, migration rules, test fixtures, task boundaries and human review gates. All new names and endpoints below are proposed additions unless identified as existing.

## 2. Existing implementation and constraints

The inspected repository documents Next.js 15, React 19 and TypeScript; the backend uses FastAPI, SQLAlchemy 2 and Pydantic v2, with Alembic migrations. Preserve this stack and reuse the existing UI components, session authentication, trips, tags, budgets, notifications and API proxy.

Source-verified facts at the baseline:

| Area | Existing behavior | Required change |
|---|---|---|
| Transactions | Income/expense enum, Numeric amount with float annotations, category string, trip_id, tags and recurring fields | Add ledger-linked provenance and exact money contracts; preserve legacy compatibility |
| Dashboard | total_balance is cumulative income minus expense | Derive account balances and net position from postings |
| Trips | Trip CRUD, dates/status, overall budget and expense/category summaries | Reuse trip_id as a separate reporting dimension |
| Writes | HTTP, CSV and MCP handlers can write ORM transactions directly | Route new financial effects through one posting service |
| Mutation | PUT mutates and DELETE removes transaction records | Preserve history for posted ledger records through correction/reversal |
| Notifications | Existing helper can commit internally | Make commit ownership explicit when used within posting |
| Auth | Browser cookie or user JWT | Add LINE identity links and scoped machine credentials |
| Tests | Client fixture uses in-memory SQLite, including apparent PostgreSQL CI variants | Add real PostgreSQL and real migration-path tests |
| Stripe payments | Application checkout/payment records | Keep separate from the personal account ledger |

Repository conventions at this baseline: work on a feature branch, open a draft PR, update CHANGELOG.md, use reversible Alembic migrations with SQLite batch support, and add a data-model design document. No AGENTS.md was found in the inspected tree; Codex must check again at execution time. Existing design documents run through 006. Use docs/design/007-line-money-ledger.md only if that number is still free.

Source inspection is not evidence that the deployed application, LINE account, n8n version or OCR provider is configured.

## 3. Scope and requirements

### 3.1 Included in the first release

- One linked pilot operator; ownership isolation remains enforced for every record.
- THB bank, savings, cash and credit-card accounts.
- Opening snapshots with an explicit cutoff, recorded separately from income.
- Typed income/expense, own-account transfer, card purchase/repayment and linked refund.
- One payment per image, image extraction, field review and private evidence storage.
- Mandatory Confirm/Edit/Cancel before a new chat draft changes balances.
- Category plus optional trip and tags; reuse existing Aegis trip/budget concepts.
- Six-button LINE rich menu, balances, pending queue and authenticated Aegis deep links.
- Durable ingestion, retry-safe financial writes and independently retried notifications.
- Statement import/matching and visible reconciliation differences.
- Backups, restoration, failure visibility, inactive n8n exports and operator documentation.

### 3.2 Deferred

Multi-currency conversion, group/shared finance, automatic bank synchronization, automated payment execution, automatic posting based on model confidence, lending/investment advice, multiple payments per image, and automatic fraud/settlement claims. LIFF is optional later; ordinary authenticated Aegis pages suffice for V1.

### 3.3 Functional requirements

| ID | Requirement |
|---|---|
| FR-01 | Create named accounts, account type, THB currency and openings at an explicit cutoff. |
| FR-02 | Link an observed LINE identity to an authenticated Aegis user with a single-use expiring flow. |
| FR-03 | Accept authorized private-chat text/image/postback events and acknowledge durable receipt. |
| FR-04 | Create or update a transaction draft with source/evidence references and validation errors. |
| FR-05 | Require amount, direction and account(s); resolve material ambiguity before confirmation. |
| FR-06 | Bind Confirm/Edit/Cancel to actor, draft and exact draft version. |
| FR-07 | Post an atomic balanced journal once, including read projection, draft state and outbox. |
| FR-08 | Correct posted financial facts with reversal/replacement and preserved links. |
| FR-09 | Detect delivery duplicates, repeated evidence and probable repeated economic transactions separately. |
| FR-10 | Return tracked balances, liabilities, net position and reconciliation date from backend queries. |
| FR-11 | Report category/trip spending once per transaction and apply period/trip budget rules. |
| FR-12 | Import statements idempotently, match known transactions and show unresolved differences. |
| FR-13 | Resume jobs after restarts without repeating financial effects. |
| FR-14 | Keep financial evidence private and apply retention/logging controls. |
| FR-15 | Preserve existing Aegis features and document the ledger cutover/legacy compatibility contract. |
| FR-16 | Supply deterministic fixtures, real PostgreSQL concurrency tests and a live acceptance checklist. |

### 3.4 Quality targets

These are acceptance targets, not measured performance claims:

- Zero duplicate journals under replay/concurrent-confirmation tests.
- Every committed journal is balanced, currency-consistent and owner-consistent.
- No unauthorized user can read or change another owner's records or evidence.
- A valid webhook receives a response within a 2-second test target after durable intake, without awaiting OCR.
- Under a healthy local pilot and supported provider, text drafts should normally be ready within 10 seconds. Measure p50/p95; report provider/queue time separately.
- Capture image content promptly; initial target is starting a capture attempt within 5 seconds on the hosted worker. Never promise a fixed LINE media-retention duration.
- Backups run daily for the pilot; record the actual recovery-point interval and perform a restoration drill before daily use.

## 4. Architecture and trust boundaries

Use a modular Aegis backend with reusable services, not separate financial microservices.

~~~mermaid
flowchart TD
    L["LINE chat and rich menu"] --> A["Aegis secure ingress and API"]
    U["Aegis web UI"] --> A
    A --> D[("PostgreSQL: inbox, drafts, ledger, outbox")]
    A --> C["Hosted media capture worker"]
    C --> S["Private receipt storage"]
    A <--> N["n8n job orchestration"]
    N <--> X["OCR and text extraction"]
    N --> L
~~~

| Boundary | Design |
|---|---|
| LINE → Aegis | Public HTTPS; HMAC-SHA256 raw-body verification; allowlisted linked actor; private chats only |
| n8n → Aegis | Scoped service credential; job lease/capability; no arbitrary user impersonation |
| Aegis → PostgreSQL | Short transactions, uniqueness, locks/version checks, append-only journal protection |
| Worker → private storage | Narrow storage permissions; MIME/size validation; private object keys |
| Extractor → Aegis draft | Schema-validated untrusted suggestions; no financial execution authority |
| Browser → Aegis | Existing authenticated session and CSRF/ownership protections |

Inbox/outbox are database tables. Use the existing optional worker infrastructure where it is suitable, while keeping PostgreSQL job state authoritative. A persistent background worker must run on the selected hosting. Do not assume an in-process task survives a serverless HTTP response.

The LINE channel secret and channel access token serve different purposes. Keep both in secret configuration. n8n does not need the channel secret because raw webhook verification happens in Aegis.

## 5. Financial model and invariants

### 5.1 Exact money and journal convention

Production ledger storage uses BIGINT integer satang. API fields such as amount_minor are decimal integer strings, for example "15025" for THB 150.25. Parse input with Decimal or equivalent exact decimal logic; never round-trip through float. Ordinary payment/income/refund amounts must be positive; opening snapshots use the signed contract below. Reject values outside signed 64-bit storage and validate aggregate balances without overflow. At most two THB decimal places are accepted. New exact-money projections do not write through the old Numeric(12,2)/float amount column.

Journal postings use signed integers: debit positive, credit negative. Every committed entry has at least two nonzero postings, a zero sum, one currency and one owner. System income, expense and opening-equity accounts complement user-visible assets/liabilities.

| Operation | Debit | Credit |
|---|---|---|
| Open bank with THB 20,000 | Bank 2,000,000 | Opening equity 2,000,000 |
| Open card with THB 2,000 owed | Opening equity 200,000 | Card liability 200,000 |
| Bank income THB 500 | Bank 50,000 | Income control 50,000 |
| Cash expense THB 150 | Expense control 15,000 | Cash 15,000 |
| Bank → savings THB 1,000 | Savings 100,000 | Bank 100,000 |
| Card purchase THB 500 | Expense control 50,000 | Card liability 50,000 |
| Card repayment THB 700 | Card liability 70,000 | Bank 70,000 |
| Card refund THB 200 | Card liability 20,000 | Expense control 20,000 |

The table shows unsigned amounts in the Debit/Credit columns; stored credit postings are negative. Asset balance is the sum of its signed postings. Displayed debt is the negative sum of liability postings. Net position is total assets minus displayed liabilities. Opening equity is excluded from earned income and spending.

Transfers and card repayments have no income/expense effect. Transfer fees are separate expense postings in the same entry or an explicitly linked fee entry. Linked refunds reduce spending on the refund occurrence date; they do not silently rewrite past periods. Each refund draft/journal stores original_expense_entry_id. Lock that expense while computing prior effective refunds and posting the new refund; enforce same owner/currency and remaining refundable principal atomically. A refund selects the receiving asset or card account explicitly. V1 rejects a financial correction/reversal of an expense with effective refunds until the refund chain is explicitly resolved; it must not silently invalidate refund links or double refund through concurrent requests.

### 5.2 Opening snapshot and historical records

Prefer one initial cutoff T for all onboarded accounts. The owner supplies posted balances including movements through T; pending holds are separate and not silently deducted twice.

- An opening entry establishes each account's position at T.
- Normal tracking posts movements after T.
- Earlier records included in the snapshot remain nonposting history.
- A date-only transaction on the same local calendar day as T requires the owner to resolve whether it falls before or after the snapshot.
- Preserve actual date precision. Store occurred_on, optional occurred_at and precision; do not fabricate a precise timestamp from a date-only slip.
- Alternatively, choose a verified opening anchor before imported history and replay that history once.
- Do not replay old expenses against a current opening snapshot.
- Later-added accounts need their own verified opening and explicit handling of transfers crossing account cutoffs.

One account cannot receive duplicate opening setup. Changes after live postings use audited correction, not direct balance overwrite. Reconciliation never silently plugs a difference with invented income.

Opening APIs use signed_balance_minor: positive assets mean money held; negative bank/savings positions mean an overdraft. For cards, the owner-facing signed amount owed is positive for debt and negative for a credit balance. Normalize these to the journal debit/credit convention. V1 rejects negative cash-wallet openings. A zero opening creates a unique AccountOpening metadata record with cutoff and no journal; do not create zero postings. The opening journal reference is therefore nullable. Freeze account owner, currency, kind and effective cutoff once setup/posting begins; ordinary edits change names/display metadata only. Changing historical account semantics requires an explicit migration/correction service.

### 5.3 Immutable history and read projections

Journal/posting financial fields cannot be updated or deleted after posting. Implement production database protection as well as service validation. Reversals create opposite postings linked to the original; replacement entries have explicit correction links.

Ledger calculations include the original and reversal postings. A UI status of "reversed" must not cause the original journal to be excluded while retaining only its reversal.

Choose a new financial_transaction_projections table for ledger-linked views, separate from the existing legacy Transaction table. It contains journal_entry_id unique, operation_kind, exact amount_minor, signed income_effect_minor and expense_effect_minor, category, trip and tags. Effect fields are derived from journal postings in the same transaction and are rebuildable; they are not independently editable financial inputs. Refunds have negative expense effect; transfers/card repayments/openings have zero income/expense effect; a transfer with fee has exactly its fee as expense effect. A reversal has the inverse effects of its original; replacement entries have their own effects. Do not force these operations into the legacy positive-only income/expense DTO or write a BIGINT amount through the legacy Numeric(12,2) column.

Expose a new canonical financial-transaction DTO/read endpoint and migrate Aegis frontend, reports, exports, MCP reads and AI aggregate callers to it together. Existing legacy reads retain an explicit compatibility contract. Store migrated_journal_id/provenance on legacy rows when replayed, without making the legacy amount authoritative for new postings. Legacy import values convert directly from exact Decimal/string to satang after currency confirmation, never via float. Report services verify projection effects against the relevant journal control-account postings and rebuild them if required.

Corrections lock the effective original entry, enforce at most one direct reversal with a unique reversal_of constraint, and atomically commit reversal, optional replacement, projections, audit, idempotency outcome and outbox. Distinct idempotency keys cannot produce two reversals. Further corrections operate on the latest effective replacement, with a traceable chain. V1 financial reversal and replacement share an owner-reviewed correction_effective_on, defaulting to today's Bangkok date and validated against the cutoff. Both are reported on that chosen date; do not silently rewrite the original period. Show the date/effects in the correction preview. Classification-only revisions follow the separate audit path.

Correcting a refund also acquires the original expense lock and recomputes the net effective refunded amount including the proposed reversal/replacement. Use a consistent lock order, original expense before refund entry, so a concurrent new refund or refund correction cannot exceed the original expense. The original-expense link survives the refund correction chain.

Classification-only edits may use an audited classification revision without changing financial postings. All read/report/cache services must use the same canonical classification and money semantics. Invalidate relevant dashboard, trip and budget caches after committed changes.

## 6. Proposed data structures

Use UUIDs consistent with the repository. All financial entities have non-null owner/user identifiers. Enforce same-owner relationships through composite foreign keys or equivalent database constraints, not client IDs alone.

| Entity | Core fields and constraints |
|---|---|
| Account | id, owner_id, name, kind(asset/liability/income/expense/equity), subtype, THB currency, visibility, archived_at; user-visible and system accounts distinguished |
| AccountOpening | account_id unique, cutoff_at, source snapshot metadata, journal_id nullable for zero opening, setup_key unique |
| JournalEntry | id, owner_id, kind, occurred_on, occurred_at nullable, precision, source_draft_id unique nullable, reversal_of unique nullable, original_expense_entry_id nullable, correction_group, created_at |
| Posting | id, journal_id, account_id, signed amount_minor BIGINT; same owner/currency; append-only |
| FinancialTransactionProjection | New table: journal_entry_id unique, operation_kind, exact principal amount_minor, signed income/expense effects, category/trip/tags; immutable derived financial fields |
| Legacy Transaction metadata | Existing rows keep legacy numeric storage; add origin, migration currency confirmation, nonposting_history and migrated_journal_id mapping for one-time replay/report deduplication |
| TransactionDraft | owner, version, status, type, exact amount, dates/precision, source/target account, original_expense_entry_id for refunds, category, trip, tags, field provenance, validation errors, posted_journal_id |
| Evidence / ReceiptAsset | owner, source message ID, private storage key, MIME, size, SHA-256, extraction version, original fields, reference provenance, capture state |
| DraftEvidence / EntryEvidence | Many evidence items can support the same economic transaction; do not require a new transaction for a new slip |
| LineIdentityLink | Aegis owner, provider/channel and LINE user; unique binding; revoked_at |
| LinkChallenge | hashed random token, authenticated Aegis owner, expiry, consumed_at; one use |
| IngestionEvent | unique(channel_id, webhookEventId), message_id, type, timestamp, owner, payload reference, processing state and result |
| IntegrationJob | event/evidence, type, state, attempt, available_at, lease_until, fencing generation, result, safe error code |
| IdempotencyRecord | unique(owner, operation namespace, key), request hash, committed response reference |
| EconomicIdentity | unique trustworthy issuer/reference/account-context key within owner and scheme; journal link reserved atomically during posting; not derived from uncertain OCR alone |
| NotificationOutbox | unique notification key, owner, target identity, message purpose, delivery state, attempts and provider acknowledgement |
| ConfirmationCapability | hashed opaque token, owner, draft_id/version, action, expiry and consumed/result state |
| Reconciliation | account, period/as-of, opening/closing statement balances, match status and visible difference |
| StatementLine | account, import identity, row identity, exact amount/direction/date/reference, matched journal reference |
| Category / Trip / Budget | Reuse existing entities where possible; establish a category reference adapter rather than breaking current category strings blindly |

Required production constraints include unique event intake, one journal per source draft, one posting projection per financial event, same-owner account links, exact amounts and balanced committed journal entries. For PostgreSQL, use a deferred constraint trigger or another equally strong commit-time strategy for posting sums and append-only financial protection.

SQLite is a development compatibility target with service-level transaction checks; it cannot establish PostgreSQL concurrency guarantees. Preserve the existing application on other supported databases. Gate the new ledger feature outside PostgreSQL/SQLite until equivalent migrations and tests exist; do not claim the feature inherits every existing database target automatically.

## 7. LINE identity, menu and conversation

### 7.1 Linking and authorization

1. Authenticated Aegis user requests a link challenge.
2. Aegis issues a high-entropy, short-lived, single-use token; store only its hash.
3. User sends the linking command/token to the Official Account in private chat.
4. Trusted ingress verifies the signature, observed source identity, token and expiry; binds that observed LINE user to the Aegis owner.
5. Show the result in Aegis/LINE and allow unlinking from authenticated settings.

Do not bind accounts using display name, an email written in chat, URL user_id, or an LLM-supplied owner. Do not replace the existing AuthGate with a public linking bypass. Preserve an allowlisted return path across login for deep links. Later LIFF support must validate tokens on the server and use the intended provider/channel identity configuration.

### 7.2 Rich menu

| Action | Implementation |
|---|---|
| Add slip | Postback returns Camera/Photos quick replies or attachment guidance |
| Income / expense | Guided direction selection and text entry |
| Balances | Read-only backend query; show tracked balance and reconciliation date |
| Trips / budgets | Trip chooser/summary and authenticated Aegis URI |
| Review pending | Pending drafts, missing fields, probable duplicates and failures |
| Open Aegis | Configured HTTPS URI to authenticated app |

Camera/camera-roll actions belong to quick replies, not directly to rich-menu tap areas. Use postback codes, not user-visible implementation details. Rich-menu provisioning is a deliberate setup step; do not recreate the menu on every workflow execution.

### 7.3 Parsing and draft behavior

Support explicit structured text first, for example:

- expense 150 food account:main trip:chiang-mai
- income 500 freelance account:main
- transfer 1000 from:main to:savings
- Thai free text: จ่าย 150 ค่าอาหาร จากบัญชีหลัก ทริปเชียงใหม่

Examples are fictional, not the owner's actual balances or income. Parse known commands/categories/accounts with deterministic rules before optional language-model interpretation. Unknown accounts/categories remain unresolved; the extractor must not invent records.

For new text with no date, propose today's Bangkok date and visibly label it as a suggestion for confirmation. Missing OCR dates remain unresolved. A configured default paying account may be proposed, but it must be visible and editable; never infer from another person's name on a slip.

Mandatory preview fields: direction, amount/currency, date/precision, account(s), merchant/description, category, optional trip, duplicate warnings and evidence link. Show Confirm/Edit/Cancel. When fields change, increment the version and invalidate old buttons.

Concurrent drafts require explicit draft-bound replies/buttons. An unrelated message must not be assigned to whichever draft happened to arrive last. Read-only commands such as Balance cannot create financial transactions.

## 8. Event, extraction and confirmation flows

### 8.1 Webhook intake

- Read exact raw body bytes; verify Base64 HMAC-SHA256 using constant-time comparison before parsing.
- Invalid/missing signatures: reject with 403 and no processing.
- Validate configured channel/destination and authorized private-chat source.
- Handle the valid empty events verification payload with 200.
- Persist every supported new event and required job in a transaction. Upsert duplicate event keys without creating new jobs.
- Unsupported valid events can be acknowledged with an audited ignored state.
- Return 200 after durable persistence. If persistence fails, return 503.
- Do not wait for OCR or the Pi before acknowledging intake.
- Redelivered events can arrive out of order; use event timestamps and draft-bound actions.

Postback Confirm/Cancel actions should be validated by trusted ingress and the Aegis draft service directly. n8n is not a source of user approval. If a workflow forwards an action, it must carry only a server-issued action capability scoped to the observed event/actor.

### 8.2 Media capture

A hosted worker consumes a durable capture job immediately, obtains image bytes by LINE message ID, validates size/MIME, stores them privately, and records capture state. Accepted event intake is not the same as successful media capture.

Initial configurable limits: 10 MiB per supported image and one payment per image; reject unsupported/oversized input visibly. Make the limit explicit in the UI. Treat filenames and extracted text as untrusted. Storage URLs are private; short-lived read links require ownership checks.

Retrieval retries are bounded. Permanent/unavailable media becomes capture_failed with a re-upload instruction. LINE removes media after an unspecified period; do not rely on LINE as the archive or wait for an offline RPi to fetch it.

### 8.3 Extraction

n8n obtains captured evidence through a scoped API. An adapter returns structured fields plus provenance and validation/confidence metadata. Select an actual OCR/vision provider during implementation; do not assume all existing Aegis AI providers/models support images.

Use a fake adapter for deterministic fixtures and an explicit configured real adapter for live acceptance. Model confidence is not a probability guarantee and never replaces confirmation. Image content cannot change system instructions, recipient identity, credentials or endpoints.

Malformed results, unsupported currency, conflicting amounts or unreadable references create visible review errors. Extraction retries update the same evidence/draft; they do not create fresh financial transactions. Every job-originated draft/evidence mutation, not only job completion, validates current lease generation and source-job scope. Apply optimistic version checks and per-field provenance; stale workers cannot overwrite newer extraction or human-reviewed fields. Posted/canceled drafts reject financial-field updates. A retry after a draft is already awaiting confirmation returns the stored result unless a deliberate re-extraction action creates a new review version.

### 8.4 Confirmation transaction

Within one database transaction:

1. Lock/read the draft and verify owner, version, action capability, allowed state and required fields.
2. Return the existing posted result if this draft already committed.
3. Apply cutoff and duplicate-resolution checks; reject unresolved warnings.
4. Create the balanced journal and postings through the posting service.
5. Create/update its canonical transaction projection and audit record.
6. Transition the draft to posted, save idempotency outcome and insert outbox records.
7. Commit once.

If a commit fails, none of these financial changes persist. Same-key/same-body retries return the saved result. Same key with a different canonical request hash returns 409. A unique source_draft_id and row lock protect concurrent confirmations independently of the client key.

Do not call notification helpers that commit independently inside this transaction. After commit, deliver user notifications separately. A failed LINE reply cannot cause financial reposting.

## 9. Proposed API contracts

Keep /api conventions and current authentication dependencies. The routes below are additions and require OpenAPI tests.

| Method/path | Authentication | Purpose |
|---|---|---|
| POST /api/accounts | Aegis session | Create asset/liability account |
| POST /api/accounts/opening-balances | Aegis session + idempotency | Confirm cutover/opening set |
| GET /api/accounts/balances | Aegis session or scoped linked read | Exact account totals and reconciliation metadata |
| GET /api/financial-transactions | Aegis session or scoped linked read | Exact operation-kind DTOs and signed effects; canonical UI/report source |
| POST /api/integrations/line/link-challenges | Aegis session | Start linking |
| DELETE /api/integrations/line/link | Aegis session | Revoke linking |
| POST /api/integrations/line/webhook | LINE raw signature | Trusted event intake and action dispatch |
| POST /api/integrations/jobs/claim | Scoped service credential | Claim permitted leased work |
| POST /api/integrations/jobs/{id}/complete | Lease capability + fencing generation | Commit result to current job generation |
| POST /api/integrations/jobs/{id}/fail | Same lease scope | Record safe failure/retry state |
| POST /api/transaction-drafts | Aegis session or scoped source-job credential | Create/upsert structured proposal |
| PATCH /api/transaction-drafts/{id} | Owner + expected version | Edit draft |
| POST /api/transaction-drafts/{id}/confirm | Owner action/capability + expected version | Atomic posting |
| POST /api/transaction-drafts/{id}/cancel | Owner action/capability + expected version | Cancel unposted draft |
| POST /api/ledger/{id}/corrections | Aegis session + idempotency | Audited reversal/replacement |
| GET /api/transaction-drafts | Owner/scoped linked read | Pending queue |
| POST /api/reconciliations/imports | Owner session | Idempotent statement preview |
| POST /api/reconciliations/{id}/matches | Owner + version | Confirm matches and explicit new-entry drafts |

Example draft request:

~~~json
{
  "source_event_id": "event-owned-by-the-current-job",
  "type": "expense",
  "amount_minor": "15000",
  "currency": "THB",
  "occurred_on": "2026-10-19",
  "occurred_at": null,
  "date_precision": "day",
  "source_account_id": "main-bank-id",
  "category": "food",
  "trip_id": "chiang-mai-trip-id",
  "description": "Lunch",
  "evidence_ids": ["private-receipt-id"]
}
~~~

Example confirmation:

~~~json
{
  "expected_version": 3,
  "action_token": "opaque-server-issued-capability"
}
~~~

Use Idempotency-Key for financial commands; the server scopes keys to owner and operation. Confirmation uses stored draft fields, not an amount supplied by the button. A service job cannot choose an arbitrary owner_id; the server derives the actor from its trusted source event.

Successful posting returns draft_id, journal_id, status, amount_minor/currency, exact balances, and reconciliation status. Use 201 for a new resource and 200 for a replayed successful outcome. Errors use a stable envelope with code, message, field_errors, retryable and correlation_id. Recommended codes include UNLINKED_IDENTITY, MISSING_ACCOUNT, AMBIGUOUS_CUTOFF, POSSIBLE_DUPLICATE, STALE_DRAFT, IDEMPOTENCY_CONFLICT, UNSUPPORTED_CURRENCY and CAPTURE_FAILED. Return 409 for state/version conflicts; 422 for validated domain input failures.

## 10. n8n workflow design and external delivery

Record the actual installed n8n version before authoring node JSON. Inspect native node schemas/source or trusted exports for serialized parameters. No fabricated operation/typeVersion values.

Deliver three inactive sanitized workflows:

| Workflow | Flow and authority |
|---|---|
| Aegis ingestion processing | Configured trigger → claim eligible extraction job → route text/slip → exact parsing/OCR adapter → submit/update Aegis draft → complete/fail job |
| Aegis LINE delivery | Claim outbox job → choose usable reply token or allowed push/pending route → render controlled message → call LINE → record delivery result |
| Aegis operational checks | On-demand or explicitly configured schedule → query failed jobs/reconciliation state → deliver owner-only digest if enabled |

Use HTTP Request nodes for Aegis and LINE where suitable, Edit Fields for nonsecret settings, clear names/sticky notes, bounded batches and an error branch. Secrets live in credentials. Do not connect n8n directly to ledger tables or use workflow static data for financial idempotency.

Job leases have an expiry and fencing generation. Stale workers cannot overwrite a later result. Suggested pilot defaults: batch 10, lease 120 seconds with renewal for long extraction, maximum 5 attempts with capped exponential backoff/jitter. Capture jobs can have a separate faster policy because media may disappear. Failed jobs are visible and manually retryable with the same business keys.

Reply tokens are single-use and should be used promptly. An immediate acknowledgement consumes that event's token. Later OCR completion needs a push message or a new Review pending interaction. Track token use/expiry securely; never replay tokens from execution history.

LINE push delivery is external: use a stable retry key where supported and record ambiguous timeouts for reconciliation rather than claiming exactly-once visible delivery. Reply messages do not count toward Messaging API plan quota; pushes do. Keep a configurable push budget and a visible pending route when quota or consent blocks delivery. Do not silently send to alternative recipients.

Workflow exports omit credentials, pinned private data and real identifiers. A credential-free fixture path exercises the same transformations. Workflow imports, real credentials and activation remain separate verification levels.

## 11. Duplicate detection and reconciliation

Three independent layers are required:

1. Delivery identity: unique channel/webhookEventId and source job linkage.
2. Evidence identity: message IDs, exact SHA-256 and storage provenance.
3. Economic identity: reliable issuer/reference/account context or reviewed amount/date/payee candidates.

Do not impose a universal bank-reference uniqueness rule from uncertain OCR. Similarity matches produce review candidates; two legitimate identical-price payments remain possible. A typed payment followed by its slip offers "Attach to existing" rather than silently adding another expense. Confirmation cannot post an unresolved duplicate warning without an explicit reviewed resolution.

When a configured issuer/reference/account scheme provides a trustworthy economic identity, reserve its normalized owner-scoped EconomicIdentity key atomically in the same posting transaction with a unique constraint. Different drafts carrying that key cannot both post during concurrent confirms. Return the existing entry as an evidence-attachment/review candidate. Unknown schemes, uncertain OCR and similarity-only matches never manufacture a unique key or silently discard a payment.

An EconomicIdentity reservation belongs to the complete correction lineage. Reversal never releases it; replacement reuses it within that authorized lineage instead of inserting a conflicting new reservation. A replayed original slip resolves to the existing lineage/latest effective state, including a fully reversed record, and cannot silently create a new payment.

Statement imports use an account-scoped import checksum plus stable row identity to prevent replay. Match to existing entries before creating drafts for unmatched lines. The statement model distinguishes posted/settled lines from pending authorizations. Report unmatched entries and balance differences explicitly.

Tracked balance, net position, budget remaining and safe-to-spend are different concepts. V1 exposes the first three and the last reconciliation date. A slip or user confirmation is not bank settlement verification.

## 12. UI, reports and backward compatibility

Add account setup and review pages using the existing design/components, not a separate frontend. Reuse transactions, trips, budgets and dashboard routes.

- Account setup collects account type, opening amount, cutoff/precision and confirmation.
- Review queue supports missing fields, evidence preview, duplicate attachment, Confirm/Edit/Cancel and safe stale-action messages.
- Transaction views show account, source, posted/reversed state and evidence; correction actions explain the resulting financial entry.
- Trip views show spent and remaining budget without counting the same row twice via category/tag joins.
- Show mobile-accessible controls, readable THB formatting, labeled form fields, loading/failure states and keyboard access.
- Deep links preserve intended destination through login, using allowlisted local paths.

Legacy compatibility must be explicit. Existing nonledger rows can retain old editing behavior while clearly marked nonposting_history. That designation excludes them from balance replay, not from historical reporting. Retain historical monthly/category/trip records exactly once. A replayed row's migrated_journal_id excludes its old reporting copy once the journal representation exists. Because legacy rows have no currency, keep unverified legacy totals labeled and separate until the owner explicitly confirms their migration/reporting currency; a display preference is not currency evidence. Only confirmed THB history may join THB reports. New writes after account cutover require a real account and use the posting service, whether they originate from HTTP, CSV, MCP, seed/demo or LINE. Return a helpful validation error when an old caller lacks required account information; do not silently assign an account. Move Aegis consumers to the new exact financial-transactions DTO; old endpoints must not misrepresent a refund/reversal/transfer as an ordinary positive-only expense/income.

Update reports, exports, AI aggregate context, recurring transaction generation and notifications to use canonical money semantics. A planned recurring bill is not a posted payment. Existing subscription/recurrence fields may represent forecasts until explicitly confirmed as paid.

Preserve the legacy total_balance API field only with a documented compatibility choice and update every caller consistently. Prefer additive fields such as asset_balance_minor, liability_balance_minor and net_position_minor. If legacy float outputs remain temporarily, convert at the presentation boundary only; authoritative ledger arithmetic stays exact.

## 13. Migration, rollout and operations

### 13.1 Migration strategy

1. Back up the database; rehearse on disposable SQLite and real PostgreSQL.
2. Add account, journal, draft, inbox/outbox, identity and evidence structures and supporting constraints.
3. Add nullable legacy linkage/origin fields; avoid destructive reinterpretation of old rows.
4. Introduce a disabled ledger feature flag and read-service adapter.
5. Owner chooses verified cutover/openings or an earlier replay anchor.
6. Preview legacy migration mapping; prohibit duplicate migration of a source row.
7. Switch new write paths to the posting service and update reads/caches together.
8. Confirm balance/report equivalence using known fixtures before pilot activation.

Follow Alembic batch conventions for SQLite. Test upgrade from the current migration head as well as fresh installs. A metadata.create_all test is insufficient. Supply a structural downgrade for disposable databases. Operational rollback after real postings disables ingestion/feature exposure and preserves ledger history; do not drop live financial tables as a rollback shortcut.

### 13.2 Deployment choices

Recommended: hosted public Aegis API, durable PostgreSQL, private object storage and an actual media-capture worker; n8n may run on the RPi using outbound HTTPS. Accepted events/media then survive Pi downtime, though immediate responses may not.

Local pilot alternative: Aegis, PostgreSQL, worker, n8n and private files on RPi, with restricted public HTTPS ingress. Private Tailscale alone is not reachable by LINE. Document loss/delay risk during home-network/Pi outages; redelivery is not guaranteed.

Initial configuration names are proposed: LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_ID, LINE_PROVIDER_ID, AEGIS_PUBLIC_URL, integration credential, ledger feature flag, storage settings, OCR adapter/provider, job lease/retry settings and push-budget settings. Confirm existing naming conventions before adding variables. Do not put secrets in source, ClickUp, task attachments or workflow exports.

### 13.3 Observability, privacy and recovery

Log correlation ID, event/job/draft/journal IDs, duration, state transition and safe error code. Do not routinely log slip images, full account numbers, tokens or full financial message bodies. Restrict n8n execution-data retention and access. Define evidence retention with the owner; deleting an image must not erase the financial journal or source audit reference.

Monitor webhook rejects/failures, oldest job age, capture failures, extraction failures, duplicate candidates, outbox age, daily pushes and reconciliation differences. Backup database and evidence off device; encrypt transport/storage and test recovery. Document secret rotation and unlinking.

## 14. Verification and acceptance

### 14.1 Deterministic accounting fixture

The following sequence is fictional. Start all accounts at one cutoff.

| Step | Bank | Savings | Cash | Card debt | Net position | Cumulative net spending |
|---|---:|---:|---:|---:|---:|---:|
| Openings | 20,000 | 30,000 | 1,000 | 2,000 | 49,000 | 0 |
| Cash food expense 150 | 20,000 | 30,000 | 850 | 2,000 | 48,850 | 150 |
| Bank → savings 1,000 | 19,000 | 31,000 | 850 | 2,000 | 48,850 | 150 |
| Card purchase 500 | 19,000 | 31,000 | 850 | 2,500 | 48,350 | 650 |
| Card repayment 700 | 18,300 | 31,000 | 850 | 1,800 | 48,350 | 650 |
| Card refund 200 | 18,300 | 31,000 | 850 | 1,600 | 48,550 | 450 |

Opening setup and transfers produce zero income. Separately test income THB 500, fractional satang precision, transfer fees, partial/full refunds, reversals and rebuild of every balance from postings.

### 14.2 Mandatory test matrix

| Area | Cases and pass condition |
|---|---|
| Money | Decimal parsing, overflow, zero/negative public amounts, unsupported currencies and unbalanced journal rejection |
| Cutoff | Before/after/exact cutoff, same-day date-only ambiguity, repeated openings and historical replay |
| Atomicity | Forced failure between posting/projection/outbox writes leaves no partial effect |
| Concurrency | Real PostgreSQL simultaneous confirms/cancel/edit, different-draft economic-key collision, duplicate corrections and partial refunds; one valid effect chain and no over-refund |
| Idempotency | Replayed webhook/batch, same-key same-body, changed-body conflict, crash after commit |
| Jobs | Expired lease fencing on draft/evidence writes as well as completion, human-field preservation, restart, extraction retries and permanent failure visibility |
| Identity | Invalid signature, unknown/unlinked actor, group events, token expiry/reuse and cross-owner access |
| Media | Duplicate/cropped image, unsupported MIME, oversized file, expired media and private evidence access |
| Extraction | Wrong amount, missing account/date, Thai text/calendar normalization and injected instructions |
| Matching | Typed entry plus slip, legitimate equal-amount payments and uncertain bank references |
| Reports | Category/trip/tag joins, opening/transfer/card-repayment exclusion, refunds and cache invalidation |
| Legacy | HTTP/CSV/MCP/recurring writer paths, nonposting history retained once in verified-currency reports, exact projection adapter and migration replay protection |
| Delivery | Used/expired reply token, push quota, success reply failure and ambiguous timeout without reposting |
| Reconciliation | Repeated statement import, unmatched rows, balance differences and pending authorizations |
| Operations | Worker/Pi outage, database/evidence backup and successful restoration |
| Frontend | Login-return deep link, mobile review/edit/confirm, errors, keyboard and accessible labels |

Use real PostgreSQL fixtures and actual migration upgrades. The existing in-memory SQLite test client cannot prove row locking, deferred constraints or concurrent posting safety.

### 14.3 Commands and evidence

Check current repository commands before execution. At the reviewed baseline, the expected checks are:

~~~bash
# From backend/, in the project's isolated environment:
uv pip install -e ".[test,dev]"
alembic heads
alembic upgrade head
pytest tests/ -v --tb=short
ruff check app/
bandit -r app/ -ll

# From frontend/:
bun install --frozen-lockfile
bunx tsc --noEmit
bun run build
~~~

Use separate disposable DATABASE_URL values for SQLite and real PostgreSQL; never run migration downgrade tests on the user's live database. Inspect and repair the hardcoded test fixture before claiming PostgreSQL test coverage.

Report evidence separately: source/static review; unit/adapter execution; database/migration/concurrency execution; n8n import/demo; live LINE/OCR integration; supervised pilot operation. Do not mark unrun checks passed. Record actual n8n version, provider/model, tested commit and remaining limits.

### 14.4 Human review gates

- G1: owner verifies real accounts, posted opening balances, cutoff and legacy migration mode before any live cutover.
- G2: owner reviews real LINE draft presentation, categories/trip assignment and correction behavior using deliberate sample entries.
- G3: owner approves production activation after live acceptance and restoration evidence. Prepare everything inactive until activation is authorized.

These gates do not block Codex from implementing code, fixtures, migrations, documentation, draft PRs or inactive workflow exports.

## 15. Implementation work packages and role tags

Tags describe the responsibility of a work item, not a limitation on agent capability. Any agent may execute a role. Coordinate shared files and use dependency gates rather than having every agent edit the same models simultaneously.

Parent task: Aegis — Build LINE finance tracker from SDD  
Parent tags: aegis, line, n8n, codex, human-review  
No due date, assignee or guaranteed duration is set by this design.

| ID | Work package | Primary role tags | Depends on | Reviewable completion |
|---|---|---|---|---|
| A01 | Baseline audit and ADR | role:architecture, role:docs | None | Current source reconciled with SDD; ADR and API/schema decisions |
| B01 | Accounts and immutable ledger | role:backend | A01 | Exact postings, openings/transfers/corrections, migrations and accounting fixture |
| B02 | Drafts, financial APIs and writer compatibility | role:backend | B01 | Atomic confirmation, idempotency, HTTP/CSV/MCP/recurring integration and canonical reads |
| L01 | LINE identity, ingress and durable media intake | role:backend, role:security | A01 | HMAC, private identity linking, event/job state, hosted capture and outbox |
| N01 | n8n text and delivery workflows | role:automation | B02, L01 | Inactive exports, fake-data execution, lease/retry/error paths |
| F01 | Aegis account/review UI and LINE menu | role:frontend | B02, L01 | Usable onboarding, review/correction, six-button menu and authenticated deep links |
| R01 | Slip extraction and economic duplicate review | role:rnd, role:automation | N01 | Real provider adapter plus fixtures, evidence attachment and ambiguity handling |
| B03 | Trip budgets and statement reconciliation | role:backend, role:frontend | B02 | Correct report joins, imports/matches and visible balance differences |
| O01 | Deployment, privacy, backup and runbooks | role:devops, role:docs | B01, L01 | Running worker design, secrets/retention, restore drill and operator guide |
| Q01 | End-to-end verification and pilot handoff | role:qa, human-review | B02, L01, N01, F01, R01, B03, O01 | Evidence matrix, real PostgreSQL tests, live checklist and owner review gates |

Suggested parallel lanes after A01: ledger work B01 → B02; LINE work L01; then frontend F01 and n8n N01 can progress against the shared contracts. A task blocked by credentials must report that blocker while completing independent fixtures/docs. Do not mark the parent done when only the text path works; record that as an intermediate milestone.

## 16. Codex execution instructions and definition of done

1. Read this SDD, current AGENTS.md if any, CLAUDE.md and docs/architecture.md. Reconcile the current default branch with the pinned baseline; do not reset or overwrite unrelated work.
2. Use an isolated feature branch or worktree following repo conventions. Commit the SDD as docs/design/007-line-money-ledger.md if the slot is free.
3. Produce a short plan mapped to A01–Q01 and record assumptions. Keep the existing stack and avoid broad rewrites.
4. Start with B01/B02 and fictional fixtures. Complete the opening → text draft → confirmation → balance vertical slice before adding image complexity.
5. Inspect all financial writer and reader paths, including MCP and recurrence. Implement shared services with clear transaction ownership.
6. Coordinate agents by role/file ownership; use an independent review for money, auth, migration and retry behavior.
7. Build inactive sanitized n8n exports only after checking the target version/schema. Do not invent credentials or claim import tests that were not run.
8. Add source, migration, real PostgreSQL concurrency, API and UI verification. Run applicable existing checks and fix material regressions.
9. Update ADR, setup/runbook, API docs, CHANGELOG.md, fixtures and the live acceptance checklist. Open a draft PR with final scope and evidence.
10. Stop before production activation/live data cutover unless the owner has authorized it. Clearly identify the remaining account setup, OCR choice and human acceptance steps.

Definition of done:

- All FR requirements have implementation/test references or an explicitly accepted scope adjustment.
- Accounts and balances satisfy the exact fixture and replay/concurrency tests.
- All new financial writers use the posting service; no hidden ORM bypass remains.
- LINE text and image paths, confirmation/edit/cancel and economic duplicate review work against the real configured integration.
- Trips, budgets and reconciliation use correct ledger semantics.
- n8n imports, scoped credentials, media capture, notification retry and restart recovery have evidence.
- Migration rehearsal and restoration drill pass.
- Owner completes G1/G2 and receives a documented G3 activation decision.
- Draft PR, workflows, docs and test evidence are linked from the ClickUp parent task. Pending activation is reported honestly rather than labeled production complete.

## 17. Implementation file map

Existing files are extension points, not permission to rewrite unrelated behavior.

| Area | Existing extension points | Proposed additions |
|---|---|---|
| Models/schema | backend/app/models/__init__.py; models/transaction.py; schemas/transaction.py | models/account.py, journal.py, financial_transaction.py, transaction_draft.py, receipt_asset.py, ingestion_event.py, outbox.py, line_identity.py; exact financial-transaction DTO schemas |
| Domain services | Existing router/service layering | services/ledger.py, drafts.py, financial_reads.py, line_identity.py, line_ingestion.py, slip_extraction.py, outbox.py, line_messaging.py |
| HTTP/auth/config | backend/app/auth.py; config.py; main.py; routers/transactions.py | routers/accounts.py, ledger.py, drafts.py, line_webhook.py, integrations.py; associated schemas |
| Other writers | backend/app/mcp/tools/transactions.py; CSV, recurring and seed handlers | Shared posting/draft adapters and migration tooling |
| Jobs | backend/app/jobs.py; worker.py | Persistent capture/job dispatcher and lease/fencing adapter |
| Reads | routers/dashboard.py, trips.py, budgets.py; reports/exports/AI aggregates; notification_service.py; cache.py | Canonical ledger-aware read service and cache invalidation |
| Frontend | frontend/src/lib/api.ts; types/index.ts; app/settings/page.tsx; existing transaction/trip/dashboard routes | app/accounts/page.tsx; app/review/page.tsx; focused setup/review components |
| Database/tests | backend/alembic/versions; tests/conftest.py; CI test workflow | Reversible migrations; real PostgreSQL/migration/concurrency fixtures |
| Delivery | Env examples; CHANGELOG.md; docs/design | ADR 007 if free; setup/runbook; workflows/n8n inactive JSONs; fictional fixtures |

Proposed file paths may be adjusted to current repository conventions; keep responsibility and traceability.

## 18. References and pending setup choices

Repository references are pinned to the reviewed baseline where appropriate:

- Baseline: https://github.com/santapong/Aegis/commit/9071ddf0f75f4cf903a6739c41a7ff7e0c6af22c
- Repository instructions: https://github.com/santapong/Aegis/blob/9071ddf0f75f4cf903a6739c41a7ff7e0c6af22c/CLAUDE.md
- Architecture: https://github.com/santapong/Aegis/blob/9071ddf0f75f4cf903a6739c41a7ff7e0c6af22c/docs/architecture.md
- Transactions: https://github.com/santapong/Aegis/blob/9071ddf0f75f4cf903a6739c41a7ff7e0c6af22c/backend/app/models/transaction.py
- MCP writes: https://github.com/santapong/Aegis/blob/9071ddf0f75f4cf903a6739c41a7ff7e0c6af22c/backend/app/mcp/tools/transactions.py
- Dashboard: https://github.com/santapong/Aegis/blob/9071ddf0f75f4cf903a6739c41a7ff7e0c6af22c/backend/app/routers/dashboard.py
- Test fixture: https://github.com/santapong/Aegis/blob/9071ddf0f75f4cf903a6739c41a7ff7e0c6af22c/backend/tests/conftest.py
- LINE signatures: https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/
- LINE receive/redelivery/media: https://developers.line.biz/en/docs/messaging-api/receiving-messages/
- LINE actions/menu: https://developers.line.biz/en/docs/messaging-api/actions/ and https://developers.line.biz/en/docs/messaging-api/using-rich-menus/
- LINE reply API: https://developers.line.biz/en/reference/messaging-api/nojs/
- LINE message pricing/quota: https://developers.line.biz/en/docs/messaging-api/pricing/

Official LINE behavior was checked on 18 October 2026. Read the current provider documentation again during implementation for any changed limits or APIs.

Pending operator inputs do not prevent coding with placeholders: actual account names/openings/cutoff; LINE channel and secrets; target n8n version/URL; hosted versus local worker/storage deployment; OCR/vision provider and credential; evidence retention; deliberate live test identity; activation decision.

