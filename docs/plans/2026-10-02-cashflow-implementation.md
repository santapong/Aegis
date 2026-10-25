# Aegis personal and business cash-flow implementation plan

Date: **October 2, 2026 · Asia/Bangkok**. Status: **M0–M3 and M4.1–M4.2 implemented locally; real LINE pilot and release gates remain open**.

This turns the [October 1 feature design](../design/2026-10-01-cashflow-workspaces/proposal.md) into work packages and release gates. The target is the authenticated Aegis application. The separately deployed public landing remains the introduction; it is not a cash-management backend. The first sixteen implementation packages and M4.1–M4.2 are implemented locally; the current [completion audit](../validation/2026-10-02-all-m/completion-audit.md) separates execution evidence from open external gates. M2 extends the first release; see the [M2 release guide](../releases/2026-10-02-m2-everyday-cash-review.md) and [M2 evidence](../validation/2026-10-02-m2/README.md). Production rollout and independent owner/customer task acceptance remain separate gates; see the [first release guide](../releases/2026-10-02-first-cashflow-release.md) and [dated validation](../validation/2026-10-02-first-release/README.md).

## Outcome and first release

Build one reliable cash engine with separate **personal** and **owner-run business** workspaces. A user should be able to answer: **“Will my upcoming money and bills fit on these dates?”**

The first release is M0 + M1: choose a workspace, enter dated cash balances, record income/expenses, add upcoming commitments, inspect a daily forecast/calendar, compare a purchase or delayed receipt, and match a recorded payment without counting it twice. Both audiences use this flow. Structured business receivables/bills come in M3; a business owner can use ordinary dated commitments before then.

| Milestone | User-visible result | Depends on | Completion gate |
| --- | --- | --- | --- |
| **M0 — Trusted cash inputs** | Separate workspaces, cash accounts, dated opening amounts, and a truthful “Cash today.” | Scope/data contract and migration rehearsal | No invented balance, mixed currency, or cross-workspace leakage. |
| **M1 — Dated cash planning** | Daily forecast, money calendar, commitments, scenario comparison, manual payment matching. **First usable release.** | M0 | The personal and Business X stories reconcile; dates and matching work end to end. |
| **M2 — Everyday review** | Reviewed CSV import, reliable recurring bills, entered debt installments, goal allocations, source-based in-app alerts. | M1 | Import retries and recurring schedules cannot create duplicate cash effects. |
| **M3 — Business operations** | Receivables, supplier bills, partial settlements, overdue review, 13-week view, forecast-versus-actual review. | M1; M2 for business CSV intake | Outstanding documents never become cash until recorded settlement; weekly summaries expose daily lows. |
| **M4 — Connected capture** | Complete a bounded LINE pilot using the existing implementation. | M2; M3 before document-specific chat commands | Real-channel draft → confirm → record → undo is verified, including interrupted/duplicate delivery. |

Package checkmarks mean local implementation and verification. The single owner-authorized independent reviewer has now signed off on the inspected cash repairs and container packaging. Remote CI, owner/customer comprehension, real LINE use and rollout remain open; see the current completion audit. These are completion gates, not a delivery-date promise.

## Scope decisions for implementation

