# Aegis landing clarity and Documentation

Date: 2026-09-28. Owner request: assess whether a new visitor understands the product, add useful landing ideas, update the header, and add a Document page. Preserve the approved Meridian landing and Aegis Focus login.

**Documentation structure superseded later on 2026-09-28.** The owner found this mixed page too generic for both ordinary users and developers. The earlier rendering/navigation checks remain historical technical evidence, not evidence of owner acceptance or comprehension. Continue from [the researched documentation revision](2026-09-28-docs-research/references.md) and its [validation](../validation/2026-09-28-docs-research/README.md). Landing and header decisions below remain relevant.

## Evidence and decisions

Captured the current first viewport, workflow, and existing docs in the visible in-app browser. The [review](../validation/2026-09-28-landing-docs/audit.md) records observations and evidence limits. The current layout already communicates a calendar-first money planner; the missing category definition and beginner instructions are content/navigation issues, so this is a scoped improvement rather than another visual exploration.

Keep the original icon, Syne/Inter roles, charcoal/warm text/amber/teal tokens, sample figures and approved headline. Define Aegis explicitly as a personal finance app and describe manual/CSV entry. Add a first-month guide under the existing Record/Arrange/Review flow; retain the interactive month and goal examples.

One shared public header serves landing and Documentation, with consistent mobile navigation, an active Documentation destination, account actions, Escape/focus return, and a no-JavaScript navigation fallback. Login keeps the separately approved Focus composition.

## Documentation structure

Reuse the `/docs` route, replacing the old feature-card/tabs page. A sticky desktop contents rail and native mobile contents disclosure expose deep links to:

1. First month: record an expense, create a matching budget, add a plan.
2. Transactions versus plans, with separate examples and CSV import.
3. Category budgets, savings contributions, trips and debts.
4. Optional AI provider configuration and data sharing.
5. CSV/PDF/NDJSON export scope.
6. Repository Docker setup and further deployment guides.
7. Common API entry points and the debug-only backend schema.
8. Common questions and the issue tracker.

Docs are public and server rendered for both signed-out and signed-in readers. The page has its own marketing header rather than the authenticated sidebar. `/changelog` keeps its existing behavior. No account, backend, provider or database mutation is part of this change.

## Content grounding

- `transactions/page.tsx`: Add Transaction fields and CSV preview/confirmation.
- `plans/page.tsx` and `backend/app/routers/plans.py`: Create Plan, dates, progress/status; no transaction creation upon completion.
- `budgets/page.tsx`, `backend/app/routers/budgets.py`: category/date-based expense comparisons.
- `savings/page.tsx`: separate Add Contribution action.
- `reports/page.tsx`, `backend/app/routers/export.py`: CSV/PDF, and NDJSON limited to transactions/plans/budgets.
- `README.md`, `Makefile`, `scripts/bootstrap.sh`, `docker-compose.yml`: local setup commands; Compose runs PostgreSQL and Redis. This corrects the old placeholder repo and blanket SQLite-default claim.
- `backend/app/main.py`: Swagger `/api/docs` and ReDoc `/api/redoc`, only with debug enabled. This corrects the old `/docs` and `/redoc` backend paths.

Commands and capabilities were checked against source; this does not establish a fresh Docker installation, real login, API execution, financial advice quality or customer comprehension. No new dependencies, deployment, commit, push or release action.
