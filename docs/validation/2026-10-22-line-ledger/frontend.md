# Account ledger frontend verification

Checked 22 October 2026, Asia/Bangkok. Source: isolated `aegis-line-ledger-20261022` worktree. These are local implementation checks, not owner acceptance, deployment, live LINE delivery, real receipts, or physical-phone testing.

## Implemented surfaces

- `/accounts`: THB bank/savings/cash/card creation, explicit Bangkok opening cutoff, signed opening review, exact tracked assets/card debt/net position, account-specific cutoff and reconciliation state, separate ledger LINE setup/link controls.
- `/review`: manual proposal creation, pending validation errors, exact version-bound edit/confirm/cancel, private evidence preview, canonical signed income/spending/account effects, retained original/reversal/replacement rows, reviewed financial corrections, audited classification changes.
- Statements: reviewed signed statement snapshots, pending holds, match candidates, explicit distinct-movement review, separate unposted proposals, exact tracked/arithmetic differences, history retrieval. Card statement debt uses negative posting signs; account setup separately uses positive amount owed.
- Authenticated links preserve an allowlisted local `/review?draft=...` through sign-in. `/transactions` checks cutover status before mounting legacy data hooks and redirects an onboarded ledger owner to canonical review, including when ledger activation is disabled.
- New requests retain cookie/legacy bearer compatibility, session-change rejection, structured errors, expected versions, and stable body-bound command keys. All money parsing/formatting uses decimal strings and `BigInt`; unsupported source currencies are not relabeled as THB without an explicit owner correction review.

## Executed visible browser flow

Used a visible Brave tab in the `💰 Aegis ledger` session, local frontend `localhost:3122`, and a disposable migrated local API at `127.0.0.1:8122`. The fixture user and all account names/balances/messages were fictional. No real LINE identity or provider credentials were configured.

1. Signed out `/accounts` redirected to sign-in with its return path; synthetic sign-in returned to Accounts.
2. Created fictional bank, savings, and card accounts. Account creation showed `Opening needed`, without inventing balances.
3. Reviewed the explicit cutoff `2026-10-20 23:59 Bangkok`, bank THB 20,000, savings THB 5,000, and card debt THB 2,000. Final opening confirmation required a review checkbox. Result: assets THB 25,000, liabilities THB 2,000, net THB 23,000.
4. Saved THB 150.25 expense proposal and returned to Accounts: totals remained THB 25,000 / 2,000 / 23,000. Edited it to THB 155.25; saved version advanced from 1 to 2.
5. Opened review and posted version 2 using keyboard activation after the explicit review checkbox. Pending count became zero; canonical spending effect was THB 155.25. Result: bank THB 19,844.75, assets THB 24,844.75, debt THB 2,000, net THB 22,844.75.
6. Imported a fictional bank statement for 21–22 October with one THB -155.25 posted row. Both exact differences were zero, but the row remained unresolved until matched. Selected the existing journal; status became reconciled without another financial posting.
7. Correction review rejected an absent effective date. Reviewed a dated reversal plus replacement at THB 140.25. Activity retained the original THB 155.25, a THB -155.25 spending reversal, and replacement THB 140.25. Result: bank THB 19,859.75, assets THB 24,859.75, debt THB 2,000, net THB 22,859.75.
8. Classification initially surfaced the server's missing-idempotency-key error without a mutation. After adding the required stable key, classification saved as `meals` with an audit reason and tags. The financial amounts were unchanged.
9. Created a separate THB 1 proposal, reviewed cancellation, and canceled it. It remained visibly canceled with no posting; the corrected balance totals were unchanged.
10. Signed out and opened the observed draft URL. Sign-in preserved and restored the complete `/review?draft=<observed-id>` URL and its posted outcome.

The original desktop viewport and an actual 320×844 viewport were inspected. At 320px, both account and review routes reported document width 320px and main content width 314px, with wrapping forms/actions and no horizontal page overflow. Mobile navigation closed on route selection. Native form controls and Enter activation worked in the exercised flow. Screenshots were inspected in the visible browser.

## Checks and recovered local issues

- `node scripts/verify-ledger-client.mjs`: passed exact satang/int64 boundaries, signed amounts, unsupported-currency labeling, allowlisted login returns, cookie/auth boundaries, version-only confirmation bodies, confirmation/classification keys, stable error handling, and rejection of session changes during a request.
- Initial production build succeeded with 43 routes. Subsequent shared-dependency symlink builds exposed Next internal relative-import resolution errors. Replacing only the temporary dependency symlink with a local copy of the already installed dependencies fixed this; no dependency versions, manifests, or lockfiles changed.
- Native `datetime-local` filling initially left the controlled value empty. The documented scoped `onInput` plus `onChange` handling restored the actual value and opening review. Applied the same handling to the new date fields.
- Running `tsc` while Next was regenerating the same type directory produced missing-generated-file diagnostics. Run the standalone type check after the build completes; this is a verification-order requirement, not a product type defect.
- Formatting CSS during the dev walkthrough produced Next CSS-HMR `removeChild` errors. A cold production preview is required for the final console check; this is separate from application financial logic.

## Limits

Real evidence retrieval, the actual LINE linking/postback/delivery flow, provider OCR, error paths requiring configured infrastructure, real mobile hardware, and all operation kinds through the browser are not established by this walkthrough. Backend tests provide separate money/concurrency evidence. Owner acceptance and production activation remain separate gates.
