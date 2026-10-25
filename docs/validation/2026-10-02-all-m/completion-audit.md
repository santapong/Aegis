# M0–M4 completion audit

October 2, 2026. Local implementation and executed checks are distinguished from milestone/release completion. Branch `agent/comet-asset-prompt`, base HEAD `e2c4a9c`; the dirty source manifest identifies the tested implementation. No fresh remote fetch, commit, push, tag or application deployment occurred. The [original plan](../../plans/2026-10-02-cashflow-implementation.md) remains normative.

## Package evidence

The final local runner executes the real production engine/API, not the browser-only prototype. Test function names below are in `backend/tests/`; their presence alone is not proof. Executed logs and source manifests are linked from the [evidence index](README.md). Earlier M0–M2 artifacts remain dated historical evidence; new regression results cover the current shared engine.

| Package | Observable local proof | Status and limit |
| --- | --- | --- |
| M0.1 contracts/inventory | M0–M1 dated inventory and populated migration rehearsal; exact Mina/Business X fixture assertions | Locally verified; no customer-data inventory implied |
| M0.2 schema/shared writer | Owner/account/currency guards, paired transfer and cash mutation tests; M4 same-writer interruption test | Locally verified on SQLite/PostgreSQL; MySQL feature certification open |
| M0.3 first cash slice | Fictional personal/business account/opening and manual-record browser tasks; `test_baseline` and missing-anchor assertions | Locally verified; cash records are entered values, not bank connections |
| M0.4 historical assignment | `test_legacy_adoption_explicit_and_repeatable`, new-legacy invalidation, preserved historical LINE undo guard and actual contention across all legacy writers | Locally verified; no automatic customer assignment |
| M1.1 commitments | Month-end/weekend/unresolved and leap/source-link tests; M2 extension retains occurrence IDs and exceptions | Locally verified |
| M1.2 daily engine | Mina 47,000/48,900 and Business X 89,000/98,000; laptop daily low, late receipt and deferred cost assertions | Locally verified; future actuals/missing inputs remain review items |
| M1.3 workspace UI | M0–M1 actual API/browser chart, agenda, saved scenarios, native date persistence, scope/logout checks | Locally verified; independent comprehension open |
| M1.4 matching/corrections | Once-only cash, partial allocations, stale/idempotent/concurrent PostgreSQL matching; shared reversal and paired transfers | Locally verified |
| M2.1 imports | Server-held invalid/raw-currency rows, keep-distinct review, atomic partial match, retry and concurrent batch posting; saved browser batch | Locally verified |
| M2.2 management | All entered intervals, split/month-end collision, weekend boundary, exception-preserving extension and source-link isolation | Locally verified |
| M2.3 purposes/installments | Reservation changes headroom without cash; linked transfer counts once; entered installment does not update principal | Locally verified; no inferred debt interest or tax |
| M2.4 explained alerts | Revision-based explanation, acknowledgment/resolution, missing anchor versus reserve gap and 25-scope revisit tests; browser source explanation | Locally verified; no outbound alert channel claimed |
| M3.1 documents | One linked plan, no cash from a document, preserved existing Business X plan/IDs; visible receivable with original/credit/paid/unpaid amounts | Locally verified |
| M3.2 business settlement | Existing and new partial payments, exact credits/cancellation, due-versus-expected dates, retries/rollback/concurrency; browser 100 + 200 payments and 50 credit | Locally verified; independent owner business task open |
| M3.3 thirteen weeks | Calendar-owned boundaries and daily low tests; visible week closes 5,500 while its daily low is −1,000 with dated sources | Locally verified; end-of-day amounts do not prove intraday availability |
| M3.4 snapshots/variance | Immutable saved payload/hash and frozen-anchor regression; amount/timing/new/unmatched/opening/transfer attribution, residual and corrupt-snapshot tests; browser saved-versus-current review | Locally verified |
| M4.1 explicit connection | THB owned workspace/account link schema, legacy links remain null, Settings no default target and switch-clearing checks; actual correct-destination private link observed October5 | Locally verified; real own-account handshake proven |
| M4.2 capture/correction | No money before confirm, shared cash/audit writer, interrupted outbox construction rolls everything back, duplicate/concurrent confirmation, app match/unmatch/shared undo | Locally verified through authenticated test webhooks; no handset delivery implied |
| M4.3 real LINE pilot | Actual own-account handshake and owner-reported Connected receipt; real THB1 draft with cash1000/no movements. Actual confirmation checked October5 at10:16Bangkok: cash999, one expense and one matching shared audit; own receipt accepted200. [Confirmation evidence](line-real-confirm-evidence.json) | **Open; confirmation handset receipt, repeated-confirm/duplicate/interruption, matching/correction and remaining original criteria pending** |
| M4.4 next connector | Bounded Meta publisher research board prepared; detailed terms and actual LINE observations absent | **Open; no connector selected or promised** |

