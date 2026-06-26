export const meta = {
  name: 'adlc-feature',
  description:
    'Run the automatable span of the Aegis ADLC for one feature: Plan -> (Design) -> Build -> Verify -> Review, with the Verify and Review gates enforced as bounded loop-backs to Build. Stops before Ship (a human/CI gate) and returns a PR-ready package. See docs/adlc.md.',
  phases: [
    { title: 'Plan' },
    { title: 'Design' },
    { title: 'Build' },
    { title: 'Verify' },
    { title: 'Review' },
    { title: 'Package' },
  ],
}

// args = {
//   feature:    'budget templates (50/30/20)',      // required
//   acceptance: ['user can adopt a template', 'idempotent on re-adopt'],
//   needsDesign: false,   // true -> run a Design (ADR) phase before Build
//   maxRounds:   2,       // bounded Build <-> gate retries before escalating
// }
const feature = args && args.feature
if (!feature) {
  log('adlc-feature: no args.feature provided. Pass { feature, acceptance, needsDesign?, maxRounds? }.')
  return { error: 'missing args.feature' }
}
const acceptance =
  (args.acceptance || []).map((a, i) => `AC${i + 1}: ${a}`).join('\n') || '(none specified — derive from the brief)'
const maxRounds = args.maxRounds || 2

// A gate verdict: pass + the blockers that must be fixed to flip it green.
const GATE = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    blockers: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['pass', 'blockers'],
}

// ---- Plan -----------------------------------------------------------------
phase('Plan')
const brief = await agent(
  `You are the Aegis PM (see the project-manager skill). Write the ADLC Plan brief for: ${feature}.\n` +
    `Acceptance:\n${acceptance}\n\n` +
    `Output: goal, observable acceptance criteria, role assignments with file owners ` +
    `(backend -> backend/app/, frontend -> frontend/src/), the single unblocking step, risks, and ` +
    `out-of-scope. Under 300 words.`,
  { agentType: 'Plan', phase: 'Plan' },
)

// ---- Design (conditional) -------------------------------------------------
let design = null
if (args.needsDesign) {
  phase('Design')
  design = await agent(
    `Write a docs/design ADR sketch for "${feature}": Status, Context, an options table with a chosen ` +
      `option + reason, an architecture sketch, and a reversible migration/rollback story. Read docs/design/ ` +
      `for the house format.`,
    { phase: 'Design' },
  )
}

// ---- Build -> Verify -> Review, with the gates wired as bounded loop-backs -
let round = 0
let build = null
let verifyGate = null
let reviewGate = null
let feedback = ''

while (round < maxRounds) {
  round += 1

  phase('Build')
  build = await agent(
    `ADLC Build round ${round} for "${feature}".\nBrief:\n${brief}\n` +
      (design ? `Design:\n${design}\n` : '') +
      (feedback ? `\nAddress this prior-round gate feedback FIRST:\n${feedback}\n` : '') +
      `\nImplement behind the contract. Lane discipline: backend -> backend/app/, frontend -> frontend/src/. ` +
      `A schema change requires a reversible, batch-mode-safe Alembic migration. ` +
      `Return a punch list of files changed.`,
    { label: `build:round-${round}`, phase: 'Build' },
  )

  // Verify gate: green tests AND observed behavior, or back to Build.
  phase('Verify')
  verifyGate = await agent(
    `ADLC Verify gate for "${feature}". Run \`make test\` and report pass/fail with the failing assertions. ` +
      `Then confirm each acceptance criterion is observable and describe the curl/browser step that shows it:\n` +
      `${acceptance}\n\npass=true ONLY if tests are green AND every criterion is observably met. ` +
      `List every blocker that keeps it red.`,
    { label: `verify:round-${round}`, phase: 'Verify', schema: GATE, effort: 'high' },
  )
  if (!verifyGate || !verifyGate.pass) {
    feedback = `Verify gate failed: ${((verifyGate && verifyGate.blockers) || ['unknown']).join('; ')}`
    log(`Round ${round}: Verify gate FAILED -> back to Build`)
    continue
  }

  // Review gate: independent reviewer (not the implementer), or back to Build.
  phase('Review')
  reviewGate = await agent(
    `ADLC Review gate for "${feature}". You did NOT implement this — review the working-tree diff cold for ` +
      `correctness, lane discipline, migration reversibility, and reuse/simplification. Apply the per-PR gates ` +
      `from the project-manager skill.\n\npass=true ONLY if there are no blocking correctness issues. ` +
      `List every blocker as a requested change.`,
    { label: `review:round-${round}`, phase: 'Review', schema: GATE, effort: 'high' },
  )
  if (!reviewGate || !reviewGate.pass) {
    feedback = `Review requested changes: ${((reviewGate && reviewGate.blockers) || ['unknown']).join('; ')}`
    log(`Round ${round}: Review gate requested changes -> back to Build`)
    continue
  }

  log(`Round ${round}: Verify PASS and Review PASS — gates green`)
  break
}

// ---- Package for Ship (Ship itself is a human/CI gate, outside this script) -
phase('Package')
const gatesPassed = Boolean(verifyGate && verifyGate.pass && reviewGate && reviewGate.pass)
const prDescription = await agent(
  `Summarize this ADLC run of "${feature}" into a PR-ready description: what changed, how each acceptance ` +
    `criterion is met, the migration (if any) and its reversibility, and any follow-ups for the Improve phase.\n` +
    `Brief:\n${brief}\nVerify:\n${JSON.stringify(verifyGate)}\nReview:\n${JSON.stringify(reviewGate)}`,
  { phase: 'Package' },
)

return {
  feature,
  gatesPassed,
  rounds: round,
  brief,
  design,
  build,
  verify: verifyGate,
  review: reviewGate,
  prDescription,
  shipNote: gatesPassed
    ? 'Gates green. Ship is a human/CI gate: commit on the feature branch, open a draft PR, drive CI to green.'
    : `Gates NOT green after ${maxRounds} round(s). Do not ship — escalate the blockers to the main thread.`,
}
