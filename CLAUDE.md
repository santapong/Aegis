# CLAUDE.md — Aegis harness index

Always-loaded orientation for agents working in this repo. Keep it tiny; depth
lives in the linked docs and skills (progressive disclosure).

**Aegis** is an AI-powered money-management app: **Next.js 15 / React 19**
frontend (`frontend/src/`), **FastAPI / Python 3.11+** backend (`backend/app/`),
multi-DB (SQLite/Postgres/MySQL), Claude/Typhoon/Groq AI, Stripe, WeasyPrint
PDF. Status: **v1.0 GA**. Start with [`README.md`](README.md) and
[`docs/architecture.md`](docs/architecture.md).

## How we build here — the ADLC

Development follows the **Agentic Development Life Cycle**:
Intake → Plan → Design → Build → Verify → Review → Ship → Improve, each phase
owned by a harness primitive. **Read [`docs/adlc.md`](docs/adlc.md)** for the
loop and its gates; **[`docs/harness-engineering.md`](docs/harness-engineering.md)**
for how the harness itself is built.

Match ceremony to blast radius: a 1-file fix is Build → Verify → Ship; a
multi-area feature runs the full loop with agents fanned out. **Gates are not
optional** — never skip Verify (run it, don't just test it) or Ship (CI green).

## Skills (trigger by phrase or `/<name>`)

| Skill | Reach for it when |
|-------|-------------------|
| [`project-manager`](.claude/skills/project-manager/SKILL.md) | sizing a team, writing a brief, the improvement cadence (ADLC Plan + Improve) |
| [`multi-agent-orchestration`](.claude/skills/multi-agent-orchestration/SKILL.md) | exploratory fan-out across backend/frontend/AI (ADLC Build) |
| [`workflow`](.claude/skills/workflow/SKILL.md) | deterministic orchestration — a known list through fixed stages, loops, pipelines |
| [`frontend-design-team`](.claude/skills/frontend-design-team/SKILL.md) | visual / design-system work (ADLC Design) |
| [`aegis-troubleshooting`](.claude/skills/aegis-troubleshooting/SKILL.md) | stack-up, build, Docker, or auth bugs from a fresh checkout |

`/verify`, `/code-review`, `/run`, `/claude-api` are the gate + reference skills.

## Commands

```sh
make setup     # idempotent .env + JWT secret
make dev       # hot-reload stack          make test   # backend pytest
make migrate   # alembic upgrade head      make seed   # demo@aegis.local / demo-password-123
make backend   # uvicorn --reload          make frontend  # bun run dev
```

## Guardrails

- **Branch:** develop on the feature branch named in the task / session
  instructions; **never push to `main`**. Push with `-u origin <branch>`, then
  open a **draft PR**.
- **Lanes:** backend agents touch `backend/app/`, frontend agents touch
  `frontend/src/`, the design-system Steward alone owns
  `frontend/src/app/globals.css`. No cross-lane drift.
- **Schema change ⇒ a reversible Alembic migration** (batch-mode for SQLite
  parity).
- **Auth:** JWT (HS256) in the httpOnly `aegis_session` cookie; **no JWT in
  localStorage**. Trust `curl` over the UI when debugging auth.
- **AI model changes** in `backend/app/services/ai_engine.py` go through the
  `claude-api` skill (review prompt-cache keys, estimate cost diff).
- **Docs/process:** every shipped change updates `CHANGELOG.md` `[Unreleased]`;
  new architecture/data-model/UI decisions get a `docs/design/NNN-*.md`.
- **Changing the harness** (skills, agents, workflows, hooks): follow
  [`docs/harness-engineering.md`](docs/harness-engineering.md); use
  `update-config` for `settings.json`.
