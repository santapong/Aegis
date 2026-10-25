# Aegis first cash-planning release

October 2, 2026 · **implemented and locally verified; owner pilot**. This is the M0–M1 release from the [implementation plan](../plans/2026-10-02-cashflow-implementation.md). It is not a production deployment or a new version tag. The public landing remains a separate release.

This guide retains the M0–M1 scope and its dated checks. Later October 2 work adds [M2 everyday review](2026-10-02-m2-everyday-cash-review.md), [M3 business review](2026-10-02-m3-business-cash-review.md) and [M4 local LINE capture](2026-10-02-m4-line-capture.md). Read the [current completion audit](../validation/2026-10-02-all-m/completion-audit.md) for present implementation and open release gates.

One owner can manage personal and business cash in separate workspaces, starting from reviewed cash balances. The main question is: **Will my upcoming money and bills fit on these dates?** The app keeps the accepted original Aegis icon, Syne/Inter typography, charcoal, warm text, amber actions and restrained teal.

## Try the local pilot

Open **http://127.0.0.1:3106/cashflow**. The visible browser is signed into the fictional local preview account. Choose Mina or Business X, set **Plan through** to October 31, 2026, then explore Overview, Money calendar, Scenarios, Review & match and Accounts.

Only the isolated local PostgreSQL database holds this preview. No customer data was copied or connected. Preview actuals use October 1 so they can be recorded on October 2. The automated acceptance stories retain their original October 1/5/8/9 actual dates and October 10 as-of date. Both use the same production cash engine and reconcile to the same base amounts.

The local account, setup-check workspace, payments, corrections and transfer checks are fictional. The seed script names the disposable account explicitly and requires `AEGIS_ALLOW_DISPOSABLE_CASH_SEED=yes`. Confirm that port 8000 belongs to the isolated test service before seeding. Do not use its local test password for any real installation. Saved scenarios and inputs persist in the database; unsaved form drafts are held within the cash-workspace screen. Selecting a different target account or record resets that form to its own defaults. A reload resets the selected view/period to defaults, but does not remove saved data.

## Included workflows

- Personal/business workspaces; THB or USD; one fixed currency per workspace; manually maintained cash/bank accounts.
- Checked start-of-day balances with date and provenance. Cash remains unknown when an included account has no valid opening amount.
- Recorded income/expenses, daily history, dated forecast up to 180 days, source table, calendar and distinct negative-cash/buffer warnings.
- One-time, weekly and monthly commitments; month-end/leap-year handling; weekend behavior; per-occurrence date changes/cancellation; series cancellation via API.
- Named date/cost scenarios, later obligations outside the period, and an explicit refresh when the base changes. Scenarios do not post money or overwrite base plans.
- Full/partial matching with a before/after preview, exact money, idempotent retry, stale-revision checks, concurrent confirmation protection, unmatch and separate recorded-entry reversal.
- Recording same-currency transfers within or between the owner's workspaces, one shared identity, atomic revisions/audit for both endpoints. This records an actual transfer and never initiates a payment. A mistaken transfer can be counter-recorded with an explicit reference; automatic transfer undo is not included.
- Reviewed historical assignment with confirmed account/currency, preserved transaction IDs and links, and explicit exclusion review. New/edited unassigned records invalidate exclusion.
- A practical in-app guide at `/docs/guides/cash-planning`.

## Money and date contract

New amounts use decimal strings, Python Decimal and database Numeric(12,2). More than two decimal places is rejected. Chart conversion happens only for display. Supported calendar dates are 1900–2100. Each workspace has an IANA timezone; dates are local calendar dates. An opening balance is start-of-day, so actual movements on that date count afterwards. A later checked balance replaces the earlier starting point for the affected account.

Cash today includes actuals since the latest valid anchor through the as-of date. Future recorded rows produce a review warning and do not become cash today or promised future income. Remaining commitments after the as-of date drive future daily closes; overdue or same-day unpaid commitments are unresolved inputs. All values are end-of-day; receipt timing within a day is unknown.

A match reduces outstanding planned money; its cash effect is zero. Excess recorded money still affects cash even when it cannot be allocated. Undoing a match and reversing a cash entry are separate actions. Reversal adds the opposite record on the original date, retaining both entries. An actual refund belongs on its real date and does not silently reopen a paid commitment.

Unassigned records are the compatibility scope of legacy dashboard, reports, budgets, trips, CSV intake, exports, MCP and LINE summaries. Cash-assigned records cannot be edited/deleted through those legacy writers. LINE undo refuses an adopted cash record. Existing savings, debt and investment concepts remain separate; their values are not automatically added to cash.

## Self-host setup and rollout

