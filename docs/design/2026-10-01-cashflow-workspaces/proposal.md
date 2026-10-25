# Aegis: personal and business cash planning

Proposal dated October 1, 2026, Asia/Bangkok. Requested scope: research and design additional Aegis features for individual and business cash flow. **This is a product design and local interactive prototype, not production feature delivery or a new deployment.**

Follow-up: the [October 2 implementation plan](../../plans/2026-10-02-cashflow-implementation.md) defines the first release, work packages, data/migration contracts and verification gates. It is planning evidence, not completed implementation or release approval.

## Recommended product direction

Build one explainable cash-planning engine with separate personal and business workspaces. Lead with “Will the dates and amounts in this plan fit?” The personal workspace emphasizes bills, paydays, goals and purchases; the business workspace emphasizes expected receipts, supplier bills and low-cash weeks. Start with an individual or owner-run small business before multi-company finance teams.

Keep Aegis's accepted original icon, Syne/Inter, charcoal surfaces, amber actions and restrained teal. The deployed landing remains the public introduction. This new workspace prototype carries that identity into tasks and records. Light-theme concepts remain unselected; this task does not reopen their selection.

[Open the prototype](http://127.0.0.1:3105/). It uses fictional Mina and Business X October stories, locally retained licensed fonts and no application API. Each workspace keeps its scenario, draft fields, date selection, and sample match separately while the page is open. Reload resets them. The research and observations are in [references.md](references.md).

## Feature design

| Priority | Feature | Individual's task | Business owner's task | Proposed behavior |
| --- | --- | --- | --- | --- |
| First | **Cash accounts and opening balances** | Bring spending cash into one clear plan. | Know which operating cash is available. | Dated opening amount, currency, scope and last-reviewed date. Separate bank/current balances from unverified imported amounts. |
| First | **Daily cash forecast** | See whether bills fit before payday. | Identify cash timing gaps before supplier costs. | Actual history solid, plans dashed, as-of boundary, minimum cash/date and the selected buffer. Every point has a daily table and contributing records. |
| First | **Commitments calendar** | Bills, subscriptions, income and debt-payment dates. | Receivables and payable dates with expected timing. | Calendar on desktop, date details/agenda on small screens. Recurring occurrences have their own identities; overdue items need an expected date or explicit unresolved flag. |
| First | **Scenario comparisons** | Test a purchase or delayed freelance income. | Delay a receipt, move equipment spending or test a new cost. | Base records unchanged, visible changed assumptions, same starting cash. Out-of-period movements stay visible. Switching back restores the base view. |
| First | **Review and match** | Match a recorded bill payment to its plan. | Match partial receipts/payments to an invoice/bill. | Review amount/date/account, confirm, reduce outstanding once, leave a change trail. Imports are deduplicated before posting. |
| Next | **Goal and commitment headroom** | Protect a chosen buffer and savings contributions. | Protect an operating reserve or entered tax/payroll commitment. | Distinguish cash held, planned cost, reserve allocation and cash above the reserve. Show conditional headroom; do not promise a “safe to spend” amount. No automatic tax/payroll calculation. |
| Next | **Receivables and bills** | Optional for a freelancer workspace. | Track who owes what, partial settlements and overdue items. | Document reference, counterparty, due date, expected cash date, remaining amount, source link and reviewed status. No tax-invoice issuance or payment execution in the first release. |
| Next | **13-week business plan** | Optional longer view for irregular income. | Review low-cash weeks and near-term commitments. | Roll the same dated engine into weekly summaries. Preserve each week's minimum as well as its closing cash so aggregation cannot hide a within-week gap. |
| Next | **Forecast versus actual review** | Learn which costs or dates changed. | Explain variance to an owner/accountant. | Save forecast snapshots and compare observed receipts/payments with the original expectations. Separate timing, amount, missing and newly added items. |
| Later | **Capture and connections** | Enter a quick expense through LINE or a reviewed import. | Receive records from accounting/CSV into a review queue. | Linked workspace/account, draft confirmation, duplicate handling, undo, visible sync freshness and a manual fallback. Optional AI explains engine values with source links. |

Team roles (owner/editor/viewer), shared household permissions, receipt parsing and accounting connectors are later extensions after ownership and data correctness. Avoid adding ten analytics charts to the first screen. The daily forecast answers timing; a cash bridge explains the total; budget bars explain category use; an optional Sankey is a retrospective drill-down.

## Five designed surfaces

1. **Overview:** cash today, closing cash, lowest cash/date, and position against the selected buffer. The main forecast connects the question with the next movement and a deterministic explanation. Receivable/bill details expose their sources. No risk score or assumed growth.
2. **Money calendar:** inspect a day's recorded/planned entries and closing cash. The current base/scenario selection is visible. Due dates remain in business entry details while the calendar uses the expected cash date.
3. **Scenarios:** changed receipt date, one-off amount/date, and business equipment deferral. Presets demonstrate useful choices. Form drafts survive view/workspace changes. A chart and numbers compare the same base records.
4. **Review & match:** inspect an unposted fictional imported payment, the candidate planned occurrence and before/after values. Confirming records it once and removes the matching future amount. The sample can be undone. Confirmation in this board only changes the browser example.
5. **Feature plan:** proposed build order, research patterns, product boundaries and direct reference links. A prototype control does not imply a shipped backend capability.

## Concrete examples and decisions

The existing accepted story arithmetic is retained. All amounts below are fictional THB, for the scope explicitly shown.

| Example | Cash as of 10 Oct | Expected October receipts | Remaining October costs | Closing cash | Buffer | Closing above buffer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mina base | 47,000 | 8,000 | 6,100 | 48,900 | 5,000 | 43,900 |
| Mina buys a 45,000 laptop on 12 Oct | 47,000 | 8,000 | 51,100 | 3,900 | 5,000 | −1,100 |
| Business X base | 89,000 | 90,000 | 81,000 | 98,000 | 10,000 | 88,000 |
| Business X receipt moves to 5 Nov | 89,000 | 0 | 81,000 | 8,000 | 10,000 | −2,000 |
| Late receipt, equipment moves to 2 Nov | 89,000 | 0 | 69,000 | 20,000 | 10,000 | 10,000 |

Mina's laptop scenario first crosses her buffer on 12 Oct and reaches **−500 cash on 16 Oct**, before the expected freelance payment. Her positive month-end cash of 3,900 conceals that earlier gap. The screen must show both.

Business X's late receipt scenario retains **8,000 cash**, with a **2,000 gap against the buffer** beginning 26 Oct; it never goes below zero in October. Moving the equipment cost into November removes that October buffer gap but retains the later obligation. This is a comparison of entered assumptions, not a recommendation to delay a supplier or certainty that a client pays.

Matching the fictional 65,000 contractor payment on 10 Oct changes Business X's current cash from 89,000 to 24,000 and removes 65,000 from the future outflow. The base closes at 98,000 in both cases. Mina's 1,200 utilities match similarly moves current cash from 47,000 to 45,800 without changing her base closing 48,900. These examples demonstrate why actual and planned payments cannot be counted twice.

## Current implementation gaps, checked this turn

Local branch `agent/comet-asset-prompt`, base `e2c4a9c68d6304799ff5bc28b9fef7cf951f3878`, with pre-existing public design and LINE/backend work left intact. No remote fetch, commit, push, account connection, or production feature deployment occurred.

- `backend/app/routers/dashboard.py`, `get_cashflow_forecast`: current cash is recorded income minus expenses. Future monthly values use roughly 90 days of historical monthly totals and blend active monthly plan amounts at 30%. This is a heuristic trend, not an account-scoped dated cash engine. A supplied opening balance, plan occurrences, matching and actual currency isolation are required before treating it as a precise operational forecast.
- `backend/app/models/transaction.py`: records have `user_id`, `plan_id`, amount/type/category/date and recurring fields. The inspected model lacks `account_id`, `workspace_id` and transaction-level currency. `plan_id` alone does not identify a specific recurring occurrence.
- `backend/app/models/plan.py`: plans have dates, currency, recurrence/status and transaction relationships. A task marked completed must not become proof that cash moved.
- Savings and budget entities exist. Budgets are spending limits, not cash-flow events. Goal targets, allocations and real transfers need distinct treatment.
- Existing chart code in `frontend/src/components/charts/cashflow-chart.tsx` plots monthly projected balance/income/expenses. Reuse the chart library for implementation when suitable, with semantic names, scope and sources.
- `docs/line-finance.md` reports September 23 local LINE implementation/tests and explicitly no real-channel rollout. This design does not reverify its tests or deploy it. Preserve the existing draft/confirm/undo and event-deduplication work rather than rebuilding chat entry independently.

The production landing released earlier on October 1 remains separate. Source code presence and this local board do not establish working hosted subscriptions or business accounting.

## Proposed implementation sequence

| Milestone | Scope | Acceptance gate |
| --- | --- | --- |
| **M0: trusted cash inputs** | Workspace ownership, accounts, transaction currencies, dated opening/reconciliation records, paired transfer identity, migration review. | Personal/business isolation, currency isolation, no invented opening amount, transfers and import duplicates handled. Existing records get an explicit migration decision; do not silently reinterpret historical currency or allocate them to a business workspace. |
| **M1: dated cash plan** | Occurrences, actual matches, remaining planned amounts, deterministic daily forecast, calendar/table, buffer explanation, isolated scenarios. | Both story fixtures reconcile; earliest negative date differs from buffer breach; same-day end totals, recurrence boundaries, partial payments, cancellations, refunds and reset are verified. Existing heuristic remains explicitly labeled until replaced. |
| **M2: everyday use** | Recurring commitments, debt installments as entered costs, savings allocation/transfer distinctions, CSV review, alerts with sources. | No duplicate scheduled-and-estimated spending; drafts preserved; missing/stale data disclosed; mobile and keyboard tasks work. |
| **M3: business operations** | Manual/CSV receivables and bills, expected-versus-due dates, partial settlements, 13-week view, forecast snapshot review. | Invoice total never becomes cash until receipt; aging uses due date; an overdue item without an expected date is unresolved rather than silently treated as paid. Weekly close and minimum are both available. |
| **M4: connected workflow** | Complete a bounded LINE pilot, then reviewed accounting/receipt connectors and collaboration roles. | Workspace link, idempotency, permission tests, disconnect/undo, freshness indicators and real-channel checks. No payment initiation; sharing/connection authorization stays explicit. |

M0–M1 are the highest-value first implementation, because both audiences depend on them. The prototype verifies selected arithmetic and interactions; it is not evidence that these backend milestones are complete.

### Shared calculation contract for production

Use exact decimal/minor-unit money, an explicit account/currency/workspace scope, timezone and as-of date. Opening/reconciliation source must be known; missing inputs produce an incomplete forecast instead of a fabricated balance. Actual future-dated rows do not enter cash today and need review rather than silent reliance. Expand recurring plans into stable occurrences, define month-end/weekend behavior, exclude cancelled occurrences, and cap matching/flag overpayments. Partial settlements reduce only their matching occurrence. Uncertain receipts have explicit expectations; a confidence label is not a probability unless backed by data.

Transfers inside the chosen scope net to zero. Transfers out affect that scope once; mirrored legs must not become duplicate income/expense across combined accounts. Credit-card spending and later card settlement need a consistent account/liability model rather than charging cash twice. Owner draws/contributions cross personal/business scopes with paired provenance; they are not automatically operating revenue or supplier expense. A savings allocation protects cash; a real transfer follows its actual account boundaries. Amounts in different currencies are never summed without an explicit rate/date/source and conversion view.

Daily balances are end-of-day. Same-day inflows/outflows can conceal intraday shortages; make that limit visible. The minimum date, first negative cash date, first buffer breach, source events, calendar and explanation must share one calculation result. Estimate optional unplanned spending separately, with coverage windows and exclusions to avoid double counting scheduled categories. Save assumptions/version when comparing a forecast with actuals. AI may explain these sourced results but must not create the financial numbers or silently post records.

## Review and verification

Pure prototype calculation tests: `node --test docs/design/2026-10-01-cashflow-workspaces/model.test.mjs`. They cover baseline stories, low cash before a positive month end, late income, deferred costs, full/partial matching, unchanged source records, selected-account transfer effects, future actual exclusion, currency guards and invalid scenario input. These are prototype-model tests, not production API or migration coverage.

Browser evidence and reproduction are saved in `docs/validation/2026-10-01-cashflow-workspaces/README.md`. Finalize that record only after actual interaction checks. Business-model correctness, real integration delivery and customer comprehension need later implementation/UAT. Do not infer owner acceptance from this proposal.