- Start with a single owner. A personal workspace and one or more business workspaces are separate scopes, even when owned by the same person. Team/household sharing is a later permission model.
- Each workspace uses one currency. Initially support THB and USD with two-decimal amounts; changing currency requires a new workspace or explicit reviewed migration, never relabeling existing values. No foreign-exchange aggregation in this release.
- Include cash/bank accounts only. Credit-card purchases and card liabilities need a later dedicated contract; an explicitly entered card repayment can be a cash commitment. Existing debt/investment features remain available, but do not automatically become cash movements.
- New cash commitments are intentional future movements. Existing Plans remain tasks/intentions, Budgets remain limits, and Savings Goals remain targets. Nothing becomes “paid” because a task is completed.
- Manual input is sufficient for M0–M1. CSV review follows in M2. Bank feeds, receipt OCR, WhatsApp, Instagram, accounting connections, multi-company reporting, and team roles are separate later scopes.
- M3 tracks existing invoice/bill references and expected cash, without tax-invoice issuance, payroll/tax calculations, accrual accounting, or initiating payments. The existing Stripe `Payment` model is not a customer-invoice settlement model.
- Use the same application for self-hosting and a future managed service. Validate PostgreSQL for a hosted pilot and SQLite for local development. Hosted billing, provisioning, backups/support commitments, and service pricing require a separate launch plan.
- Keep the accepted Aegis mark, Syne/Inter typography, charcoal, warm text, amber actions, and restrained teal. Start with the accepted dark identity; the separate light-theme concepts still need selection before implementation.

## Starting evidence and constraints

Local source rechecked October 2: branch `agent/comet-asset-prompt`, HEAD `e2c4a9c68d6304799ff5bc28b9fef7cf951f3878`. The checkout contains existing public-design changes and in-progress LINE/backend work. No fresh remote fetch or hosted-feature verification was performed for this plan. Preserve those changes; do not assume the current branch is an integration base.

| Inspected source | Current observation | Implementation consequence |
| --- | --- | --- |
| [Dashboard forecast](../../backend/app/routers/dashboard.py) | Sums recorded income minus expense for “current balance”; projects monthly historical averages and a 30% recurring-plan blend. | Add a dated, account-scoped forecast contract. Do not present the old heuristic as a precise cash plan. |
| [Transactions](../../backend/app/models/transaction.py), [schemas](../../backend/app/schemas/transaction.py) | No workspace/account/transaction-currency fields; money is exposed as floats. | Add explicit scope and decimal contracts without silently rewriting historical currency. |
| [Recurrence service](../../backend/app/services/recurrence.py) | Generates dates on read, including clamped month days and weekend adjustments; no persistent settlement identity. | Reuse the date logic after boundary tests; add stable occurrence identities and exception handling. |
| [Plans](../../backend/app/models/plan.py), [Savings Goals](../../backend/app/models/savings_goal.py), [Debt](../../backend/app/models/debt.py) | Existing separate concepts with legacy money semantics. | Use explicit adapters; no automatic goal/plan/debt balance changes from cash matching. |
| [CSV confirmation](../../backend/app/routers/transactions.py) | Creates transactions from submitted rows; the inspected handler has no durable batch/row deduplication. | Build server-held review batches and idempotent posting in M2. |
| [Transaction MCP tools](../../backend/app/mcp/tools/transactions.py), [LINE service](../../backend/app/services/line_finance.py) | Write transactions outside the ordinary transaction router. LINE undo can delete its recorded transaction. | Route all relevant writes/corrections through the shared ownership, matching, revision, and audit rules. |
| [Chart](../../frontend/src/components/charts/cashflow-chart.tsx), [API client](../../frontend/src/lib/api.ts), [currency formatter](../../frontend/src/lib/utils.ts) | Existing Recharts/React Query integration; formatting can use a global active currency. | Reuse the stack; all new financial views pass the record/scope currency explicitly. |
| [Test fixture](../../backend/tests/conftest.py), [CI](../../.github/workflows/test.yml) | The API fixture creates an in-memory SQLite engine even when CI selects PostgreSQL. CI includes a PostgreSQL migration step but this does not prove PostgreSQL API behavior. | Add a real PostgreSQL integration fixture for cash features, especially locking/idempotency. |

The [repository roadmap](../../ROADMAP.md) is an August historical release overview. Claude memory reports a `develop` integration / `main` release model, while current test workflow triggers target `main`. Before implementation, reconcile the live remote branch rules and ensure the intended integration PR actually runs required checks. This plan does not change release versions or claim a current production state from either document.

