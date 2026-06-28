# Design: budget templates (50/30/20, zero-based) — one-click adoption

**Status**: approved. Implemented on `claude/budget-templates-50-30-20`.
Supersedes the round-1 build (abstract categories) and the round-2 build (a DB
unique constraint that regressed manual budget creation); see the decisions
below for what changed and why.

**Context**: `/budgets` gains a **Use a template** action that creates a full
set of category budgets for the current month in one click.
`GET /api/budgets/templates` returns a static catalog (each template carries
categories + income percentages summing to 100%);
`POST /api/budgets/templates/{key}/adopt` takes a `monthly_income` and inserts
one `Budget` per category sized at `round(income × pct, 2)` for the current
period (1st → month-end). It must be idempotent: re-applying a template (or a
double-click / second tab) creates zero duplicates.

Two decisions carried real weight and are recorded below: category realism
(raised by the round-1 Review gate) and how idempotency is enforced (the
round-2 Review gate caught that a DB constraint regressed existing endpoints).

## Decision 1 — template categories must be *real Aegis categories*

The round-1 catalog used abstract buckets: `needs` / `wants` / `savings` for
50/30/20 and `food` / `housing` for zero-based. But Aegis tags transactions
with a fixed taxonomy — `groceries`, `rent`, `utilities`, `dining`,
`transport`, `subscriptions`, `entertainment`, `health`, `shopping` (see
`backend/app/seeds/demo.py` `EXPENSE_CATEGORIES` and
`backend/app/routers/dashboard.py` `CATEGORY_COLORS`). `GET /api/budgets/comparison`
joins `budget.category` to spend by **strict equality**
(`spent_by_category.get(b.category, 0)`); there is no aliasing layer. A budget
on `needs` or `food` therefore matches no transactions and reads **$0 spent /
0% used forever** — directly contradicting the page's promise to "track your
spending against budget limits."

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Keep abstract buckets** (`needs`/`wants`/`savings`) | Matches the textbook 50/30/20 vocabulary | Budgets never track spend; feature is cosmetic | **No** — fails the feature's core promise |
| **Add a category-aliasing layer in comparison** (map `needs` → {rent, groceries, …}) | Keeps abstract vocabulary *and* tracks spend | New many-to-one mapping to define + maintain; changes a hot, shared endpoint used by the dashboard; aggregation semantics (one budget vs many spend categories) leak everywhere | **No** — large blast radius for a one-click convenience feature |
| **Express templates over real categories** | Every budget tracks real spend with zero changes to comparison; smallest blast radius | 50/30/20 needs a concrete category split, not just three numbers | **RECOMMENDED — chosen** |

**Chosen:** both templates allocate only to real Aegis categories, guarded at
import (`KNOWN_BUDGET_CATEGORIES` in `schemas/budget.py`, asserted alongside the
sum-to-100% check). The 50/30/20 rule is expressed as a concrete distribution
over real categories, grouped into `needs` / `wants` / `savings` **tiers**
(`needs` sum to 50%, `wants` to 30%, `savings` to 20%) so the rule stays
recognizable in the UI. `tier` is a presentational label on
`BudgetTemplateCategory`; it carries no backend behavior.

The split:

- **50/30/20** — needs: rent 30, groceries 10, utilities 6, transport 4 (=50);
  wants: dining 10, entertainment 8, shopping 7, subscriptions 5 (=30);
  savings: savings 20.
- **Zero-based** — rent 28, groceries 12, dining 8, transport 8, utilities 7,
  subscriptions 3, entertainment 6, health 5, shopping 8, savings 15 (=100).

**`savings` is a deliberate, documented exception.** It is the one allocated
category with no matching expense transactions (savings is a transfer, not a
spend), so a savings budget reads as a *target* at 0% "spent". This is correct
behavior, not the round-1 bug: every other allocated category tracks real
spend. Test `test_adopted_budget_tracks_real_spend_in_comparison` proves a
logged grocery expense shows up against the adopted grocery budget (non-zero
`actual_spent`), which is exactly what round-1 could never do.

## Decision 2 — idempotency at the application layer; no DB unique constraint

