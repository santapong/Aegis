# Aegis: explain the plan, capture it in chat

Research/check date: 2026-09-28, Asia/Bangkok. User requested reusable skills, more chart ideas, and an opinion on chat integrations after accepting the public frontend design.

**Recommendation:** build an explainable dated cash forecast first, then complete a small LINE capture pilot. Keep the accepted visual baseline. WhatsApp is a candidate second channel; Instagram is lower priority. These are proposals, not shipped features or authorization to connect production channels.

An [interactive chart concept board](index.html) uses the existing fictional Business X and personal examples. It is separate from the application. Its calculations illustrate the proposed distinction between cash and money remaining after reserves; it does not replace the app's forecast or write financial records.

## What is already present

Source inspected in the dirty local checkout, base `e2c4a9c`, branch `agent/comet-asset-prompt`. No remote fetch or real-channel verification was performed.

| Existing source | Observed behavior | Implication |
| --- | --- | --- |
| `frontend/src/components/charts/` | Cash-flow lines, income/expense trends, spending pie, category and budget comparison bars | Extend useful charts before adding another library or a dense chart gallery. |
| `backend/app/routers/dashboard.py`, `get_cashflow_forecast` | Current balance is all recorded income minus expenses. Future monthly values average grouped records from the last 90 days, plus 30% of active monthly recurring income/expense plans. | A heuristic trend is different from cash available in a selected account on a particular day. It lacks the explicit dated reconciliation needed for the proposed chart. History and recurring plans may overlap; do not present the blend as an exact forecast. |
| `frontend/src/app/demo/scenarios.ts` | Fictional opening amount, recorded entries, dated plans, reserve intention, delayed-income scenario | Reuse its understandable stories; keep this illustrative model distinct from the production endpoint. |
| `backend/app/services/line_finance.py` and worker, router, models, settings component | Account linking, THB parsing, draft/confirm/cancel/undo, month summary, event deduplication and persistent delivery | Existing work should be completed and validated before building the same flow for four channels. |
| `docs/line-finance.md`, checkpoint 2026-09-23 | Reports local tests; explicitly says no real finance-channel deployment/connection | Code presence and historical tests are not rollout evidence. Preserve this unrelated in-progress work. |

## Reference research

Primary product/docs sources inspected on the research date. Vendor descriptions are design references, not independently tested product performance. Actual's report chart and PocketSmith's public page were opened in the visible browser; no paid accounts or competitor user data were accessed. Float was text/document research. Some PocketSmith illustration content did not render in the initial viewport; no claim of a full authenticated UI inspection.