The [prototype verification](../validation/2026-10-01-cashflow-workspaces/README.md) records selected local arithmetic and browser checks on October 1. Its JavaScript model is a fixture/reference, not the production engine. [LINE notes](../line-finance.md) report September 23 local checks; real delivery and production migration remain unverified by this planning task.

## Shared data and calculation contract

Keep cash calculation in a pure backend service. The API, chart, calendar, daily table, summary, and explanations consume the same result. Frontend code may format values and edit assumptions; it must not implement a competing forecast.

### Proposed entities

These are proposed model responsibilities, not files or tables already delivered.

| Entity | Required responsibility |
| --- | --- |
| `Workspace` | Owner, personal/business type, name, currency, timezone, revision, selected cash buffer. Owner-only access for the first release. |
| `CashAccount` | Workspace/currency, cash or bank type, active/archived state. An account with history is archived, not destructively removed. |
| `BalanceAnchor` | Account, amount, effective date/boundary, provenance, review date, and audit link. An opening amount is **start-of-day**, so same-day actuals count after it. |
| Existing `Transaction` extension | Nullable workspace/account/currency for migration; required on new cash-aware writes. Keep original IDs, tags, trips, ownership and plan links. |
| `CashTransfer` | One identity, two authorized account endpoints, same currency, amount/date, provenance. Do not encode it as ordinary income/expense and inflate legacy reports. |
| `CashCommitment` + `CommitmentOccurrence` | Expected amount/direction/account, optional due date, expected cash date, rule and stable occurrence IDs. Optional unique reference to an existing Plan or recurring Transaction. |
| `CashSettlement` | Allocation of recorded cash to an occurrence, amount and revision, confirmation/reversal trail. A transaction may cover multiple occurrences, but allocation cannot exceed its eligible amount. |
| `CashScenario` | Workspace, base revision, named amount/date overrides and additions. Persisted drafts are separate from actual records and base commitments. |
| `CashAuditEvent` | Actor, operation, source IDs, revision and correction trail; never log credentials or unnecessary message bodies. |
| Later additions | `ImportBatch`/`ImportRow` in M2; business documents linked to commitments and immutable `ForecastSnapshot` in M3. |

Use `Decimal` in Python, exact database numeric values, and decimal strings in new API payloads. Preserve existing stored precision initially and validate supported range/scale; reject excess precision instead of silently rounding. Convert to chart numbers only for display, with exact strings retained for labels and checks.

### Financial invariants

1. **Cash as of a date** = each selected account's valid opening/anchor amount + eligible recorded movements after that anchor through the as-of boundary. For the initial start-of-day opening, movements on that date are included. A future-dated recorded transaction is flagged for review and is neither cash today nor silently a confirmed future receipt.
2. **Projected end-of-day cash** = cash as of the date + remaining dated commitments after the as-of date through each future day. Use explicit expected dates. No monthly-average or speculative-growth blend in this engine. Same-day plans need confirmation, rescheduling, or an unresolved flag; do not silently omit them without a completeness warning.
3. A missing anchor, unassigned cash-relevant record, or overdue outstanding item without a usable expected date makes the affected scope **incomplete**. Show what is missing and how to resolve it; do not display an unqualified cash conclusion. A deliberately narrower verified account selection remains visibly labeled as partial scope.
4. A match reduces only its occurrence's outstanding amount once. Validate direction, workspace, currency and nominated account; require reviewed reassignment if the actual used another account. Prevent excess allocation and duplicate confirmation under concurrent requests. A recorded cash movement still counts even when its excess amount cannot be matched.
5. A settlement reversal releases the allocation; reversing the cash transaction is a separate explicit action. A refund is a new recorded movement with provenance. It does not silently reopen a paid commitment; any reopening/amendment is reviewed. Existing writers cannot edit/delete a matched transaction behind the settlement service.
6. Recurring occurrences are planned rows, never pre-posted transactions. Identify them by source/rule revision/nominal slot with an immutable row ID. Changing an expected date preserves the occurrence ID. Series edits affect reviewed future unsettled occurrences; settled history remains intact. Two nominal slots that clamp to the same date must be surfaced for review rather than silently merged or doubled.
7. Transfers within the selected accounts net to zero. A transfer across the scope boundary affects that scope once. Personal/business owner contributions and draws retain paired provenance and are not automatically operating revenue or supplier costs. Reject unauthorized or cross-currency endpoints.
8. Buffers/goal allocations reduce **headroom**, not bank cash. Show lowest cash/date, first negative-cash date, first below-buffer date, and buffer gap separately. Budgets/goal targets are not automatically outflow events. Avoid counting a scheduled savings transfer and the same goal intention twice.
9. Scenarios never post cash or overwrite base plans. Hold the same starting cash and list changed assumptions. Events moved beyond the visible period remain visible as later obligations/receipts. If the base revision changes, show “Base changed” and require an explicit refresh of the comparison.
10. Dates are workspace-local calendar dates; as-of/date boundaries are explicit. Daily values are end-of-day and do not guarantee intraday availability. Weekly views preserve both weekly closing and the lowest daily balance/date.

