# M2 everyday cash review — local owner pilot

October 2, 2026 · Asia/Bangkok. M2.1–M2.4 are implemented and locally verified on top of M0–M1. Public production rollout, independent review/remote CI, and independent owner/customer task acceptance remain separate gates. This is a dated local verification report, not a claim of managed-service availability.

## Try the local example

Open [Cash planning](http://127.0.0.1:3106/cashflow) and choose **M2 everyday review · fictional**, with Cash as of **2026-10-02** and Plan through **2026-10-31**. This account contains task-created examples only.

| View | What to try | What changes |
| --- | --- | --- |
| Review & match | Open the saved `review-demo.csv` batch. | One 65.25 THB row is recorded and matched; the similar second row remains unposted and the USD row is invalid. |
| Upcoming plans | Review the membership exception or split income. | The edited 12.50 THB payment remains on October 11 after extending its series to 2032. The nominal October 31 split receipt shifts to November 2. |
| Goals & installments | Inspect the 1,000 THB reserve, 100 THB transfer link, and two entered installments. | Reservations reduce headroom; the linked transfer creates no second reserve or movement. Entered debt dates do not update principal. |
| Overview | Inspect exact daily cash, the buffer/goal chart threshold, and Cash alerts. | Moving the fictional 6,000 THB laptop payment to November resolves the October shortage. The later payment remains visible. |

For all included accounts, the saved example has **4,934.75 THB** cash as of October 2, **5,037.50 THB** October closing cash, a **500 THB** buffer, **1,000 THB** reserved and **3,537.50 THB** closing headroom. The paired 100 THB internal transfer nets to zero across its included accounts. These are fictional entered values, not bank data or financial advice.

Use [the cash-planning guide](http://127.0.0.1:3106/docs/guides/cash-planning#everyday-review) for the actual UI steps. The separately hosted public landing remains an introduction and demo.

## Delivered behavior

- Durable CSV batches store normalized rows on the server. Confirmation submits row IDs and reviewed decisions, with optional payment matches. An invalid/stale selection rolls back the whole confirmation. Same-key retries return the original result; fresh-key or concurrent confirmations cannot post a row again. Reversing a record does not reopen its import row.
- Supported recurrence: once, weekly, biweekly, monthly, quarterly, yearly and split month days; interval 1–24. Split amounts apply per occurrence. Clamping and weekend shifts preserve distinct identities. Reviewed extensions add missing payments only, through 2100 and at most 1,000 new payments per review.
- Goal allocations explicitly reserve within an account or link an existing same-currency owner transfer. Optional legacy goal/debt links require owner checks and currency confirmation. Installments use entered amounts/dates; savings progress, interest and debt principal are unchanged.
- Persisted alerts distinguish negative cash, buffer gaps, reservation gaps and incomplete inputs. Explanations retain dates, scope, opening balances, recorded/planned sources, reserved purposes and assumptions. Acknowledgment is metadata. Financial mutations refresh the 20 most recently evaluated scopes; older dated histories refresh on revisit instead of exhausting new date ranges. Active alerts appear before bounded resolved history. No outbound channel is connected.
- The accepted Aegis identity remains. Forms preserve per-workspace drafts during this session; saved reviews, plans, matches, allocations and alerts survive reload. API/client responses remain scoped to the authenticated owner.

## Enable or roll back an installation

1. Follow the M0–M1 [release runbook](2026-10-02-first-cashflow-release.md), with a reviewed installation backup and compatible code.
2. Apply additive revision **a1002cf00002**, following **a1002cf00001**. The migration refuses duplicated stored source links rather than silently choosing a workspace. New runtime plan/transaction aliases link once across owner workspaces.
3. Enable the existing `CASHFLOW_WORKSPACES_ENABLED` flag only after the installation checks. It remains disabled by default outside the isolated local pilot.
4. Exercise save review → confirm selected rows → match → reload, plus recurring exceptions/extensions, reserve versus transfer, entered installments and alert resolution.
5. Roll application code back only to a schema-compatible version or disable exposure. Keep the additive schema when M2 records/history or schedules exist; the downgrade guard refuses destructive removal. Restore a reviewed backup when an actual data rollback is needed.

SQLite and PostgreSQL were checked locally. MySQL certification, business documents/13-week snapshots (M3), workspace chat capture (M4), bank feeds, team roles, tax/interest rules and managed-service provisioning remain outside this release. No new commit, push, tag or production deployment was performed.

The task-local API/web services and Docker database are listed in the first-release runbook. Recheck their live state before reusing those historical addresses. See [validation evidence](../validation/2026-10-02-m2/README.md) and [the M2 contract](../design/013-m2-everyday-cash-review.md).