| Source | Observed pattern | Aegis adaptation |
| --- | --- | --- |
| [PocketSmith cash-flow forecasts](https://www.pocketsmith.com/tour/cash-flow-forecasts/) | Connects scheduled budgets, a calendar, and projected daily balances | Date-based plans should drive inspectable changes. Use a bounded 30/90-day horizon before making long-range precision claims. |
| [Float scenario planning](https://floatapp.com/blog/cash-flow-scenarios-big-decisions) | Compares a base with changes such as delayed receipts; evaluates low-cash timing against a floor | “What if this payment is late?” with unchanged base data, visible altered assumption, lowest date, and cash-buffer gap. Do not import its accounting/payroll integrations as Aegis capabilities. |
| [Actual reports](https://actualbudget.org/docs/reports/) | Cash balance shown with separate income/expense movements; explicit account scope; daily calendar | Separate a stock (balance) from movements (income/expense), and connect both to dates and records. |
| [Actual Sankey report](https://actualbudget.org/docs/experimental/sankey-report/) | Money flows through grouped accounts/categories, with spent/budgeted modes; documentation labels it experimental | An optional month-review diagram for “where did money go?” Use a few categories and a table alternative. It does not explain when cash runs low. |

The waterfall below is our proposed accounting-identity explanation, not a claim that a reference product has that exact design. All reference marks, testimonials, prices, screenshots, and feature claims remain out of Aegis's product UI.

## Chart priorities

| Priority | Chart and reader question | Behavior | Done when |
| --- | --- | --- | --- |
| 1 | **Dated cash forecast:** “Will the plan fit before the next income?” | Actual history solid; planned values dashed; clear as-of boundary. Cash vs after-reserve view; optional comparison of one changed assumption. | Every movement opens its source entry; lowest amount/date and buffer gap reconcile with the daily table. |
| 1 | **Cash-flow waterfall:** “Why did I end with this amount?” | Opening + income − expenses = closing cash. Reserve allocation appears separately, followed by remaining unallocated money. | Every subtotal reconciles to records; no assumption that saved money left total cash. |
| 2 | **Cash calendar:** “What comes in or goes out next week?” | Dated income/bills/reserve intentions; day details and compact phone agenda. | Changing a scenario date updates calendar, chart, table, and explanation together without altering actual records. |
| 2 | **Budget bars:** “How much is used, planned, and left?” | Actual spending plus remaining planned spending against limit; values and over-budget text. Extend existing bars. | Matched paid plans cannot be counted again; totals agree with transaction filters. |
| 3 | **Sankey review:** “Where did this month's money go?” | Income sources → money available → broad spending groups and retained cash; optional drill-down. | Flow totals conserve money; transfers/reserves do not masquerade as expenses, with a readable table and explicit treatment of refunds/negative flows. |

Do not add all five to the first screen. Lead with the user's answer and forecast. Reveal explanation, calendar, and category detail as needed. Reuse Recharts where suitable; prototype does not require choosing a new package.

## One clear story, two different amounts

For Business X at 10 October: ฿60,000 opening + ฿50,000 recorded income − ฿21,000 recorded expenses = ฿89,000 sample cash.

| October projection | Expected client payment | Planned costs | Closing cash | Reserve intention | After reserve |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original | ฿90,000 | ฿81,000 | ฿98,000 | ฿10,000 | ฿88,000 |
| Payment delayed to 5 Nov | ฿0 in October | ฿81,000 | ฿8,000 | ฿10,000 | -฿2,000 |

Suggested explanation: **“If the client pays on 5 November, October ends with ฿8,000. That is ฿2,000 below your ฿10,000 reserve goal. The equipment purchase on 26 October is the first event that takes cash below that buffer.”** This describes the fictional assumptions, not a bank overdraft or financial advice.

Personal example: ฿47,000 sample cash + ฿8,000 expected income − ฿6,100 costs = ฿48,900; reserving ฿5,000 leaves ฿43,900. Delayed income means ฿40,900 cash and ฿35,900 after reserve.

Generate the first explanation deterministically from the same calculation, even with AI disabled. Optional AI may explain those sourced values later; it must not invent amounts, unsupported causes, or certainty.

## Required calculation contract before production charts

1. **Scope:** selected account(s), currency, timezone, as-of date, period, and explicit opening amount/source. Without an opening amount, call the result net recorded movement rather than bank balance. Exclude future-dated actuals from today's total.
2. **Events:** each planned occurrence has a stable identity, date, amount, kind, status, and source link. Define recurrence boundaries and month-end dates. Use precise money values and deterministic date ordering.
3. **Reconciliation:** link a recorded payment to its planned occurrence so only the actual replaces it. Handle partial payments, cancellation, overdue/unmatched plans, and edits explicitly. A completed plan alone is not proof of payment.
4. **Transfers/reserves:** transfers inside the selected account set net to zero. Allocation to a goal lowers unallocated money, not aggregate cash. An actual transfer outside the selected scope affects that scope once. Reserve targets/allocations must not double count.
5. **Estimates:** explicit scheduled plans first. Historical estimates are opt-in, labeled, and scoped to avoid duplicate scheduled spending. Do not silently retain the current 30% recurring-plan blend in an exact dated projection.
6. **Scenarios:** derived changes over the same baseline; show original/new dates and differences. Reset cannot modify the ledger. Late income stays visible beyond this period instead of becoming permanently lost revenue.
7. **Output:** daily balances, dated contributing events, summaries, reserve/unallocated values, first buffer-crossing date, assumptions, missing-data flags, and an accessible table all come from one engine.

Acceptance fixtures should cover the two examples, no history, missing opening amount, insufficient funds vs reserve gap, payment matching/partial payment, same-day events, month boundaries, recurrence, cancellation, internal transfer, refunds, currency isolation, and scenario reset. Customer-facing explanations must distinguish “below your selected buffer” from “negative cash.”

## Chat integrations: worth doing, with a narrow first job

My product recommendation is **chat for quick capture and concise review; the Aegis page for detailed planning**. Example: user sends `จ่าย 65 กาแฟ` → sees a ฿65 draft with date/category → confirms → recorded once → can undo → opens the affected budget/plan. This flow reduces entry friction without asking chat to become the entire finance workspace.

| Channel | Recommendation | Evidence and constraints |
| --- | --- | --- |
| **LINE** | First pilot for the proposed Thailand-first audience; reuse existing local work. | LINE Official Account messages reach a registered webhook. Signatures must be verified. [Official receiving guide](https://developers.line.biz/en/docs/messaging-api/receiving-messages/). Current Aegis implementation is private-chat, THB, text-only; no OCR/AI or real channel verified. |
| **WhatsApp** | Second if target users request it. Start with inbound capture and replies. | Business Platform policy allows free-form replies during the 24-hour window opened/reset by user messages; outside it, approved templates are required. [Official policy](https://whatsappbusiness.com/policy/). Delivered-message pricing varies by market/category; service messages are currently free. [Official pricing](https://whatsappbusiness.com/products/platform-pricing/). Recheck during implementation; no fixed cost estimate here. |
| **Telegram** | Optional self-hosting/developer channel if there is demand. | Official API supports polling or webhooks; polling could suit a local installation without a public inbound webhook. [Bots FAQ](https://core.telegram.org/bots/faq). This is an architectural suitability inference, not evidence of Aegis support. |
| **Instagram** | Later, primarily onboarding/support or a bounded capture entry point for creators. | Meta's Send API targets the connected professional account; the recipient must have messaged it first, and group messaging is unsupported. [Meta's official Postman collection](https://www.postman.com/meta/instagram/folder/uxudqu0/send-api). This is not access to a consumer's whole private inbox. Ordinary users could message Aegis's professional account; the account restriction is on the integration side. |

Meta's primary developer URL returned HTTP 429 during research; its official Postman collection supplied the Instagram constraints. No approval/production eligibility test was performed. Policy and pricing are volatile and must be rechecked before implementation.

### A specific LINE cost finding

Aegis's queued worker currently sends via `/v2/bot/message/push`, even when the message is conversationally a reply. LINE counts push messages toward plan allowances; its reply endpoint is not counted. [Official pricing](https://developers.line.biz/en/docs/messaging-api/pricing/).

Therefore, **do not promise unlimited free bot replies**. Measure real expected message volume and response latency. Consider a fast reply-token path only after verifying token lifetime, failure handling, and duplicate prevention; durable push delivery is a deliberate reliability/cost tradeoff, not automatically a bug. The existing retry/outbox safeguards must survive any change.

### Shared implementation shape (proposal)

Channel adapter → authenticated linked identity → normalized command → finance draft → explicit confirmation → one ledger mutation → outbox response. Keep the core independent of provider formatting, webhook identifiers, and messaging windows. Namespace events by channel/provider account; duplicate delivery must not create duplicate entries.

Preserve linking ownership, private-chat scope, cancellation/undo, currency clarity, disconnect, secret isolation, minimal retained raw content, and reliable retries. Inbound message text is data, never authority to override account permissions or confirmation. Reminders require user opt-in, timezone/quiet hours, and channel-policy handling. Receipt images/voice are a later extraction feature: show uncertain fields and require review before recording.

Self-hosted Aegis should be usable without any chat channel. Optional connectors need operator configuration; hosted service could manage its own official channels once ready. Self-hosting Aegis does not make LINE/Meta/Telegram infrastructure self-hosted. Keep account/data boundaries clear.

## Suggested delivery order

1. Implement the dated calculation contract and explanatory cash/reserve labels with tests.
2. Add forecast + waterfall in the accepted identity, then calendar/budget drill-downs. Check comprehension with example tasks, not only rendering.
3. Complete a real LINE pilot: link → draft → confirm → same ledger/chart change → undo, plus duplicate/unlink/failure cases and message-cost observation. This needs separately authorized deployment/account connection.
4. Choose WhatsApp or Telegram from actual user demand; reuse the core. Consider Instagram and Sankey later.

This research changes no app code, ledger, production configuration, credentials, or messaging accounts. The standalone board is a review aid; the accepted app remains at its existing routes.