## Review and release gates

- Independent reviewer sign-off **obtained for the inspected source**: repository ADLC requires an implementer-independent reviewer. The owner authorized one independent reviewer after the local package was prepared. The first verdict requested four fixes; all were repaired, and the same reviewer now reports no actionable findings remaining within the reviewed repair scope. See [review verdict and evidence](independent-review.md). The subsequent source-frozen combined regression gates also passed:209 full backend checks and84actual PostgreSQL cash checks.
- Personal/business comprehension: an implementer walkthrough is not a user study. Visual owner acceptance of earlier frontend work does not prove these financial meanings are understood.
- Real-channel setup and delivery: requires the separate finance channel, authorized target and private participant; credentials stay in the owner's secret interface. M4.3/M4.4 remain open.
- Remote CI, reviewed Git packaging and rollout: the local CI definition includes genuine PostgreSQL acceptance, but remote CI/security/image/release jobs were not executed here. Review the current feature branch and intended target before any publish step.
- Fresh local container installation passed after two packaging repairs: canonical changelog included in the frontend image and backend/CI dependencies installed from the reviewed lock with hashes. The same reviewer signed off on these repairs. Empty-database migrations, four API workers/Redis, standalone web proxy, fictional cash stories and ordinary ARQ worker startup were observed. [Exact evidence and limits](container-rehearsal/README.md). This closes the local image build/start check. A subsequent actual base/prod Compose rehearsal exposed and repaired concurrent API/worker first-boot migrations; the same reviewer approved the worker backend-health dependency. A fresh empty-volume repeat and verified local-CA HTTPS/session/cash checks passed with zero restarts. [Compose evidence](compose-local-tls/README.md). This closes local Compose/local-TLS installation, while public-domain ACME, remote CI/rollout and original M4.3/M4.4 criteria remain open.
- MySQL and customer migration: not certified or run by this local SQLite/PostgreSQL pilot. Load/security/other-browser and real mobile hardware checks are outside the observed evidence.

## Uncoached owner task prompts

Use disposable records and record the user's explanation/actions before giving hints. These prompts do not mark the sessions as executed.

**Personal:** Starting from Mina's example, explain cash today versus the expected freelance receipt. Compare the laptop purchase. Find the record causing the earliest shortage, and say whether an emergency reserve changed the bank cash record. Explain the dates and correction needed before accepting another plan.

**Business:** Starting from Business X, explain why the unpaid 90,000 receivable is not cash today. Move its expected receipt later, find the first below-buffer day and the underlying source, record a partial receipt once and match it. Explain remaining receivable and why matching changed no cash. Find the saved forecast and distinguish payment timing from an opening-balance revision.

**LINE:** Select a workspace/account, explain the destination statement, send a fictional draft and say when cash changes. Find the actual after confirmation. Explain a stale draft and delayed reply, then correct the matched record through unmatch/reversal. Observe real receipt on the test participant's phone.

Record confusion and revise the smallest affected label/flow. Repeat the affected task after a correction; keep incomplete criteria visible. All milestones are complete only after their original local and external gates are actually satisfied.
