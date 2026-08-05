# Design: AI provider configuration — in-app model picker, usage metering, and operator key storage

**Status**: proposed. Not implemented. Branch `claude/ai-provider-configuration`.

**Context**: Aegis already swaps between three AI providers (`anthropic`,
`typhoon`, `groq`) behind one env var, but every part of that choice —
provider, model, credential — is env-only and invisible in the product. An
operator who wants to move to Groq's free tier has to edit `.env` and restart,
and once running has no way to see what the AI layer costs them.

This document scopes a settings surface that (1) picks the provider and model
from a live list, (2) reports real token usage and an estimated cost, and
(3) optionally stores the provider key outside `.env`. It also records two
defects found while scoping, and corrects one claim made during the discussion
that turned out to be wrong.

The driving constraint is cost: the near-term goal is to run Aegis on a **free
model** (Groq) and only pay when quality becomes the binding constraint. Every
decision below is weighed against that.

---

## Findings that shaped this design

**F1 — the Anthropic default is a dated snapshot.** `backend/app/config.py:62`
pins `ai_model = "claude-sonnet-4-20250514"`. Dated snapshots are retired on a
published schedule and return `404` afterwards; this one was scheduled for
retirement well before the current date. *Not verified against the live API —
no `ANTHROPIC_API_KEY` was available in the environment where this was
scoped.* Treat as "verify then fix", not as a confirmed outage. The
alias-style IDs (`claude-sonnet-5`, `claude-haiku-4-5`) do not carry this
failure mode, which is the deeper reason to prefer a fetched model list
(Decision 2).

**F2 — token usage is discarded.** `AIEngine._call_tool`
(`backend/app/services/ai_engine.py:173-218`) returns only the parsed tool
input and drops the response object, `usage` included. There is no usage or
cost model anywhere in `backend/app/models/`. Any cost display is therefore
blocked on capturing this first (Decision 3).

**F3 — the settings page hard-codes two stale facts.**
`frontend/src/app/settings/page.tsx:385-388` renders a static table containing
`["Version", "1.0.0"]` — the repo is at v1.2.0 — and
`["AI Engine", "Claude (Anthropic) + tool_use"]`, which is simply false on a
Groq or Typhoon deploy. Both are display-only, and both are fixed as a side
effect of this work.

**F4 — Aegis's deployment posture is single-operator self-host.** This is the
finding that unlocks the whole design; the evidence is in Decision 1.

### Correction to an earlier claim

During scoping it was asserted that the NDJSON export would leak a stored
credential, because `_ndjson_stream` (`backend/app/routers/export.py:51`)
serializes **every** column of a row generically and `export.py` imports
`User`. The generic-serializer half is accurate. The conclusion was not:
`export.py` exposes only `/transactions.ndjson`, `/plans.ndjson`, and
`/budgets.ndjson`, and the `User` import is the type annotation for the
`get_current_user` dependency. **No user row is exported today, so there is no
live leak.**

The risk is latent rather than live, and that changes its priority — it is a
guardrail in Decision 4, not a prerequisite. It is still worth writing down:
`_ndjson_stream` has no column allowlist, so *any* future export endpoint over
`User` or over the secrets table introduced below would serialize credentials
by default. That is a footgun sitting one endpoint away.

---

## Decision 1 — who configures the key: SaaS tenant, or self-host operator?

Every downstream decision depends on this. A multi-tenant SaaS must treat the
provider key as a per-customer secret with an operator/customer trust boundary;
a self-hosted single-operator deploy has no such boundary and can be far
simpler. The repository answers the question:

| Signal | Evidence | Reads as |
|---|---|---|
| Billing | `models/payment.py` is a generic `Payment` (amount / currency / description) + Stripe checkout sessions. **No `Subscription` model, no plan tier, no entitlement flag.** Nothing charges a user to *use* Aegis. | Not SaaS |
| Roles | `models/user.py` has no `is_admin` / `role` / `is_superuser`. | No operator/customer boundary exists |
| Deployment | All five recipes in `docs/deployment/` are single-instance, priced for the operator: "$0 Hobby", "~$7", "~$5–20 on a $5–10 droplet". | Self-host economics |
| Multi-user roadmap | ROADMAP lists "Shared budgets between users (**household mode**)" — several people on one instance. | Household, not tenants |
| Seed | `make seed` provisions one demo user. | Single-operator |

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Treat as multi-tenant SaaS** (per-user BYOK, encrypted, admin-gated) | Future-proof if Aegis is ever sold as a service | Requires a `role` field, a trust boundary, and per-user key isolation that nothing in the repo currently implies; large build for zero present users | **No** — designing for a product that does not exist |
| **Treat as self-host, single operator** | The person configuring the key is the person paying is the person who deployed; no untrusted party to defend against; smallest build | Collides with "household mode" when that ships | **RECOMMENDED — chosen** |

