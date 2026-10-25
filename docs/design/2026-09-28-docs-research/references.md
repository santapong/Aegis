# Documentation research — 28 September 2026

## Owner correction

The owner said the previous Documentation page was too generic for both developers and ordinary users. This is explicit feedback about audience/task clarity, not approval of the earlier guide. The previous build/browser checks established rendering and navigation only. They did not establish understanding or content completeness.

Keep the accepted Aegis Meridian identity. Replace the mixed long article with a documentation home and focused, addressable guides. This is an information-structure and content correction, not a new visual direction.

## References inspected today

| Source | Evidence | Useful pattern | Aegis adaptation |
| --- | --- | --- | --- |
| [Actual Budget: roadmap for new users](https://actualbudget.org/docs/getting-started/roadmap-for-new-users/) | Live DOM + inspected screenshot `references/01-actual-roadmap.png` | Entry points are written as visitor intentions, with separate self-hosting/developer groups. | Ask what the reader wants to accomplish; clearly route everyday use versus building/hosting. |
| [Lunch Money: getting started](https://support.lunchmoney.app/getting-started) | Live DOM + inspected screenshot `references/02-lunchmoney-guide.png`; cookie notice occupies the bottom-right corner | A task sequence uses named controls, supporting visuals, and routes to deeper help. | Beginner articles show exact Aegis field names, sample values, expected results and troubleshooting. No bank-sync claim borrowed. |
| [Lunch Money: developer quickstart](https://lunchmoney.dev/getting-started) | Live DOM + inspected screenshot `references/03-lunchmoney-developer.png` | Dedicated API onboarding explains authentication before the first request. | Give developers prerequisites, a concrete authentication sequence, a first read request and result interpretation. Use Aegis's actual session/token model. |
| [Stripe: API reference](https://docs.stripe.com/api) | Live DOM + inspected screenshot `references/04-stripe-api.png` | Reference has a resource hierarchy and separates explanations from code and examples. It offers an alternative path for non-developers. | Add focused request/response examples, parameters and errors; do not claim an Aegis SDK or interactive API console. |
| [Stripe: documentation home](https://docs.stripe.com/) | Web text and live DOM; no homepage screenshot retained | Task-focused entry points precede the full product catalog. | Search plus two reader paths and a small set of common questions. |
| [Diátaxis: start here](https://diataxis.fr/start-here/) | Official source text inspected, not a visual reference | Tutorials, how-to guides, explanations and reference meet different needs. | Keep the beginner walkthrough, task articles and technical reference distinct. |

## Implemented structure

- `/docs`: task-focused documentation home, local search and two paths.
- `/docs/guides`: everyday-use guide collection.
- User guides: first record; add/import transactions; budgets and savings goals; plans/calendar; optional AI; export data.
- `/docs/developers`: developer collection.
- Developer guides: local setup with checks; first authenticated API request and reference; architecture/data model.
- Articles: specific title, intended result, prerequisites, concrete steps/examples, expected output, common failure/recovery and next guide.
- Shared Aegis header, compact docs navigation, scoped contents, native mobile menus. Search works locally and says when no article matches. Copy controls copy displayed example code only.

## Grounding and limits

Read current application forms, backend schemas, authentication, CSV parsing, Compose overrides, startup migration code and health response. Existing Markdown tutorials have drift (including currency assumptions and old health output); source code is authoritative for this revision. The HTML example tables are labeled teaching examples, not screenshots of a running account. No customer data, external reference assets, claims or credentials are copied into the product.

Research supports the proposed structure. It is not evidence of comprehension or usability gains. Verify the implementation separately, including search, deep links, mobile navigation and representative API/CSV examples against an isolated test database.

## Verified handoff

The structure above is implemented locally. See [validation and limits](../../validation/2026-09-28-docs-research/README.md). Owner acceptance of this revision is still pending. For future Aegis documentation work, retrieve this correction before reusing the old mixed-page design: ordinary readers need named actions and expected results; developers need prerequisites, authentication, concrete requests/responses and recovery guidance. Keep these as separate paths while preserving the accepted Aegis identity. The number of articles and this exact layout are project decisions, not universal requirements.
