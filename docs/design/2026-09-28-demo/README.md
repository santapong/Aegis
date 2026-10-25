# Aegis personal and Business X demo

**Later owner acceptance, 2026-09-28:** the owner said the frontend design was finished. See the [accepted specification](../012-aegis-design-spec.md) for scope. The earlier implementation/review distinction below remains historical; backend and launch acceptance are not implied.

Date: 28 September 2026. Owner requested an example money plan for a business or ordinary person, and asked whether the product focuses on self-hosting or the owner's hosted service.

## Implemented choice

A public `/demo` provides two interactive, fictional October 2026 stories. It extends the accepted Aegis Meridian identity and the existing landing month example. This is a scoped product-explanation feature, not a reopened visual direction. No generated artwork or new visual reference research was needed; the research/identity decisions from the landing and documentation remain relevant.

Business X is a small design studio managed by one owner. Opening money, an actual project deposit, rent and software establish the recorded total. An expected client payment funds contractors, hosting, equipment and a reserve goal. Moving the payment from 15 October to 5 November exposes a shortfall after the reserve goal.

Mina is a fictional salaried person with side income. Her recorded salary, rent, food and transport are separate from upcoming utilities, groceries and an emergency-fund plan. Delaying the side income shows a different outcome.

Readers can inspect recorded transactions and upcoming plans, add a sample expense, see its category-budget effect, inspect the arithmetic, switch stories without losing either story's edits, and reset the current story. State exists only in the demo's browser component and resets on reload. No API, stored account, subscription, bank or payment action is performed.

## Scope and product truth

- Current models support user-owned transactions, budgets, savings goals and dated plans. Completing a plan does not itself create a transaction or transfer money.
- The projected remainder is an explicitly illustrative demo calculation from the displayed assumptions, not a claimed production scenario engine, verified bank balance or financial recommendation.
- Business X illustrates an owner's cash planning. It does not imply company ledgers, invoicing, payroll, tax calculations or shared company roles.
- The current repository contains self-hosting recipes and hosted deployment configuration. The separate business-plan draft dated 28 September proposes a managed subscription service but records subscription/entitlement and service-readiness work as incomplete. It is a proposal, not owner acceptance of pricing or launch evidence. The demo therefore distinguishes supported self-hosting from a proposed hosted offering and makes no pricing/availability promise.
- Source context: `backend/app/models/{transaction,plan,budget,savings_goal}.py`, deployment files, the existing documentation revision, and `/mnt/data/company/strategy/aegis/2026-09-28/aegis-business-plan-draft.md`. No current production-hosting audit was requested or performed.

## Arithmetic

All values are fictional THB. Reserve contributions reduce the illustrative remainder separately from ordinary expenses.

| Story | Opening | Recorded income | Recorded spending | Recorded total | Upcoming income | Upcoming costs | Reserve | Original remainder | Remainder if income delayed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Business X | 60,000 | 50,000 | 21,000 | 89,000 | 90,000 | 81,000 | 10,000 | 88,000 | -2,000 |
| Personal | 18,000 | 45,000 | 16,000 | 47,000 | 8,000 | 6,100 | 5,000 | 43,900 | 35,900 |

See [validation](../../validation/2026-09-28-demo/README.md) for actual checks and limits. Owner review remains separate from implementation and verification.