## Milestone work packages

### M0 — Trusted inputs and a working cash-today slice

- [x] **M0.1 — Freeze contracts and migration inventory.** Finalize scope, money/date rules, supported account types and the legacy write policy. Inventory record counts/links, ownerless rows, currency ambiguity, recurring sources, and all transaction writers on a disposable dataset. Record baseline regressions and actual database-engine test coverage.
- [x] **M0.2 — Additive schema and shared write service.** Add workspaces, accounts, opening anchors, transfers, audit/revision support and nullable legacy transaction scope. Extend validation across HTTP, MCP, imports and LINE adapters. Require ownership for every linked object, not just the top-level request. New cash-aware endpoints must not accept user IDs as authorization.
- [x] **M0.3 — First vertical slice.** Implement workspace/account setup, an explicit opening-balance review, one manual income/expense, source detail and “Cash today.” Validate both workspace types through the real API and UI before expanding planning.
- [x] **M0.4 — Rehearse legacy onboarding.** Offer a reviewed personal-workspace mapping; business assignment is explicit. Currency/account ambiguities remain unresolved until the user confirms them. Verify row IDs, links, totals and rerun idempotency. Keep legacy screens usable for records not yet mapped.

**Gate:** A user can set up one verified cash account and record a movement. Both ownership scopes are isolated. Missing data is visible. SQLite and real PostgreSQL migrations/CRUD pass; legacy login, transactions, budgets, plans, trips, exports, MCP and existing LINE behavior pass relevant regressions.

### M1 — Dated planning, scenarios and manual matching

- [x] **M1.1 — Commitments and occurrence identity.** Add one-off commitments first, then weekly/monthly recurrence using reviewed source adapters. Cover month ends, leap years, weekend shifts across window boundaries, cancellations and edits. Avoid auto-adopting both a recurring Transaction and its linked Plan for the same commitment.
- [x] **M1.2 — Deterministic forecast API.** Implement a bounded daily horizon (default 30 days, maximum 180 days), complete/incomplete status, account/currency scope, source events, low-cash/buffer summaries, unresolved/later items and revision. Keep historical cash, planned cash and optional future estimates distinct; estimates are outside this release.
- [x] **M1.3 — Implement the selected workspace experience.** Add Overview, Money calendar/agenda, Scenarios and Review & match using the accepted Aegis identity. Bring the prototype's useful interactions into the authenticated shell rather than embedding its static files. Preserve selected scope and drafts across views; scope cache keys by user/workspace/accounts/currency/period/revision and clear them on logout.
- [x] **M1.4 — Atomic settlement and corrections.** Match an existing manually recorded transaction to full/partial occurrences with a before/after preview, idempotency key and stale-version check. Confirmation of a new payment must explicitly create its actual record and match in one transaction. Retry, concurrent confirmation, undo/unmatch, corrections and refunds retain an audit trail and invalidate the same scoped forecast cache.

