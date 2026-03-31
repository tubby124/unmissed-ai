---
type: decision
status: active
date: 2026-03-31
tags: [architectural, prompt-builder, execution-plan]
related: [[Tracker/D280]], [[Tracker/D285]], [[Tracker/D274]], [[Tracker/D268]], [[Tracker/D265]], [[Tracker/D269]], [[Tracker/D272]], [[Tracker/D260]], [[Tracker/D281]], [[Tracker/D282]], [[Tracker/D283]], [[Tracker/D278]], [[Tracker/D276]], [[Decisions/User Designs Prompt]]
updated: 2026-03-31
---

# Decision: Prompt Architecture Refactor — 6 Gated Phases

## Context
The current prompt system is a monolithic 12-18K char template (`template-body.ts`) built by `buildPromptFromIntake()` (829 lines) with 9 post-build patchers. This causes:
- Prompts exceeding the 12K GLM-4.6 limit for some niches
- Hardcoded business logic overriding user data
- Duplicate knowledge in prompt + pgvector
- No way for users to see/edit what their agent knows
- Service catalog edits being dead data (D260)

## Decision
Progressive slot extraction over 6 gated phases, NOT a rewrite. Each phase:
1. Runs Sonar Pro research BEFORE code changes
2. Extracts sections into named slot functions
3. Tests byte-identical output via shadow tests
4. Updates Obsidian tracker notes on completion
5. Writes a handoff before moving to next phase

## Key Constraints
- **No redeployment** to 4 working clients (hasan-sharif, exp-realty, windshield-hub, urban-vibe)
- New architecture applies to **new clients only** (test with e2e-test-plumbing-co)
- Existing clients can opt-in to migration later
- D277 (plumber lag) removed — architecture fix solves it structurally

## Phase Summary
| Phase | D-items | What it does |
|-------|---------|-------------|
| 1 | D235, D285 | Foundation: sandwich spec + golden tests + reseed fix |
| 2 | D274 | Named slot functions + shadow tests (byte-equal) |
| 3 | D265, D269, D272, D268 | Shrink prompts 12-18K → 4-7K, conditional rules |
| 4 | D260, D281, D282 | Wire service/name edits to live agent (parallel) |
| 5 | D283 | Variable registry + dashboard visibility + auto-patch |
| 6 | D280, D278, D276 | Recompose engine + Agent Brain + calendar-aware triage |

## Execution Plan
Full copy-paste prompts per phase: `docs/architecture/prompt-architecture-execution-plan.md`
Phase tracker: `.claude/rules/refactor-phase-tracker.md`

## Alternatives Considered
- **Full rewrite:** Too risky for a live production system with paying clients. Progressive extraction preserves working behavior.
- **Redeploy to all clients:** Rejected — 4 clients work perfectly. Risk of regression with no upside.
- **Keep monolith + patch:** Band-aid approach. Doesn't solve the fundamental problem of prompts growing unbounded.

## Success Criteria
- No prompt exceeds 12K chars
- Average prompt 4-7K (was 12-18K)
- Service/name edits flow to live agent
- Every variable visible on Agent Brain dashboard
- Non-admin users cannot edit raw prompts
- 14 D-items closed
