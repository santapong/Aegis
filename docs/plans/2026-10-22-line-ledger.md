# LINE money workflow — baseline audit and implementation plan

Date: 2026-10-22, Asia/Bangkok. Status: implementation in progress, inactive.

Goal: provide the SDD opening → linked private LINE text → reviewed draft → one balanced journal → exact tracked balance flow, then receipts and operational orchestration.

Source requirement: `docs/design/016-line-money-ledger-sdd.md` (unaltered October 18 handoff). Its embedded execution instructions are reference material, not authority for external publishing, ClickUp writes, channel activation, or live cutover. Design slot 007 is already occupied.

## A01: observed baseline

- Fresh `git fetch origin` on October 22: origin/main remains `9071ddf`, origin/develop `2ba31eb`. Original checkout is `agent/comet-asset-prompt` at `e2c4a9c` with substantial inherited uncommitted work.
- Source copied without secret/env files into isolated `feature/line-money-ledger-20261022` worktree. Inherited source SHA-256 manifest stored separately under the owner's local Codex data directory. Original source remains unchanged.
- Existing October cash planning uses Decimal/Numeric legacy transaction storage, date anchors, paired transfers and corrections. Existing LINE provides hashed expiring identity linking, private HMAC ingress, explicit destination, drafts and durable push replies. These are reusable, but not a BIGINT double-entry ledger.
- PostgreSQL cash integration tests already exist. Generic legacy test client still uses SQLite. Do not infer PostgreSQL proof from the generic suite.
- Gaps: frozen precise openings, card/refund semantics, immutable balanced journals, exact canonical DTO, versioned review, source-job leases/fencing, media, n8n exports, statement reconciliation and coordinated cutover compatibility.

## Decisions and sequence

1. B01/B02 (unblocker): additive `finance_` ledger domain, integer satang, explicit opening metadata, control accounts, immutable postings/projections, atomic versioned drafts, per-owner transaction locks and idempotency. Disabled by default; PostgreSQL and SQLite only. Existing cash planning remains historical/independently scoped until a deliberate migration.
2. Parallel lanes: L01 identity/inbox/jobs/private capture; F01 account setup/review/login-return; B03 canonical reads/legacy guards/statements. One owner per new subsystem.
3. N01/R01/O01: inactive sanitized n8n exports, fake fixtures and explicitly configured OCR adapter, LINE rich-menu setup asset, worker/retention/backup runbooks. Inspect actual n8n version before serialization. No provider credential or real notification invented.
4. Q01: execute deterministic accounting fixture, rollback/idempotency/refund/capability tests, real Alembic upgrade/downgrade and PostgreSQL concurrency/DB protection tests; frontend types/build and browser flow; independent review.

## Observable acceptance

- Accounts/openings reproduce SDD section 14.1, including zero/negative contracts and explicit cutoff ambiguity.
- A draft changes no balance; one confirmed version produces balanced immutable postings, projection, audit, idempotency outcome and durable notification together.
- Replay/concurrency cannot double post or over-refund. Corrections preserve history and reviewed effective dates.
- Caller cannot read another owner's money/evidence or claim another source job. Expired leases cannot mutate drafts.
- Canonical reads preserve signed effects and separate unverified legacy currency. Post-cutover accountless writers fail helpfully.
- UI exposes reviewed opening/setup and Confirm/Edit/Cancel with exact values and safe deep links.
- Each FR has implementation/evidence or an explicit remaining gap. Unrun live integration/restore/activation is never reported passed.

## Risks and limits

Inherited cash functionality must be preserved; isolated source snapshot and regression tests bound changes. SQLite proves compatibility, not row-lock safety. LINE/n8n/OCR credentials, account opening values, retention choices and G1/G2/G3 remain operator inputs. No live account cutover, production migration, deployment, messaging, push, tag, or external tracker update is performed by this implementation task. Repository-only PR creation is a manual web step under the owner's global working agreement.

## October 23 owner-authorized fictional phone pilot

The owner subsequently requested a phone test and selected a separate fictional
THB 1,000 account. A new isolated Pi runtime and two native n8n workflows passed
real LINE text → validated preview → owner Confirm → posted reply: exactly one
THB 1 expense, balance THB 999, with owner-reported handset receipt. The owner
then chose pause, and both pilot workflows were verified inactive. This extends
the original repository-only task solely for that fictional text pilot; it does
not authorize production financial cutover or real-slip/provider configuration.
See [executed evidence](../validation/2026-10-23-phone-pilot/README.md). The Pi
resource qualification and remaining G1/G2/G3 production gates still apply.
