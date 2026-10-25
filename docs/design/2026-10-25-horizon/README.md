# Aegis Horizon — frontend identity

Current availability: included in [v1.5.0, tagged and deployed](../../releases/2026-10-25-v1.5.0/RELEASED.md). The implementation checkpoints below remain historical.

25 October 2026, Asia/Bangkok. The owner requested renewed identity exploration across the landing page and every page, then selected **calm confidence: warm ivory, deep green, precise financial views**. This supersedes the old requirement to preserve the dark Meridian direction for this redesign. The name Aegis remains. Owner acceptance of the implemented screens is pending.

The idea is **solid ground, open horizons**: understandable money today creates room for future choices. The public promise is “A clearer today. A bigger tomorrow.” Horizon names the design direction, not a newly released product or subscription.

## Visual system

- Warm ivory `#F6F5EF`, evergreen `#123D32`, ink `#192E26`, soft chartreuse `#DCE9AF`, white panels and grey-green borders.
- Instrument Serif for editorial headlines, Inter for interfaces, JetBrains Mono for code and exact technical values.
- New vector shield/arch mark, quiet horizon linework, and one generated lakeside landscape. Important content and charts are accessible HTML/SVG; no text is baked into the landscape.
- Horizon is the default for new workspace preferences. Existing chosen themes are retained and Horizon can be selected in Settings. Public routes own their light palette independently of saved workspace themes.

## Implemented scope

A new landing story and interactive financial example; unified header and wordmark; refreshed login and signup; truthful first-steps onboarding; docs hub/articles and public demo; shared workspace navigation, headings, controls, cards, charts and dialogs; dedicated cash-planning and ledger surfaces. Existing financial handlers, account ownership and review/confirmation contracts are preserved.

The landing illustration reuses the demo's exact scenario arithmetic. Personal: THB43,900, or35,900 with delayed income. Business X: THB88,000, or−2,000 after reserve intentions with delayed income. The latter is a reserve gap; cash before that allocation is THB8,000. These are fictional October2026 examples, not the production forecast engine or a bank connection.

Unsupported bank-connection onboarding, unlaunched signup pricing, static sidebar growth percentages and invented latency/sync status were removed from this isolated frontend. No deployment, account connection, real payment, real messaging or financial cutover was performed.

## References and choices

Inspected25 October2026:

| Reference | Observation | Aegis adaptation |
| --- | --- | --- |
| [Wise](https://wise.com/) | Decisive green identity, clear action hierarchy, concrete product explanation | A restrained evergreen action system; Aegis's own supported planning tasks |
| [Mercury](https://mercury.com/) | Spacious aspiration-led opening, landscape, direct demo path | Quiet horizon imagery with immediate inspectable planning evidence |
| [Copilot](https://www.copilot.money/) | Everyday-life framing and clear financial views | Personal goals and understandable recorded/planned distinctions |

These references support visual research only. Their banking, security, integrations, customers and financial claims are not Aegis claims.

The generated [direction board](01-direction-board.png) is a composition reference. Its incidental password-recovery control, example amounts and marketing claims were not copied into working flows. The implementation uses an original vector shield, real form capabilities and the existing demo data. Exact built-in ImageGen prompts and asset hashes are retained in [prompts.json](prompts.json) and [manifest.json](manifest.json).

## Source isolation and review

Worktree: `/home/santapong/worktrees/aegis-horizon-20261025`, branch `feature/aegis-horizon-20261025`, Git base `e2c4a9c`.

The frontend baseline was copied from the newer LINE-ledger worktree, excluding credentials, `.env`, databases, dependency trees and compiled output. The two app files deleted in that baseline were removed from the copy after an initial duplicate-route preview failure. Original Aegis/LINE checkouts remain intact. This worktree's backend is still its Git base; it is not an integrated backend release.

[Horizon-only patch](horizon-only.patch) isolates these changes from the pre-existing uncommitted frontend baseline. New image assets are listed in the manifest. Do not treat the entire worktree's Git diff as newly authored Horizon work.

See `verification.md` for actual runtime checks, coverage, failures and resource cleanup. No commit or push is implied.