**Gate:** All acceptance examples below pass through backend + UI. Chart/table/calendar agree. Scenarios preserve base records. Refresh retains explicitly saved data/drafts; failures retain unsaved inputs and never display success before persistence. Release M0–M1 to a controlled owner pilot only after rollout checks.

### M2 — Everyday input and review

- [x] **M2.1 — Durable CSV review.** Parse an uploaded file into a server-held batch with row validation, explicit account/currency mapping, candidate duplicates and candidate matches. Confirm selected rows from that batch; do not trust a replayed client preview as the source of truth. Repeated batch confirmation cannot post twice. Identical date/amount/description alone is a review signal, not proof of a duplicate.
- [x] **M2.2 — Commitment management.** Complete the documented recurrence intervals/split schedules and per-occurrence exceptions. Expose upcoming/overdue items and a review action. Keep a source linked exactly once and test generated horizon extensions for duplicates.
- [x] **M2.3 — Goals and entered installments.** Let users explicitly link a goal allocation or entered debt-payment schedule. State whether money is reserved or actually transferred. Do not calculate interest/tax or update a debt principal from an expense without an explicit validated rule.
- [x] **M2.4 — Explainable in-app alerts.** Show a below-buffer/negative-cash explanation with dates, sources, scope and stale/missing data. Deduplicate alerts by meaningful input revision and event; resolve them when conditions change. No outbound message channel is required here.

**Gate:** CSV retry, duplicate review, correction and matching work end to end. No automatic double counting between plans, recurring sources, allocations and transfers. Calendar/agenda and review tasks work with keyboard and compact screens.

### M3 — Small-business operations

- [x] **M3.1 — Receivable and supplier-bill records.** Add counterparty/reference, original amount, due date, expected cash date, remaining amount and linked cash commitment. One document contributes cash through its remaining occurrence(s), never through both document total and plan amount. Manual intake precedes CSV mapping.
- [x] **M3.2 — Settlement and overdue workflow.** Reuse the M1 allocation service for multiple/partial receipts and payments. Age unpaid amounts by due date; use expected date for cash projection. Handle cancellation/credit adjustments explicitly and flag overdue items lacking a reviewed future expectation.
- [x] **M3.3 — 13-week view.** Aggregate the daily engine with explicit workspace week boundaries. Show weekly close, weekly minimum/date and cash sources; enable daily drill-down and keep later items discoverable.
- [x] **M3.4 — Forecast snapshots and variance.** Store scope, as-of date, engine version, assumptions and source versions. Compare on the same scope/boundaries; attribute timing/amount/unmatched/new differences and keep an unclassified residual when history is insufficient. Explain balance-anchor revisions separately rather than attributing them to customer payment behavior.

**Gate:** Business X remains correct under late/partial receipts and changed cost dates. An invoice is never reported as cash today before settlement. Snapshots stay immutable after later edits. The 13-week summary cannot conceal a daily cash shortage.

### M4 — LINE first, other connections later

- [x] **M4.1 — Reconcile existing LINE work.** Recheck the uncommitted service, migration and tests against M0–M3 before changing it. Add explicit workspace/account/currency linking and permissions; existing account-only links cannot guess a new business destination. The currently documented THB and one-to-one scope remains the initial pilot scope.
- [x] **M4.2 — Reuse capture and correction.** Draft → confirm → actual record → optional reviewed match → undo uses the same shared write service. Preserve channel event deduplication, atomic outbox and retry behavior. Surface unsupported/ambiguous commands clearly. No silent AI posting.
- [ ] **M4.3 — Verify a bounded real-channel pilot.** With authorized channel setup, test a labeled disposable record, retry/duplicate delivery, cross-workspace access, disconnect and undo. Retain delivery/freshness status and manual entry when delivery is unavailable. Local test success alone cannot close this package.
- [ ] **M4.4 — Decide the next connector from evidence.** Review actual use of LINE, then scope WhatsApp/Instagram/accounting/receipt integration separately. Recheck official platform capability, account requirements, permissions and current terms before promising a connector. Teams and optional AI explanations are separate follow-up work.