**Chosen:** self-host, single operator. A key field on the settings page is
acceptable because there is no untrusted tenant to protect against.

**Recorded consequence:** this decision has an expiry date. When household mode
ships, every account with a login can read and change the provider key. That is
the trigger to add the `role` field — not this change. Decision 4 keeps the
storage design compatible with that future rather than pre-building it.

---

## Decision 2 — model list: hard-coded catalog, or fetched from the provider?

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Hard-coded catalog per provider** | No network call to render the settings page; can annotate each entry with prices and capabilities | Goes stale exactly the way F1 went stale; every model launch or retirement is a code change and a release | **No** — rebuilds the bug we are fixing |
| **Fetch `GET /v1/models` per provider** | Always current; a retired model disappears from the picker instead of 404-ing at request time; all three providers expose it (Anthropic `client.models.list()`, Groq and Typhoon via the OpenAI-compatible route already wired in `ai_engine.py`) | One upstream call to populate the dropdown; needs caching and a failure path | **RECOMMENDED — chosen** |

**Chosen:** fetch, cache, and degrade gracefully. A new
`GET /api/ai/models` proxies the configured provider's model list through the
existing cache layer (`CACHE_BACKEND`, TTL ~1 h — model lists change on the
order of weeks). When the upstream call fails, the endpoint returns the
currently-configured model as a single-entry list plus a `stale: true` flag, so
the settings page degrades to "you are on X, we could not list alternatives"
rather than rendering an empty dropdown.

