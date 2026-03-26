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

## Standing rules
- One narrow phase at a time.
- Do not mix provisioning, runtime/tooling, and broad UI refactors in one pass unless explicitly requested.
- Stop after each phase and summarize files changed, tests run, risks, and next step.
- Keep diffs narrow and reviewable.
- **Never use `.single()` on `client_users` queries** — admins have multiple rows. Use `.limit(1).maybeSingle()` instead.
- **Services/business-summary edits patch only their owned prompt block** — never rewrite arbitrary full-prompt prose. Use `lib/prompt-patcher.ts` section patching, not a full prompt replacement.
- **Knowledge changes must follow ingest → review → approve → searchable truth**; `buildKnowledgeSummary()` / `business_facts` are downstream prompt surfaces, not the knowledge source of truth — `knowledge_chunks` with `status='approved'` is.
- **Auth redirect URL routing**: password recovery links must use `/auth/confirm`; invite/signup/setup links use `/auth/callback`.