**Gate:** Real delivery and correction evidence exists for the chosen scope. Connection/disconnection is explicit and no operation initiates a payment. Do not mark every chat platform implemented because LINE works.

## Implementation map and compatibility

| Area | Existing integration points | Proposed additions |
| --- | --- | --- |
| Models/migrations | `backend/app/models/`, `backend/alembic/versions/` | Cash entities and additive revisions; extend existing Transactions carefully. Recheck Alembic heads including uncommitted LINE revision `a0923f1a0001` before choosing a parent. |
| Backend domain | `backend/app/services/recurrence.py`, notification/caching helpers | `backend/app/services/cashflow/` for inputs, scheduling, forecast, settlements, scenarios and audit. Keep calculation independent of HTTP/database adapters. |
| API | Existing auth, transactions/plans/dashboard/MCP/LINE writers | `backend/app/routers/cashflow.py` and matching schemas for proposed `/api/cash/*` endpoints. Existing writes call shared mutation/correction logic. |
| Frontend | API client/types, React Query, Zustand, Recharts, authenticated shell | Proposed `/cashflow` views and `components/cashflow/`; scoped query keys and explicit-currency formatting. Preserve public/auth route ownership and existing dashboard customization. |
| Tests | `backend/tests/`, current type check/build, saved prototype fixtures | Production-engine fixtures; genuine PostgreSQL integration/concurrency tests; browser task checks against the actual API. |
| Docs | Everyday/developer docs, public demo, deployment guides | Actual UI labels, worked setup/match/correction examples, source-based API examples and pilot/rollback runbook. Public capability claims follow verified availability. |

Proposed API responsibilities: workspace/account setup; opening-balance review; commitments/occurrences; `GET /api/cash/forecast` with explicit workspace/account/as-of/end inputs; scenario create/edit/preview; settlement preview/confirm/reverse; later imports, business documents and snapshots. Final paths and schemas are frozen in M0.1, not assumed to exist now.

Responses include exact money/currency, scope, revision, completeness warnings, source identities, calculation version and dated results. Validate horizon and pagination limits. A stale mutation returns a recoverable conflict; idempotent replay returns the original result. Use a consistent database snapshot so cash, outstanding amounts and revision cannot come from different concurrent states.

Keep `/api/dashboard/cashflow-forecast` and the dashboard bundle's current response shape while consumers migrate. Label that view as a historical trend; add the new cash view beside it, not a silent wire-format replacement. Audit legacy unscoped reports, exports and budget/AI summaries before enabling business workspaces: new business records must not silently enter a personal total. Add explicit filters/default personal scope for mapped users, while preserving an unmistakably labeled legacy/unassigned view. A mixed-currency total cannot be shown as one currency.

Once consumers use the new engine, deprecate the heuristic in a separately reviewed change. Optional AI may explain a supplied engine result with source IDs; it is not a dependency for any milestone and does not generate the cash figures.

## Acceptance examples and verification

All examples are fictional THB, as of October 10, 2026, through October 31. Initial opening anchors are start-of-day October 1, matching the design fixtures. Production tests should port the example inputs and expected outcomes, rather than call the prototype model as an oracle.

