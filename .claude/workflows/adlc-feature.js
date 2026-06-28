export const meta = {
  name: 'adlc-feature',
  description:
    'Run the automatable span of the Aegis ADLC for one feature: Plan -> (Design) -> Build -> Verify -> Review. The Design gate escalates on failure; the Verify and Review gates are bounded loop-backs to Build, and Review blockers are adversarially verified. Stops before Ship (a human/CI gate) and returns a PR-ready package. See docs/adlc.md.',
  phases: [
    { title: 'Plan' },
    { title: 'Design' },
    { title: 'Build' },
    { title: 'Verify' },
    { title: 'Review' },
    { title: 'Package for Ship' },
  ],
}

// args = {
//   feature:    'budget templates (50/30/20)',      // required
//   acceptance: ['user can adopt a template', 'idempotent on re-adopt'],
//   needsDesign: false,   // true -> run a gated Design (ADR) phase before Build
//   maxRounds:   2,       // bounded Build <-> gate retries before escalating
// }
// args may arrive as an object or, depending on the caller, as a JSON string — normalize.
const A = typeof args === 'string' ? JSON.parse(args || '{}') : args || {}
const feature = A.feature
if (!feature) {
  log('adlc-feature: no feature provided. Pass args { feature, acceptance, needsDesign?, maxRounds? }.')
  return { error: 'missing args.feature' }
}
const acceptance =
  (A.acceptance || []).map((a, i) => `AC${i + 1}: ${a}`).join('\n') || '(none specified — derive from the brief)'
const maxRounds = A.maxRounds || 2

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

// A skeptic's verdict on a single Review blocker (adversarial verification).
const VERDICT = {
  type: 'object',
  properties: { real: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['real'],
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

// ---- Design (conditional, gated) ------------------------------------------
// docs/adlc.md section 2: Design output must be reviewed before Build consumes it.
let design = null
if (A.needsDesign) {
  phase('Design')
  design = await agent(
    `Write a docs/design ADR sketch for "${feature}": Status, Context, an options table with a chosen ` +
      `option + reason, an architecture sketch, and a reversible migration/rollback story. Read docs/design/ ` +
      `for the house format.`,
    { phase: 'Design' },
  )
  // Design gate: a separate agent reads the ADR cold; escalate (don't proceed) on failure.
  const designGate = await agent(
    `ADLC Design gate for "${feature}". You did NOT write this ADR — read it cold and confirm it has a ` +
      `chosen option WITH a stated reason, a reversible migration/rollback story, and Status no longer ` +
      `"draft". pass=true only if all hold; list every blocker.\n\nADR:\n${design}`,
    { phase: 'Design', schema: GATE, effort: 'high' },
  )
  if (!designGate || !designGate.pass) {
    log('Design gate FAILED — escalating before Build')
    return {
      feature,
      gatesPassed: false,
      stoppedAt: 'Design',
      blockers: (designGate && designGate.blockers) || ['unknown'],
      brief,
      design,
      shipNote: 'Design gate failed — fix the ADR before re-running; do not proceed to Build.',
    }
  }
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

  // Review gate: an independent reviewer (not the implementer) raises blockers;
  // each is then adversarially verified (refute-by-default) before it can fail
  // the gate — mirroring docs/adlc.md section 5 and the conformance checklist.
  phase('Review')
  const reviewRaw = await agent(
    `ADLC Review for "${feature}". You did NOT implement this — review the working-tree diff cold for ` +
      `correctness, lane discipline, migration reversibility, reuse/simplification, AND the conditional ` +
      `PM per-PR gates: if AI (backend/app/services/ai_engine.py) is touched, prompt-cache keys are reviewed ` +
      `and the cost diff estimated; if a button / route / modal changed, UX sign-off is noted. ` +
      `List every blocker as a requested change.`,
    { label: `review:round-${round}`, phase: 'Review', schema: GATE, effort: 'high' },
  )
  // Adversarial verify: keep only blockers a skeptic cannot refute (null = keep, fail-safe).
  const rawBlockers = (reviewRaw && reviewRaw.blockers) || []
  const verified = (
    await parallel(
      rawBlockers.map(b => () =>
        agent(
          `Adversarially verify this Review blocker for "${feature}". Try to REFUTE it against the actual ` +
            `diff; set real=false if it does not hold. Blocker: ${b}`,
          { label: `review-verify:round-${round}`, phase: 'Review', schema: VERDICT },
        ).then(v => ({ blocker: b, real: !v || v.real !== false })),
      ),
    )
  ).filter(Boolean)
  const realBlockers = verified.filter(x => x.real).map(x => x.blocker)
  reviewGate = { pass: realBlockers.length === 0, blockers: realBlockers }
  if (!reviewGate.pass) {
    feedback = `Review requested changes (adversarially confirmed): ${realBlockers.join('; ')}`
    log(`Round ${round}: Review gate — ${realBlockers.length} confirmed blocker(s) -> back to Build`)
    continue
  }

  log(`Round ${round}: Verify PASS and Review PASS (blockers refuted or none raised) — gates green`)
  break
}

// ---- Package for Ship (Ship itself is a human/CI gate, outside this script) -
phase('Package for Ship')
const gatesPassed = Boolean(verifyGate && verifyGate.pass && reviewGate && reviewGate.pass)
const prDescription = await agent(
  `Summarize this ADLC run of "${feature}" into a PR-ready description: what changed, how each acceptance ` +
    `criterion is met, the migration (if any) and its reversibility, and any follow-ups for the Improve phase.\n` +
    `Brief:\n${brief}\nVerify:\n${JSON.stringify(verifyGate)}\nReview:\n${JSON.stringify(reviewGate)}`,
  { phase: 'Package for Ship' },
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
