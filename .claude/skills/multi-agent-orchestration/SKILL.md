---
name: multi-agent-orchestration
description: Coordinate a team of specialized Claude sub-agents (PM, backend, frontend, QA, DevOps, AI/UX) to deliver Aegis features in parallel. Trigger when the user asks to "orchestrate", "split this across agents", "have the team work on", "delegate to roles", or kicks off a multi-area task (e.g. spans both backend and frontend, or includes design + implementation + tests).
---

# Multi-Agent Orchestration for Aegis

This skill turns a single user request into a **coordinated, parallel plan** executed by specialized sub-agents (spawned with the `Agent` tool) instead of one linear thread.

Use it whenever a task spans more than one concern (backend + frontend, design + impl, impl + tests, infra + app, etc.) or whenever the user explicitly asks for a "team" / "roles" / "orchestration".

---

## When to invoke

Trigger this skill when:

- The user says "orchestrate", "delegate", "split across agents", "have the team handle X".
- A request touches two or more of: backend, frontend, database/migrations, AI prompts, UX, DevOps, tests.
- The request is large enough that linear execution would blow context (e.g. "implement feature X end-to-end").

Skip this skill for single-file edits, simple Q&A, or pure exploration.

---

## The team (role catalog)

Each role maps to a sub-agent invocation. Pick the smallest set that covers the work.

| Role | Subagent type | Responsibilities |
|------|---------------|------------------|
| **Project Manager (PM)** | `general-purpose` (or this skill's `project-manager` skill) | Decomposes work, assigns roles, tracks acceptance criteria, writes the rollout checklist. **Always the first agent on multi-area tasks.** |
| **Backend Engineer** | `general-purpose` | FastAPI routers, SQLAlchemy models, Alembic migrations, Pydantic schemas, services in `backend/app/`. |
| **Frontend Engineer** | `general-purpose` | Next.js pages/components, Zustand stores, React Query hooks, Tailwind/shadcn UI in `frontend/src/`. |
| **QA / Test Engineer** | `general-purpose` | Pytest in `backend/tests/`, smoke flows, regression checks; reports failing assertions with file:line. |
| **DevOps Engineer** | `general-purpose` | Docker / compose / Caddyfile / GitHub Actions / `.env.example`. |
| **AI / Prompt Engineer** | `claude-code-guide` for SDK Qs, otherwise `general-purpose` | `services/ai_engine.py`, Anthropic SDK calls, prompt caching, tool_use schemas. Should pull in the `claude-api` skill. |
| **UX Reviewer** | `general-purpose` | Reviews flows in the browser, flags redundant redirects, dead buttons, accessibility issues. |
| **Code Reviewer** | `general-purpose` (or `/review`) | Second-pair-of-eyes pass before commit. Independent of the implementer. |
| **Research / Explorer** | `Explore` | Read-only codebase search ("where is X defined", "what calls Y"). Cheap, fast — use liberally. |
| **Planner** | `Plan` | Architectural plan for a single subsystem before implementation starts. |

---

## Orchestration patterns

### Pattern A — Fan-out / fan-in (default for features)

1. **PM agent** writes a one-page brief: goal, acceptance criteria, role list, file owners, sequencing notes. Returns to main thread.
2. **Main thread** spawns implementer agents **in parallel** (single message, multiple `Agent` tool blocks) for independent pieces.
3. **Main thread** spawns **QA + Code Reviewer in parallel** once implementers report done.
4. **Main thread** integrates feedback, runs `make test`, commits, pushes, opens PR.

### Pattern B — Pipeline (when there are hard dependencies)

Use when later roles depend on artifacts from earlier ones (e.g. backend API contract must exist before frontend can call it).

1. Planner agent → contract (Pydantic schema + endpoint signature).
2. Backend agent → implements behind the contract.
3. Frontend agent + QA agent → start in parallel against the contract once it's frozen.

### Pattern C — Bug triage swarm

For "something is broken, find it":

1. **Explore** agents in parallel: one searches for the symptom string, one searches for the suspected component, one reads the recent commit log.
2. Main thread synthesizes findings, picks the implementer role, hands off.

---

## How to spawn the team (rules)

- **Parallelism rule:** if agent calls are independent, put them in a **single message with multiple `Agent` tool uses**. Sequential calls only when later ones consume earlier output.
- **Self-contained prompts:** each agent starts cold. Tell it the goal, the relevant files, what's already known, and what shape of output you want.
- **Budget the response:** ask for short reports ("under 200 words", "punch list, done vs missing") so context returns clean.
- **Trust-but-verify:** after an agent reports done, read the actual diff before marking the work complete.
- **Don't double-search:** if you delegated research to an Explore agent, don't grep the same thing yourself.
- **Role-locking:** an agent should not modify files outside its lane unless explicitly authorized (e.g. backend agent shouldn't reshape Tailwind classes).

---

## Skeleton invocation (PM + parallel implementers)

Step 1 — PM first:

```
Agent(subagent_type="general-purpose", description="PM plan for <feature>",
  prompt="You are the PM for Aegis. Goal: <user goal>. Read README.md and ROADMAP.md.
          Produce: (1) acceptance criteria, (2) role assignments (backend/frontend/QA/...),
          (3) file owners, (4) sequencing notes, (5) risks. <300 words.")
```

Step 2 — fan out implementers in one message:

```
Agent(subagent_type="general-purpose", description="Backend: <slice>", prompt="...")
Agent(subagent_type="general-purpose", description="Frontend: <slice>", prompt="...")
Agent(subagent_type="Explore",         description="Research: <topic>", prompt="...")
```

Step 3 — QA + Reviewer in parallel after implementers report done.

Step 4 — main thread integrates, runs tests, commits, pushes, opens **draft PR**.

---

## Output checklist (every orchestration ends with this)

- [ ] PM brief saved or summarised in the PR description.
- [ ] Each role's diff scoped to its lane (no cross-lane drift).
- [ ] `make test` green (or failing tests called out explicitly).
- [ ] PR opened as draft on `claude/multi-agent-orchestration-C03q9` with role-by-role summary.
- [ ] Follow-ups captured in `ROADMAP.md` post-v1.0 section or filed as issues.

---

## Anti-patterns

- ❌ Spawning agents serially when they could run in parallel.
- ❌ Vague prompts ("fix the bug") — always include the suspected file:line.
- ❌ Letting an implementer also self-review — always use a separate Code Reviewer.
- ❌ Skipping the PM step on a feature that touches 3+ areas.
- ❌ Pushing to anything other than the branch in `CLAUDE.md` / system instructions.