**Not in scope:** validating that a chosen model supports forced tool calling.
The model list is unfiltered, and picking a model that cannot honour
`tool_choice` will surface as the existing graceful degradation (see
Decision 3's note on the fallback paths). Filtering by capability is a
follow-up if it proves to be a real support burden.

---

## Decision 3 — cost display: priced table, or measured usage?

The instinct to show cost is right; the shape matters. **No provider API
returns pricing.** There is no endpoint for dollars-per-token on Anthropic,
Groq, or Typhoon. A cost figure therefore requires a price table maintained by
hand — which is precisely the staleness failure of F1 and of the rejected
option in Decision 2.

What *is* free and permanently accurate is `response.usage`, which every
provider returns and which Aegis currently throws away (F2).

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Estimated cost only**, from a hard-coded price table | Answers the question the operator actually asks ("what does this cost me?") directly | Silently wrong the moment a price changes; no way for a reader to tell a fresh figure from a stale one; nothing measured underneath it | **No** — a number with no ground truth is decoration |
| **Measured usage only** (tokens in/out, call counts) | Always accurate; zero maintenance; useful on its own for spotting a runaway prompt | Does not answer the cost question without the operator doing the arithmetic | Necessary, not sufficient |
| **Usage first, prices as a dated overlay** | Accurate substrate; the derived figure is explicitly labelled with the date its prices were captured, so a reader can judge it | Two things to build; price table still needs occasional maintenance | **RECOMMENDED — chosen** |

**Chosen:** capture usage, then derive cost from a dated table.

- A new `ai_usage` row per call: `id`, `user_id`, `provider`, `model`,
  `operation` (`analyze` / `forecast`), `input_tokens`, `output_tokens`,
  `created_at`. Written inside `_call_tool`, which is the single choke point
  both AI entry points already pass through.
- Recording must never fail the request. `_call_tool` already swallows provider
  exceptions and returns `None` so that `analyze` falls back to a placeholder
  recommendation and `forecast` falls back to a linear projection; usage
  persistence inherits the same contract. **A metering write that breaks the
  feature it meters is a strictly worse outcome than a missing row.**
- The price table lives in one module with an explicit `PRICES_AS_OF` date, and
  the UI renders the date beside the figure: *"≈ $0.18 — prices as of
  2026-08"*. A model absent from the table shows usage with cost omitted, never
  a wrong number.

**Non-goal:** billing-grade accounting. This is an operator-facing estimate for
noticing "the AI panel cost more than expected this month", not a reconciled
ledger against a provider invoice.

---

## Decision 4 — where the provider key lives

Decision 1 established that storing the key is acceptable. The question is
where, and the answer is shaped by a roadmap item: **"LINE Messaging API — push
notifications and a chat-driven expense logger (*requires user-settings token
storage* + background task system)"**. Encrypted per-user secret storage is
already a planned need. Building it twice would be the waste.

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Env-only (status quo)** | Zero secret handling; no new attack surface | The feature the operator asked for does not exist; provider changes still require a redeploy | **No** as an end state — but see the phasing below |
| **`api_key` column on `User`** | Smallest possible change | A one-off for a need the roadmap says will recur; a second migration when the LINE token arrives; puts a credential on the most widely-joined and most export-adjacent table in the schema | **No** — solves it once for a problem that occurs twice |
| **General `user_secrets` store** (`user_id`, `key_name`, `encrypted_value`, timestamps) | One mechanism for the AI key *and* the planned LINE token; keeps credentials off `User`; a natural place to hang the export allowlist and rotation | Slightly more to build than a column | **RECOMMENDED — chosen** |

**Chosen:** a general `user_secrets` table, with the AI provider key as its
first consumer and the LINE token as its designed-for second.

Resolution order is **stored secret → env fallback**, so an existing `.env`
deploy keeps working untouched and the feature is purely additive.

Guardrails, all of which apply regardless of self-host posture:

- **Encrypted at rest** (application-level, key from env — never a plaintext
  column). An operator who loses the encryption key loses the stored secrets;
  the env fallback is the recovery path.
- **Never echoed on read.** `GET` returns a mask (`gsk_…4f2a`) and a
  `configured: true` flag, never the value.
- **Excluded from export by construction.** `_ndjson_stream` gains a column
  allowlist rather than relying on no one adding a `/users.ndjson` endpoint —
  this closes the latent footgun described in the correction above.
- **Excluded from logs.** `_call_tool` logs raw exception text on failure
  (`logger.warning("{} tool call failed: {}", ...)`) and a provider error can
  echo the credential back. The handler needs redaction before a key is ever
  stored.

**Two cache invalidations are mandatory**, and skipping either produces the
same user-visible bug — "I saved the setting and nothing changed":

1. `get_settings()` is `@lru_cache`d, so a runtime configuration change is
   invisible to the process until the cache is cleared.
2. `_cached_anthropic_client` / `_cached_openai_client`
   (`ai_engine.py:21-28`) are `@lru_cache(maxsize=4)` keyed on the API key.
   A stale entry keeps serving the *old* credential. `maxsize=4` is correct for
   the single-operator model chosen in Decision 1; it would thrash under
   per-user BYOK, which is a further reason that design was rejected.

---

## Decision 5 — sequencing

The four pieces have very different risk profiles, and only the last one
touches secrets. They ship in this order, each independently releasable:

| # | Step | Touches secrets | Delivers |
|---|---|---|---|
| 1 | Provider + model picker (`GET /api/ai/models`, fetched list) | No | Kills the stale-model bug class; fixes the two stale strings in F3 |
| 2 | Usage metering (`ai_usage` table, capture in `_call_tool`) | No | Real token counts; substrate for step 3 |
| 3 | Cost panel (dated price table over step 2) | No | Answers "what does this cost me?" |
| 4 | Key storage (`user_secrets`, encryption, export allowlist, log redaction, cache invalidation) | **Yes** | Provider key configurable without a redeploy |

Steps 1–3 introduce no new secret-handling surface at all, which is why they go
first: they carry most of the operator-visible value and can land while step 4
is still being reviewed. **Step 4 is not a prerequisite for anything above it.**

Independent of all four, and worth doing first because it is a one-line fix to
a live defect: replace the dated `ai_model` default in `config.py:62` with an
alias-style ID (F1).

---

## Risks and open questions

- **Provider parity for forced tool calls.** Aegis pins
  `tool_choice` to a single tool. Groq honours OpenAI-style forced function
  calling; Typhoon's support is unverified in this repo. A model picker makes
  it easier for an operator to select a model that silently falls back to the
  placeholder recommendation. Mitigation for now is the existing graceful
  degradation; a capability filter is the follow-up if support load justifies
  it.
- **Data residency.** Groq's free tier means real financial aggregates leave
  the operator's infrastructure. `_gather_context` sends category totals and
  plan titles, not raw transactions — but this is a finance application and the
  settings page is the honest place to say so. A short provider-data note
  belongs beside the picker.
- **Household mode collision** (Decision 1) — tracked, not solved here.
- **Price-table maintenance** — accepted deliberately, bounded by the
  `PRICES_AS_OF` label so staleness is visible rather than silent.

## Verification

- Unit: `_call_tool` writes exactly one `ai_usage` row per successful call and
  **zero** on provider failure, with the existing fallback behaviour of
  `analyze` / `forecast` unchanged.
- Unit: a persistence error inside metering does not propagate to the caller.
- Unit: secret round-trips through encryption; `GET` returns only a mask.
- Unit: the export allowlist omits secret columns — asserted against the
  serializer, not against the current endpoint list, so the test still holds
  when a `/users.ndjson` endpoint is added.
- Integration: changing provider or model at runtime takes effect on the next
  AI call without a restart (both caches invalidated).
- Integration: `GET /api/ai/models` degrades to the single-entry `stale: true`
  response when upstream is unreachable.
- Manual: with `AI_PROVIDER=groq` and no `ANTHROPIC_API_KEY` set,
  `/api/ai/analyze` and `/api/ai/forecast` both succeed and both record usage.
