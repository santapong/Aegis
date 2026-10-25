# Login-specific research — Aegis

Inspected 28 September 2026. Owner explicitly requested new login references,
another redesign, and preservation of Aegis identity. Earlier landing research
was not login research; the previous sign-in implementation is the baseline.

All six actual signed-out login pages were visually inspected in the visible
in-app browser at 1440 × 1000, with screenshots saved in `references/`. The
Linear email step was opened without entering information. Two immediate
resize captures had scaling artifacts and are excluded from the board and
mobile conclusions. No credentials, registrations or recovery requests were
submitted. The retained desktop captures are composition evidence, not
pixel-perfect masters or Aegis assets.

| Reference | Observed pattern | Transfer to Aegis | Keep out of Aegis |
| --- | --- | --- | --- |
| [Linear](https://linear.app/login) | Dark open canvas, small centered brand mark, compact method stack. Email opens a distinct focused step with a return link. | Tight central focus, strong recognition above the form, little marketing copy. | Purple styling, passkeys/SAML, or an extra email step: Aegis already has a two-field password flow. |
| [Mercury](https://app.mercury.com/login) | A bounded central white card on a quiet neutral background. Email/password have clear labels and password reveal. Secondary passkey help is separated beneath the core form. | Clearly bounded form, stable labels, secondary help below the primary action. | Financial security/banking claims, passkeys or a recovery endpoint Aegis lacks. |
| [Sunsama](https://app.sunsama.com/login) | Compact central card, brand at the top, login/signup choice, provider options separated from email. | Make the current task and signup destination obvious; group real alternatives. | Outlook/SSO and fake tabs that do not navigate. Its automatic challenge resolved without our interaction. |
| [YNAB](https://app.ynab.com/users/sign_in) | Brand fills the surrounding canvas; white login card remains visually distinct. Password visibility and support links sit with the fields. | Let Aegis identity live around a clean access surface; retain visible password controls. | YNAB's outcome statistics, blue/purple identity, Apple login, remembered-session promise or reset link. |
| [Lunch Money](https://my.lunchmoney.app/login) | Dark page with a narrow contrasting panel; recognizable coin art above a brief greeting and email/password fields. Yellow actions carry the brand. | Recognizable Aegis icon, concise greeting and a single amber action. | Coin mascot, animation, patterned wallpaper and copied marketing claims. |
| [Notion](https://app.notion.com/login) | Email-first central column, short purpose/greeting, alternate methods and signup clearly separated; alternate methods and signup follow the primary form. | One obvious primary flow; signup and help stay secondary; mobile follows the same order. | Its providers, consent text, organizational-account requirement and email-code semantics. |

## Three ideas considered

1. **Aegis Focus — owner-approved direction.** Center a compact access panel, place
   the original Aegis mark above the greeting, retain warm text and amber action,
   and use quiet static teal/amber orbital linework outside the panel. Combines
   Linear's focus, Mercury's separation and Lunch Money's brand recognition.
2. **Editorial split.** A large brand statement beside a distinct form, inspired
   by YNAB. Recognizable, but the existing iteration already spends substantial
   space explaining the product to a returning user.
3. **Warm inset.** Ivory form on a charcoal Aegis canvas. Strong separation from
   Mercury/Sunsama, but a bigger departure from the approved Meridian landing.

The HTML reference board includes composition sketches, actual captured pages,
source links and adaptation notes. These are local design materials, not live
authentication forms. On 28 September 2026, after reviewing the board and
implementation, the owner selected **Aegis Focus**: “This one is good.” Preserve
this direction and Aegis identity in subsequent scoped login refinements.

## Identity and implementation contract

Keep the original icon unchanged, AEGIS name, Syne display/Inter interface,
charcoal `#0A0C0E`, warm text `#EDE7DC`, amber `#E8913C`, teal `#2E6B72`.
Orbital linework is a separate background decoration, not a replacement mark.
No animation, bank claims, testimonials or sample financial records on login.
Preserve existing email/Google handlers and tested feedback; no new auth method.
The landing and registration are outside this revision's visual scope.

Structure: home/brand navigation → original icon and welcome → email/password
form with reveal → amber submit → signup link → native help disclosure → quiet
brand tagline and documentation. On compact screens remove the surrounding art
and unnecessary card framing while keeping the same form order.