| Case | Required result |
| --- | --- |
| Mina base | Cash today **47,000**; remaining receipts **8,000**; costs **6,100**; closing **48,900**; buffer **5,000**; closing headroom **43,900**. |
| Mina buys laptop for 45,000 on October 12 | First below buffer **October 12**; lowest cash **−500 on October 16**; closing cash **3,900**. A positive close must not conceal the earlier negative cash. |
| Business X base | Cash today **89,000**; remaining receipt **90,000**; costs **81,000**; closing **98,000**; buffer **10,000**; headroom **88,000**. |
| Client receipt moves to November 5 | October closing cash **8,000**, buffer gap **2,000** beginning October 26; **no negative October cash**. November receipt is still visible. |
| Late receipt + equipment moves to November 2 | October close **20,000**, headroom **10,000**; later equipment/receipt both remain visible. |
| Mina utilities recorded/matched on October 10 | Cash today falls to **45,800**; remaining cost falls by **1,200**; closing stays **48,900**. |
| Contractor 65,000 recorded/matched on October 10 | Business cash today becomes **24,000**; future contractor amount is removed once; closing stays **98,000**. |
| Client partial receipt 30,000 on October 10 | Cash today **119,000**; outstanding receipt **60,000**; closing stays **98,000**. |

Required tests extend beyond those examples:

- **Engine:** exact decimal limits, anchors/as-of boundaries, future-dated actual review, unresolved overdue commitments, same-day movements, recurrence windows/leap/month ends/weekend shifts, transfer scopes, partial/multiple matches, over-allocation, corrections/refunds, and scenarios that preserve base inputs.
- **Storage/API:** owner/workspace/account/source authorization, foreign-currency rejection, linked-object checks, atomic posting + matching, stale revision, idempotent retry and concurrent settlement. Test actual PostgreSQL locking/constraints, not only SQLite emulation. Validate SQLite and PostgreSQL migration/backfill/replay; preserve MySQL compatibility and run affected MySQL migration/contracts before claiming this feature supported there.
- **All writers:** ordinary API, CSV, MCP and LINE writes/undo produce the same revisions, audit effects, outstanding values and cache invalidation. Matched-record edits/deletion cannot bypass correction rules. Unassigned legacy records cannot disappear from review.
- **UI:** 320/390px through desktop, keyboard dialogs/focus return, agenda alternative, explicit currency/period, actual/planned line styles, accessible values, no console/hydration errors, saved-draft retention, stale-base warnings, retry inputs, and workspace-switch/logout cache isolation. Use real API results, not a mocked prototype-only flow.
- **Comprehension:** run a personal and small-business task session. The user should distinguish cash today, expected receipt, unpaid amount and buffer gap, and find the record behind a low-cash day without coaching. Record confusion and revise labels; existing owner visual acceptance does not prove this outcome.
- **Regression:** current auth/public pages, dashboard bundle/customization, budgets, plans, goals, debts, trips, exports, MCP and LINE behavior affected by shared writers. New requirements do not silently change legacy goal contributions or task completion.

Save per-milestone evidence under a dated `docs/validation/` directory: exact branch/revision, migration inventory/checks, tested database engines, commands/results, fixture assertions, API/browser evidence, and unverified limits. Run targeted checks during implementation, then the relevant full regression suite, frontend type check/build and end-to-end task checks at each release gate. No implementation suites were rerun merely to write this plan.

## Migration and rollout sequence