The round-2 build enforced idempotency with `UNIQUE(user_id, category,
period_start, period_end)` (`uq_budget_user_category_period`) plus an
`IntegrityError` fallback. The round-2 **Review gate caught that this regresses
pre-existing behavior**: `POST /api/budgets/` and the MCP `create_budget` tool
both let a user keep more than one budget in the same category+period, and the
constraint turns the second create into an unhandled `IntegrityError` → **HTTP
500** (verified by probe: two `groceries` budgets for the same month returned
`201` then `500`). It also collides a **personal budget with a trip-scoped
budget** — `Budget.trip_id` is a live relationship (`Trip.budgets`
back-populates it) — in the same category+period.

Making the constraint *correct* runs into NULL semantics: include the nullable
`trip_id` and it no longer dedupes personal budgets (SQL treats NULLs as
distinct); exclude it and personal vs. trip budgets collide. A NULL-safe version
needs partial or functional indexes, which are **not portable across the
20-target DB matrix** (notably MariaDB lacks inline functional key parts, and it
must also survive Alembic batch-mode on SQLite). That is a large, fragile
mechanism for what is, in practice, a double-click guard.

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Broad `UNIQUE(user, category, period)` (round 2) | DB-enforced dedupe | **Regresses `create_budget` + MCP tool to HTTP 500; collides personal vs. trip budgets** | **No** — the round-2 regression |
| NULL-safe functional/partial unique incl. `trip_id` | Correct invariant | Not portable (MariaDB / batch-mode); heavy for a convenience feature | **No** — disproportionate, multi-DB-fragile |
| **App-level idempotency, no constraint** | No schema change; no regression; trip + personal budgets coexist; portable | Doesn't defend a *true* concurrent double-click (low severity) | **RECOMMENDED — chosen** |

**Chosen:** adoption is idempotent at the application layer — the adopt route
reads the user's existing rows for the period and inserts only the missing
categories, so a re-adopt / second tab maps to an existence check, not a
duplicate insert. `create_budget` and the MCP tool keep their existing behavior
unchanged. The residual gap — two *simultaneous* adopts that both pass the
existence check before either commits — is a low-severity, self-correcting
data-quality issue (a user can delete a stray row), explicitly accepted rather
than paid for with a non-portable index. Pinned by
`test_create_budget_allows_duplicate_category_period` and
`test_manual_create_after_adopt_same_category_ok` (the exact round-2 probe).

A stricter "one budget per category per period" invariant, if wanted later, is a
standalone change across *all* budget-creation paths (with `create_budget`
returning `409`), not a side effect of shipping templates.

### No migration / rollback

The feature adds routes + a static catalog + a frontend picker only; it reuses
the existing `Budget` model unchanged, so there is **no Alembic migration** and
nothing to roll back. (The round-2 `f1a9c7d3e8b2` constraint migration was
removed along with the constraint; the alembic head is unchanged at
`e7a2b9c41f06`.)

## UX sign-off

The change adds one button (**Use a template**, secondary/outline next to
**Add Budget**), one modal (template picker with a monthly-income input and an
**Adopt** button per template), and two routes. Per `docs/adlc.md` Review gate
("UX sign-off if a button/route/modal changed"):

- **Surface & placement:** reuses the existing `Modal` / `Button` / `Input`
  primitives and the page's `PageHeader` action slot — no new design tokens, no
  `globals.css` change. Consistent with the existing **Add Budget** affordance.
- **Affordance clarity:** the modal previews each category's percentage and
  (once income is entered) its dollar amount, grouped by tier for 50/30/20 so 9
  categories stay scannable. The income field gates adoption with an inline
  error ("Enter your monthly income to size the budgets").
- **Idempotency framing:** copy states "re-applying a template won't create
  duplicates," and the success toast reads "Template applied — N budgets ready
  for this month" so a no-op re-adopt still reads as success rather than
  implying N fresh rows.
- **Verdict:** approved — within the existing design system, no net-new visual
  language, accessible labels on all inputs/buttons.

## Out of scope

Custom / user-authored templates, editing percentages, multi-period or
recurring adoption, currency conversion, `trip_id` linkage.
