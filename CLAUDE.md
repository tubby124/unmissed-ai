# Unmissed.ai — Claude Code Router

This file is intentionally thin.
Use imported rules and commands instead of bloating this file.

## Repo identity
- Product: unmissed.ai
- Goal: safe phased development of a live voice-agent SaaS
- This repo is not a rewrite target
- Preserve working behavior unless the task explicitly changes it
- Prefer runtime truth over prompt polish
- Frontend is the control plane, not decorative UI

## Required project context

Read these before making architecture or control-plane changes:

@docs/architecture/control-plane-mutation-contract.md
@docs/architecture/per-call-context-contract.md
@docs/architecture/call-path-capability-matrix.md
@docs/architecture/webhook-security-and-idempotency.md

- `clients.tools` is runtime tool truth for production calls — not the Ultravox stored agent tools.
- Per-call context (hours, caller phone, after-hours state) must not be stored as long-lived prompt truth.
- Do not add new capability logic in two separate places (`buildCapabilityFlags` + `buildAgentTools` must stay in sync).
- Webhook hardening (fallback sig + voicemail idempotency) is already applied — do not redo that pass.

## Read these imported rules
@.claude/rules/core-operating-mode.md
@.claude/rules/prompt-edit-safety.md
@.claude/rules/command-routing.md
@.claude/rules/unmissed-domain.md
@.claude/rules/refactor-phase-tracker.md
@.claude/rules/learning-loop.md
@.claude/rules/drift-detection-pattern.md

## Fast routing
- If the task matches an existing slash command, use that path instead of improvising.
- If the task is a sync/path-parity/runtime-truth investigation, use the truth-tracer or drift-detector agent.
- If the task touches prompt behavior, prompt files, or Ultravox behavior, obey prompt-edit-safety first.

## Dual pipeline architecture (audited 2026-04-10)

Two distinct prompt generation pipelines coexist:
- **Slot pipeline** (`src/lib/prompt-slots.ts`): 21 composable slots, used by all non-voicemail niches. Patchers do targeted regex replacement on section headers.
- **Voicemail pipeline** (`src/lib/prompt-niches/voicemail-prompt.ts`): standalone `buildVoicemailPrompt()` for voicemail/message_only clients. Different section headers than slot pipeline.
- **Settings patchers** (`src/lib/prompt-patcher.ts`): 10 regex-based patchers. 7 silently no-op on voicemail because they target slot-pipeline headers that don't exist in voicemail prompts.
- **voicemailFullRebuild** (`src/lib/settings-patchers.ts`): workaround that detects voicemail clients and does a full rebuild instead of running surgical patchers.

**RULE: Every prompt-affecting change must be tested on BOTH a voicemail AND a slot-pipeline client.** A patcher that works on slot-pipeline prompts may silently no-op on voicemail. The rebuild compensates but is fragile.

## Central write chokepoint

- `PATCH /api/dashboard/settings` is the gateway for almost all dashboard writes
- Field classification via `FIELD_REGISTRY` in `src/lib/settings-schema.ts` — fields are `PROMPT_AFFECTING` or `RUNTIME_ONLY`
- Prompt-affecting fields trigger `applyPromptPatches()` → Ultravox sync
- Runtime-only fields write to DB only, no prompt change, no Ultravox sync
- `usePatchSettings` hook serializes concurrent calls per-client to prevent prompt race conditions

## Pre-ship checklist (apply before EVERY feature ship)

1. **Silent-save check** — grep every reader of the storage row. Does at least one consumer read the new field?
2. **Phantom data check** — does the field change downstream behavior, or is it write-only dead weight?
3. **Orphan code check** — is the component reachable from live nav? `grep -r "import.*YourComponent" src/` and confirm chain leads to live route.
4. **Dual pipeline check** — works on BOTH voicemail AND slot clients? Test at least one of each.
5. **Rule dilution check** — if adding prompt rules, is prompt already >10K chars? Compress first.
6. **Test coverage check** — at least one test that asserts end-to-end plumbing (data reaches the prompt).
7. **Trial/paid parity check** — works identically for both?

## Key files (prompt pipeline)

- `src/lib/slot-regenerator.ts` — `clientRowToIntake()` maps DB row → intake shape for regeneration
- `src/lib/settings-patchers.ts` — patcher orchestration + `voicemailFullRebuild()`
- `src/lib/prompt-builder.ts` — pipeline routing (VM vs slot)
- `src/lib/prompt-slots.ts` — slot pipeline (21 composable slots)
- `src/lib/prompt-niches/voicemail-prompt.ts` — voicemail standalone builder
- `src/lib/agent-context.ts` — runtime per-call injection (hours, caller info, injected_note)
- `src/app/api/dashboard/settings/route.ts` — central PATCH handler
- `src/lib/settings-schema.ts` — `FIELD_REGISTRY` (classifies fields)

## Standing rules
- One narrow phase at a time.
- Do not mix provisioning, runtime/tooling, and broad UI refactors in one pass unless explicitly requested.
- Stop after each phase and summarize files changed, tests run, risks, and next step.
- Keep diffs narrow and reviewable.
- **Never use `.single()` on `client_users` queries** — admins have multiple rows. Use `.limit(1).maybeSingle()` instead.
- **Services/business-summary edits patch only their owned prompt block** — never rewrite arbitrary full-prompt prose. Use `lib/prompt-patcher.ts` section patching, not a full prompt replacement.
- **Knowledge changes must follow ingest → review → approve → searchable truth**; `buildKnowledgeSummary()` / `business_facts` are downstream prompt surfaces, not the knowledge source of truth — `knowledge_chunks` with `status='approved'` is.
- **Auth redirect URL routing**: password recovery links must use `/auth/confirm`; invite/signup/setup links use `/auth/callback`.