1. Take a database backup and rehearse restoration on a separate database. Inventory historical ownership, currencies, amounts, plan/trip/tag links and any ambiguous rows. The saved rehearsal uses fictional data, not the target production database.
2. Deploy the compatible backend/frontend together. Run **one controlled** `alembic upgrade head` with the backend's database environment. The cash migration `a1002cf00001` depends on the existing LINE revision `a0923f1a0001`; both must be present. Do not run simultaneous migration/startup writers.
3. Keep `CASHFLOW_WORKSPACES_ENABLED=false` until the migration and installation checks pass. Cash endpoints return a clear unavailable response while disabled; ownership/correction restrictions on previously assigned records remain active.
4. Enable `CASHFLOW_WORKSPACES_ENABLED=true` for the intended owner pilot, restart that backend, and exercise workspace → account → opening amount → recorded movement → forecast → payment match. The same application supports self-hosting and a future managed service; hosted billing/provisioning are not delivered here.
5. Review ambiguous historical records rather than backfilling them by currency preference or guessing an owner. Obtain the owner's feedback on the two example tasks before broadening availability.

The locally created preview services are `aegis-cashflow-api.service` (127.0.0.1:8000) and `aegis-cashflow-web-isolated.service` (127.0.0.1:3106). The task's PostgreSQL container binds only 127.0.0.1:5548. Recheck their live state before using those addresses later. These local services do not establish public hosting.

For development and production builds in one checkout, use distinct Next output folders: `AEGIS_DIST_DIR=.next-cashflow-preview` for this preview and `.next-cashflow-release` for the verified build. Default deployments still use `.next`. Both custom folders are ignored by Git.

Rollback means disabling feature exposure or returning to compatible code while retaining cash data/audit. The migration refuses a downgrade once a cash workspace exists. The tested empty-schema downgrade is a rehearsal, not a production rollback procedure. Never downgrade away financial data to restore an old screen.

## API contract

Authenticated endpoints live under `/api/cash`. The server derives the owner from authentication; callers cannot supply authorization through a user ID.

| Purpose | Endpoint |
| --- | --- |
| List/create workspaces | `GET/POST /workspaces` |
| Load workspace inputs/revision | `GET /workspaces/{wid}` |
| Daily forecast | `GET /forecast?workspace_id=…&as_of=…&end=…` |
| Scope/comparison | Repeated `account_ids` and optional `scenario_id` on forecast |
| Add account/opening/actual | `POST /workspaces/{wid}/accounts`, `/anchors`, `/movements` |
| Correct actual | `POST /workspaces/{wid}/movements/{id}/reverse` |
| Plan/edit/cancel | `POST /workspaces/{wid}/commitments`, `/occurrences/{id}`, `/commitments/{id}/cancel` |
| Match/reverse allocation | `POST /workspaces/{wid}/settlements/preview`, `/settlements`, `/settlements/{id}/reverse` |
| Transfer/buffer/scenario | `POST /workspaces/{wid}/transfers`, `/buffer`, `/scenarios`, `/scenarios/{id}/refresh` |
| Review old records | `GET /legacy`; `POST /workspaces/{wid}/legacy/adopt` or `/legacy/exclude` |

Workspace creation needs a unique `request_key`. Other mutations need the latest workspace `revision` and a unique `request_key`. An identical retry returns its original result. Reusing a key with different input or posting with a stale revision returns 409 and requires review. Cross-workspace transfers also require `to_workspace_revision` and authorized, active, same-currency endpoints. The API returns both updated workspace revisions.

Recording a payment with `occurrence_id` creates the actual and its full allocation atomically; UI matching of an existing actual uses preview then confirmation. All allocations pass through the same service. Forecast responses include `dated-cash-v1`, exact strings, currency/timezone, scope/revision, completeness warnings, history, daily sources, minima, buffer/negative dates and later/unresolved items.

## Verification and limits

See [saved validation and reproduction](../validation/2026-10-02-first-release/README.md) for exact checks and evidence. Genuine PostgreSQL fixtures and concurrent confirmation now run separately in CI; the existing generic suite still uses SQLite. The MCP SDK is installed for local regression and included in test dependencies so those tests are not silently skipped in future CI.

Recurring rows are materialized to December 31 five years after the schedule start; a forecast beyond that horizon is flagged. Interval/split rules, CSV-to-workspace review, goals/installments, invoice/bill entities, 13-week/variance views, bank feeds, workspace chat linking and real LINE delivery remain M2–M4. No payroll, tax, FX aggregation, automatic payments, team access or light-theme acceptance is claimed. MySQL, public deployment, independent customer comprehension and production backup/monitoring are not verified by this local release.

Syne's retained WOFF2 is reused from the existing landing asset; the original mark is unchanged. No competitor artwork or new paid assets were added.