1. **Prepare the implementation checkout.** Reconcile integration rules and latest remote state when implementation begins. Use an isolated checkout if necessary; never stash, overwrite or carry unrelated dirty LINE/public-design changes implicitly. Review which pending changes the feature actually depends on.
2. **Expand safely.** Add new tables/nullable fields and indexes, then deploy compatibility-capable code with a proposed `CASHFLOW_WORKSPACES_ENABLED=false` gate. Gate routes, UI and writers coherently; disabling the gate must not bypass ownership/correction integrity for data already created. Make schema migrations one controlled operation rather than simultaneous startup races.
3. **Rehearse reviewed backfill.** Use disposable/authorized copied data, preserve record IDs and ownership, and check counts/amounts per confirmed currency/account. Ownerless rows need an explicit disposition; never assign them to the current user by guess. Historical preference currency and Plan's default USD are not proof of transaction currency. Ambiguous rows remain in review. Do not require a non-null legacy field until migration completeness is proven.
4. **Staging acceptance.** Verify M0–M1 through real API/UI, genuine PostgreSQL migration/concurrency tests, rollback rehearsal and data isolation. Verify health of the target application at that time; a working public landing does not establish backend readiness.
5. **Controlled owner pilot.** With release authorization, enable only the reviewed workspace(s), show opening provenance/completeness, and gather the personal/business task evidence. Keep new-data backups/export/recovery steps concrete and tested. Monitor calculation failures, unresolved-input counts and confirmation conflicts without logging private financial payloads.
6. **Broaden after the gate.** Enable wider use only after correctness and comprehension checks. Update everyday/developer docs and public claims with the exact available scope. The separate landing deployment is not automatically part of an app release.

Rollback is application/feature exposure rollback, not destructive migration downgrade. Preserve new cash records, settlements and audit history; use compatible code or read-only correction review until a verified fix. Do not return to code that ignores matching integrity, delete finance tables, or lose newly entered business data to make the old screen work.

## Decisions to revisit at the named gate

| Decision | Working default | Revisit when |
| --- | --- | --- |
| Release audience | One owner managing personal and small-business cash | Before team/household invitation scope. |
| Currency/account breadth | THB/USD cash/bank accounts, one currency per workspace | Before FX, card-liability or investment-cash integration. |
| Historical onboarding | Reviewed mapping; unresolved records remain visible | M0 inventory reveals unsupported legacy cases. |
| Hosted versus self-hosted | Same feature set; PostgreSQL hosted pilot and SQLite local validation | Before managed-service provisioning/support/billing promises. |
| Channel order | Finish LINE before a second chat platform | Real-channel pilot shows actual demand and platform feasibility. |
| Light theme | Preserve accepted dark identity | Owner selects one of the saved light-theme directions. |

## References and next concrete package

The [October 1 reference board](../design/2026-10-01-cashflow-workspaces/references.md) separates observed vendor patterns from proposed Aegis adaptations: dated/scheduled balances from Actual Budget, calendar/scenario connections from PocketSmith, short-horizon business planning from Float, and due-versus-expected dates from Xero. These are design references, not evidence of Aegis implementation or competitor performance. No new platform availability research was needed to write this source-based plan; connection work must recheck official sources at M4.

Apply the [accepted Aegis design contract](../design/012-aegis-design-spec.md) throughout. The self-improvement/design retrieval rules informed the separation of proposal, local prototype verification, accepted public identity and deployed landing. This planning task adds no new acceptance claim or reusable algorithm lesson.

**Current handoff:** M0–M3 and M4.1–M4.2 are implemented, locally verified and independently reviewed. [The current audit](../validation/2026-10-02-all-m/completion-audit.md) links actual API/browser, migration/restore, concurrency and fresh container evidence. The original starting observations above and first-release checkpoint below are historical. Real M4.3 channel delivery/correction, M4.4 decision from actual use, owner comprehension, reviewed Git/remote CI and rollout remain open. No customer-data inventory or MySQL feature certification is implied. The transient preview stopped after interruption and is not currently claimed available; its pilot data is preserved.

## First-release verification checkpoint — October 2, 2026

The owner subsequently said “Let go for fierst release,” authorizing the M0–M1 build. Additive migrations and legacy-row preservation were rehearsed on disposable SQLite and PostgreSQL databases. The actual authenticated app now exercises both fictional stories. Existing LINE/public-design work was preserved. Cash-aware legacy mutations fail closed rather than editing matched records; unassigned legacy writers remain available, with cash-workspace linking reserved for later adapters. The new forecast does not claim MySQL support. A separate local PostgreSQL backup/restore comparison verified cash records and base forecasts. The original customer task-session and production rollout gates remain open.
