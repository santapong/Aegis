# Business cash review — M3 local pilot

October 2, 2026. Receivables, supplier bills, partial payments, weekly cash and saved forecasts extend the existing single-owner cash pilot. Locally implemented and verified; independent review, real-channel work and production release remain separate gates. [Evidence](../validation/2026-10-02-all-m/README.md), [full workflow](../plans/2026-10-02-all-m-workflow.md).

In a business workspace, open **Business review**. Enter a customer receivable or supplier bill with its original amount, due date and expected payment date. Optionally link an existing once-only plan with the same account/direction/full amount/date; Aegis preserves its IDs and payments instead of forecasting it twice. Creating a document records no cash.

Use **Record or match a payment** for partial or full payments. New actuals change cash once; matching an existing record changes no cash. Credits require a reason and cannot reduce the obligation below paid money. Cancellation removes unpaid projection and preserves payments/history. Use due dates for lateness and expected dates for cash timing; review old unpaid expectations rather than treating them as available funds.

**13-week cash** uses the workspace's selected week start and the forecast's included accounts. The first week may be partial. Inspect the weekly minimum and its daily sources even when the weekly closing amount is positive. Later and unresolved plans remain visible.

**Saved forecast review** freezes dates, accounts, opening balances, source versions, assumptions and engine version. Compare recorded cash through a reviewed date within the saved period. Amount/timing/new/unmatched/transfer/opening-balance changes and any unexplained residual stay separate. Original and reviewed end forecasts still depend on future unpaid expectations.

Migration `a1002cf00003` is additive after M2 and defaults existing workspaces to Monday. Populated documents/snapshots or a reviewed nondefault week start prevent destructive downgrade. For application rollback, keep schema/history and disable cash exposure as needed. The task-local rehearsal and backup are not authorization or proof of a customer migration.

Verification workflow: run `scripts/verify-cashflow-workflow.py` with a fresh output directory and selected stages; inspect its logs and `result.json`. It records source hashes and each subprocess result, stops on failure/source drift and labels review/real-channel/CI/release pending. Migration and backup scripts separately guard dedicated fictional databases. This finite runner does not schedule background work or publish anything.
