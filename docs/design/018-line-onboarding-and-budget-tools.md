# LINE onboarding and budget tools

Status: owner requirements confirmed 25 October 2026; local implementation and
selected verification complete. See the dated receipt for skips and release
checks. No release or pilot activation is implied.

## Goal and scope

The owner reported that the QR/setup code expired before linking was complete,
and selected monthly spending limits, remaining budgets and useful LINE
shortcuts. New setup challenges should last 24 hours. Established LINE identity
links remain persistent until explicitly disconnected. The web session already
defaults to 24 hours; it is a separate lifetime.

Extend the existing exact-money LINE integration in the isolated
`feature/line-money-ledger-20261022` worktree. Preserve the original dirty
checkout, accepted Aegis styling, immutable ledger and draft confirmation.

## Decisions

| Choice | Decision |
| --- | --- |
| Setup capability lifetime | Configurable, 24-hour default; hash stored, single-use; renewal invalidates the old challenge. |
| QR generation | Generate locally in the API, encoding LINE's official prefilled chat URL for the configured bot basic ID. Never use an external QR service. |
| Setup presentation | QR, Open LINE, copy fallback, countdown, expiry and renewal; stop showing the capability after successful linking. Opening the QR still requires pressing Send in LINE. |
| Routine LINE use | Persistent identity; no daily relinking. Web login and transaction action expiry remain separate. |
| Budget shortcut | Read current owner-scoped budgets and signed exact ledger spending; show period, cap, spent, remaining/over-limit and currency-review gaps. Do not add overlapping caps together. |
| Other shortcuts | Balances, pending reviews, entry guidance and help. No financial posting without the existing explicit confirmation boundary. |

The backend returns a QR only when a valid bot basic ID is configured. A channel
ID or webhook destination is not a user-facing bot ID. Missing bot configuration
retains the copy-command fallback and explains how to enable QR onboarding.

## Acceptance

1. A newly issued setup challenge remains valid after 20 hours, expires after
   its configured 24 hours, cannot be reused, and is superseded by renewal.
2. QR and direct link encode the same intended bot and command. The challenge
   response is private/no-store. No capability enters repository artifacts.
3. The UI exposes expiry and recovery, polls only during active setup, and clears
   setup state when linked or when the owner changes. Keyboard and narrow-phone
   controls remain usable.
4. A linked owner remains connected beyond a day; a revoked identity remains
   rejected. Financial confirmation capability expiry is not extended.
5. `budget`/`budgets` and the rich-menu budget action show only the linked owner's
   active budgets. Ledger amounts retain integer-satang arithmetic. Unconfirmed
   historical currency is explicitly excluded from a definitive remaining cap.
6. Help and pending-review shortcuts do not create financial drafts. The old
   `trips` menu code remains compatible.
7. Templates remain inactive and credential-free. Provisioning, stable phone web
   access and resumed phone acceptance remain distinct operator steps.

## Sequence and verification

The first unblocker is the clarified setup lifetime (now confirmed by the owner).
Implement API contract and bounded budget reads, then the existing connection
panel and menu assets. The primary agent owns these sequential changes; no extra
agents were requested. Run focused expiry/renewal/identity/owner/budget checks,
frontend type validation and a scoped visual/interaction check where the resource
budget permits. Existing unrelated source is backed up before edits.

Read-only check on 25 October found the Pi reachable, n8n healthy, both dedicated
pilot workflows inactive, and retained Aegis pilot containers running. This does
not prove current public-webhook or handset delivery. No workflow was activated.
Do not repeat the previous concurrent Kali pytest/Next/n8n wave.

## Rollout and rollback

There is no schema migration. Revert only this feature's patch to roll source
back, preserving prior work. Existing issued challenges keep their stored expiry;
the new lifetime applies to newly generated challenges. Configure the verified
bot basic ID and deploy/test the reviewed source separately before publishing a
rich menu or resuming the paused fictional pilot. Keep the owner-selected bot
separate from other LINE assistants. No production financial cutover is included.

## Primary platform references

Checked 25 October 2026:

- [LINE prefilled Official Account chat URLs](https://developers.line.biz/en/docs/line-login/using-line-url-scheme/).
- [Rich menu creation, image upload and activation](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/).
- [LINE account-linking mechanism](https://developers.line.biz/en/docs/messaging-api/linking-accounts/).

The existing Aegis link challenge is application-issued. LINE's own link token
expiry is not changed by the application's 24-hour setting. Native LINE account
linking is a separate possible future replacement, not implemented here.
