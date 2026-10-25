# Meridian sign-in

Historical first iteration. The owner subsequently requested dedicated login
research and another redesign while preserving Aegis identity. The current
direction and evidence are in [the login research](2026-09-28-login-research/references.md).

Date: 2026-09-28. Owner request: redesign sign-in immediately after selecting
and reviewing Direction A for the landing. This extends the selected direction;
it does not reopen art direction or redesign account registration.

## Design

Retain Aegis's unmodified icon, charcoal/warm-white/amber/teal palette and
Syne/Inter roles from [009](009-meridian-landing.md). Apply the DravenIQ-inspired
product profile: stable controls, opaque surfaces, clear focus, no decorative
autoplay. Reuse the already captured Sunsama/Daybridge planner storytelling and
Actual ownership restraint in the [reference study](2026-09-28-landing-exploration/02-references.md).
The left panel contains a visibly illustrative sequence of plans, not personal
financial data. On mobile, prioritize the form and omit the secondary story.

The current implementation had a decorative comet, an invented member quote,
personal sync/growth claims before authentication, and a forgotten-password link
that navigated to registration. The redesign removes those claims and misleading
link. No password-reset endpoint was found in the existing auth router; this work
does not invent a recovery service or add another authentication method.

## Behavior and scope

- Server-rendered page shell with a small client form; existing email and Google
  auth API calls, httpOnly session mechanism, user store and `/` destination.
- Existing Google widget remains conditional on its configured client ID.
- Email/current-password autofill, required/type validation, password reveal,
  guarded submissions, pending feedback, focused announced error summary and
  retry without clearing entered values.
- Sign-in renders before the AuthGate mount check with controls disabled until
  hydration. JavaScript-disabled users see the form and explanation; credentials
  cannot fall through into a native GET submission. Authenticated redirects
  still follow the existing guard after hydration.
- Navigation returns to the landing, account registration or documentation.
- Sign-in is excluded from the shell's decorative backdrop; unrelated pages,
  backend auth and existing LINE integration work are preserved.

Source: `frontend/src/app/login/page.tsx`, `login-form.tsx`, `login.module.css`;
narrow integration edits to AuthGate and Backdrop. No new dependency.

Validation and known limits: [local verification](../validation/2026-09-28-meridian-sign-in/README.md).
Before-change local backups: `/tmp/aegis-before-sign-in-2026-09-28/`.
This is a local implementation, not a deployment or owner acceptance of the final screen.
