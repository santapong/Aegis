# M3 business cash operations

October 2, 2026 · Implementation contract under the user's request to finish all M0–M4. Independent review and release availability are separate evidence gates.

## Outcome and decisions

A business owner records money owed by a customer or to a supplier, reviews overdue amounts, records/matches partial payments, inspects the lowest day within each of thirteen weeks and compares an immutable saved forecast with reviewed cash. Creating a document never records income or expense.

| Decision | Chosen contract |
| --- | --- |
| Documents | Owner/business-workspace/account/currency scoped; counterparty, reference and immutable original amount; exactly one linked once-only commitment/occurrence |
| Existing plans | Optional explicit adoption of one active once-only plan with identical account, direction, full amount and expected date; retain its commitment/occurrence/settlement IDs and avoid a second plan. |
| Outstanding amount | Effective obligation after explicit credits, minus active shared settlements; no second document-total forecast stream |
| Date meanings | Due date drives aging; occurrence expected date drives cash. Unpaid past expectations require review. |
| Corrections | Positive entered credits with reason cannot reduce obligation below matched payments; cancellation removes unpaid projection but preserves actuals/history. Generic occurrence amount edits cannot bypass document adjustments. |
| Week boundaries | Workspace `week_start` (0 Monday through 6 Sunday, default Monday). Thirteen calendar weeks; the current first week may be partial from as-of. Weekly minima/date expose daily gaps even if weekly close is positive. |
| Snapshots | Immutable saved JSON containing exact forecast, full selected source state, dates, currency/timezone/week boundary, engine version, base revision and source digest |
| Comparison | Snapshot account scope and original end boundary; owner-selected reviewed-through date within saved period and not in the future. Show expected-versus-recorded cash at that date and reviewed remaining forecast. |
| Attribution | Matched baseline sources explain amount changes and timing/unpaid differences; newly matched sources and unmatched actuals remain separate; changed anchors are isolated with a counterfactual using the saved anchors. Retain an exact residual for incomplete provenance. |

## API and data

Add `CashBusinessDocument`, `CashDocumentAdjustment` and `CashForecastSnapshot`, plus `CashWorkspace.week_start`. Additive migration `a1002cf00003` follows M2. Populated M3 history or nondefault week boundaries refuse destructive downgrade; existing M0–M2 records retain IDs/values/links.

- `GET/POST /api/cash/workspaces/{wid}/business/documents`: list reviewed state / create a receivable or supplier bill.
- `POST .../business/documents/{id}`: review counterparty/reference/expected/due dates.
- `POST .../business/documents/{id}/credit` and `/cancel`: explicit reviewed adjustments with reason.
- `POST .../business/documents/{id}/settle`: either match an existing recorded movement or atomically record and match a new partial/full payment.
- Existing unmatch/reverse endpoints retain correction rules and audit.
- `GET .../business/weeks`: base daily engine aggregated into 13 calendar weeks, exact sources and daily drill-down.
- `GET/POST .../business/snapshots`: bounded saved list / create immutable snapshot for selected accounts and dates.
- `GET .../business/snapshots/{id}` and `/variance`: immutable detail / same-scope comparison through an explicit reviewed date.

All financial writes reuse `cashflow.mutate`, expected revisions, retry keys and owner/account checks. Snapshot creation is metadata and does not stale scenarios. Business routes reject personal workspaces. JSON amounts stay exact decimal strings. No tax, invoice issuance, payment initiation, interest or team permissions are introduced.

The frontend adds business-only **Business review** with documents, 13-week cash and saved-forecast tasks, using existing components/tokens and preserved workspace drafts. Explain original, credited, matched and remaining amounts; expose source dates and correction reasons. Snapshot creation and comparison keep their own frozen scope visible.

## Verification and rollback

Prove document creation has zero cash effect; partial/new/existing settlements reduce forecast once; retries/concurrency cannot overpay; currency/owner scopes fail closed; credits/cancel keep payment history; due/expected meanings survive date changes; generic edits cannot bypass credit history. Prove exact 13 weekly boundaries/minima/drill-down, missing-anchor behavior and later items. Save a snapshot, edit/pay/move/credit/reanchor, and prove its stored hash is unchanged while variance distinguishes supported sources and residual.

Run actual SQLite/PostgreSQL API and populated-migration checks, restore a fictional pilot backup, and exercise business tasks in the visible browser with keyboard/320–390px checks. Keep schema/history on application rollback or disable exposure; no production database or public deployment is modified during local implementation.
