# Unmissed Master Refactor Runbook

## Purpose

This file is the single source of truth for the safe refactor of the Unmissed app.

Use it to:
- preserve the current working system
- refactor in phases without breaking live behavior
- keep prompt logic, runtime logic, onboarding, and provisioning separated
- use `hasan-sharif` as the canary client first
- force stop/review gates between phases

This is **not** an autopilot script for a full-system rewrite.
It is a controlled execution runbook.

---

## Non-Negotiable Rules

1. Execute **one phase at a time only**
2. Start with **Phase 0 Freeze**
3. Use **hasan-sharif** as the canary client unless explicitly told otherwise
4. Do **not** touch all niches at once
5. Do **not** change provisioning unless the current phase explicitly allows it
6. Do **not** change runtime behavior unless the current phase explicitly allows it
7. Do **not** rewrite bespoke niche builders early
8. Keep diffs narrow and reviewable
9. Add tests before or with behavior changes
10. Stop after every phase and summarize:
   - files changed
   - tests added or updated
   - risks
   - exact next phase to run

---

## Current Architectural Direction

The target architecture is six layers:

### 1. Base Prompt
Behavioral rules only:
- role
- tone
- one-question rule
- truthfulness
- emergency behavior
- after-hours behavior
- close / handoff rules

### 2. Structured Business Config
Stable business configuration:
- business name
- niche
- contact details
- hours
- timezone
- service area
- after-hours behavior
- emergency settings
- booking settings
- notification settings
- assistant persona name
- capability flags

### 3. Knowledge Summary
Short always-safe injected summary:
- 5 to 15 key facts max
- high-signal business facts
- small enough to inject every call safely

### 4. Retrieval / Long-Form Knowledge
Longer knowledge source:
- website scrape
- FAQ docs
- policies
- business documents
- long service descriptions
- property management docs

### 5. Runtime Caller Context
Per-call dynamic facts:
- current date/time
- caller phone
- caller name if known
- returning caller info
- after-hours state
- recent call summary
- current call flags

### 6. Tools / Actions
Operational actions:
- booking lookup/book
- save message
- transfer/routing
- notifications
- CRM/system writes
- property management request actions

---

## Critical Architectural Rule: Capability Flags

Do **not** assume every niche supports booking.

Every niche must declare capabilities explicitly.

Example capability model:

```ts
type AgentCapabilities = {
  takeMessages: boolean
  bookAppointments: boolean
  transferCalls: boolean
  useKnowledgeLookup: boolean
  usePropertyLookup: boolean
  useTenantLookup: boolean
  updateTenantRequests: boolean
  emergencyRouting: boolean
}
```

Example expectations:

* `voicemail`: message yes, booking no
* `real_estate`: message yes, booking yes, property lookup yes
* `property_management`: message yes, tenant lookup yes, request ops maybe yes, booking optional
* `other`: message yes, booking optional

Capability flags must exist **before** large AgentContext or prompt refactors.

---

## Canary Rule

Use `hasan-sharif` as the canary first.

Do not expand to other niches until:

* current phase is complete
* tests pass
* risks are summarized
* live behavior remains stable

---

## Freeze / Rollback Requirements

Before refactoring:

* create a branch, such as `freeze/current-working-state`
* create a git tag, such as `pre-agent-context-refactor`
* export current prompt files for live/test clients
* export current Ultravox agent configs
* save a mapping of:

  * client slugs
  * Twilio numbers
  * Ultravox agent IDs
  * niche type
  * bespoke/shared builder path
* snapshot or export key Supabase state if possible:

  * `clients`
  * `intake_submissions`
  * prompt/version tables if present
  * booking/settings tables if present
* run current promptfoo tests as baseline
* record a small live baseline call set

Baseline docs should live under:

`docs/refactor-baseline/`

Recommended files:

* `baseline-architecture.md`
* `baseline-known-risks.md`
* `baseline-client-agent-map.md`
* `baseline-test-plan.md`
* `baseline-live-call-notes.md`

---

## Test Strategy

Every meaningful phase should use some mix of:

### Snapshot Tests

For:

* generated prompts
* AgentContext output
* KnowledgeSummary output
* runtime prompt/context assembly

### Unit Tests

For:

* AgentContext mapping
* capability mapping
* hours and after-hours logic
* emergency gating
* returning caller assembly
* niche-specific fallback logic

### Integration Tests

For:

* onboarding payload to stored config
* settings updates to prompt/context
* runtime webhook to final prompt/context
* booking fallback flow
* message save flow

### Promptfoo / Behavioral Tests

For:

* opener skip if caller already spoke
* one-question rule
* booking flow
* general meeting flow
* unknown answer handling
* AI disclosure
* wrong number handling
* after-hours handling
* explicit emergency only

### Live Call Matrix

Use manual calls for:

* message taking
* property showing booking
* general meeting booking
* unknown question
* interruption
* silence / pause
* after-hours
* "are you AI?"
* wrong number
* returning caller
* explicit emergency
* non-emergency urgent request
* property management intake scenarios

---

## Ship / No-Ship Gate

Do not ship a phase if:

* critical tool flow breaks
* emergency logic fires on silence or noise
* booking loops or lies
* unsupported capability appears in prompt or runtime
* hallucination increases materially
* prompt regressions appear in multiple tests
* naturalness drops badly in live calls

---

## Property Management Rule

Property management is **not** just "RAG".

It must be split into three parts:

### A. Structured Records

For:

* tenants
* units/buildings
* maintenance requests
* categories
* statuses
* notifications

### B. Retrieval / Search

For:

* policies
* building docs
* tenant instructions
* office procedures
* maintenance SOPs
* FAQ content

### C. Controlled Write Actions

For:

* create request
* update request status
* append note
* notify staff
* maybe lookup existing requests

Do not fake property management using only prompt text or loose retrieval.

---

# Phase Execution Prompts

---

## Phase 0 — Freeze + Baseline

```text
I need you to preserve the current working state of this app before any refactor.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Identify the current architecture for:
   - onboarding
   - settings
   - prompt generation
   - runtime inbound call assembly
   - provisioning/deploy
2. Create a baseline inventory of:
   - live client slugs
   - phone numbers
   - Ultravox agent IDs
   - prompt files / prompt sources
   - bespoke niches
3. Add or generate docs under `docs/refactor-baseline/`:
   - baseline-architecture.md
   - baseline-known-risks.md
   - baseline-client-agent-map.md
   - baseline-test-plan.md
4. Add or update:
   - `docs/refactor-master-checklist.md`
5. If possible, document the exact commands or steps needed for:
   - git freeze tag/branch
   - prompt export
   - Ultravox config export
   - Supabase snapshot/export
6. Do not change runtime behavior in this phase.
7. Documentation-first. If code changes are needed, keep them minimal and safe.

Important:
- Quote exact file paths and functions.
- Be explicit about what is live-critical.
- Flag anything unclear instead of guessing.
- Use `hasan-sharif` as the canary reference.
- Stop after completing Phase 0 and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 1A — Capability Flags by Niche

```text
I want to add capability flags by niche before refactoring AgentContext.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Inventory current niches and determine which capabilities each one should support.
2. Introduce an explicit capability model, such as:
   - takeMessages
   - bookAppointments
   - transferCalls
   - useKnowledgeLookup
   - usePropertyLookup
   - useTenantLookup
   - updateTenantRequests
   - emergencyRouting
3. Map capabilities per niche, especially:
   - voicemail
   - real_estate
   - property_management
   - other shared niches
4. Implement the capability structure in the safest place possible without changing live behavior yet.
5. Add tests that ensure disabled capabilities do not accidentally appear in prompt/context logic.
6. Add or update docs describing the niche-to-capability mapping.

Important:
- Do not rewrite prompt behavior yet.
- Do not touch provisioning.
- Do not force all niches into one behavior model.
- Keep `hasan-sharif` as canary.
- Stop after completing Phase 1A and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 1B — Introduce AgentContext

```text
I want to introduce a normalized AgentContext layer without changing live behavior.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Find all current inputs that affect:
   - prompt generation
   - runtime call context
   - settings-driven behavior
2. Design and implement a typed `AgentContext` structure.
3. Add a `buildAgentContext(...)` function that composes current scattered values into one normalized object.
4. Include capability flags in AgentContext.
5. Keep current prompt generation behavior effectively unchanged.
6. Add tests for:
   - required fields
   - fallback/default behavior
   - niche-specific mapping
   - after-hours fields
   - emergency-related fields
   - capability flags
7. Add a short doc mapping old fields to AgentContext.

Important:
- Do not change provisioning in this phase.
- Do not rewrite bespoke niche behavior in this phase.
- Preserve current runtime behavior as closely as possible.
- Use `hasan-sharif` as canary.
- Stop after completing Phase 1B and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 2 — Prompt Builder Refactor to Consume AgentContext

```text
I want the prompt builder to consume AgentContext instead of scattered raw inputs, without changing behavior more than necessary.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Refactor prompt generation so the builder reads from AgentContext.
2. Keep the prompt structure stable for now.
3. Separate prompt responsibilities into:
   - base behavior rules
   - compact business snapshot
   - runtime placeholder(s)
4. Remove obvious duplication only if safe.
5. Respect capability flags so unsupported actions are not described or implied.
6. Add snapshot tests comparing generated prompts before vs after for representative niches.

Important:
- Do not introduce retrieval in this phase.
- Do not rewrite bespoke niche builders unless required for compatibility.
- Preserve current behavior.
- Call out unavoidable diffs clearly.
- Use `hasan-sharif` as canary.
- Stop after completing Phase 2 and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 3 — KnowledgeSummary

```text
I want to reduce prompt bloat safely by introducing a short KnowledgeSummary and keeping long-form knowledge separate.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Identify where scraped website content, FAQ text, docs, or long business facts are being inlined into prompts.
2. Create a `KnowledgeSummary` artifact or field intended for short always-safe facts.
3. Keep long-form knowledge separate from the base prompt path.
4. Update prompt assembly so only the short summary is injected by default.
5. Add tests showing:
   - prompt length stays controlled
   - key knowledge answers still work
   - unknown-answer behavior remains bounded
6. Update docs to show what belongs in:
   - base prompt
   - structured config
   - KnowledgeSummary
   - long-form knowledge

Important:
- Do not fully wire general retrieval into every path unless the implementation already exists cleanly.
- Do not dump raw scraped text into the prompt.
- Keep changes narrow and safe.
- Use `hasan-sharif` as canary.
- Stop after completing Phase 3 and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 4 — Retrieval for Business Knowledge

```text
I want retrieval/search to handle long business knowledge without touching core behavior rules.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Identify the current storage/source for scraped website content, docs, FAQ blocks, or long knowledge.
2. Design and implement a safe retrieval layer for business knowledge only.
3. Keep these concerns out of retrieval:
   - emergency logic
   - booking logic
   - after-hours behavior
   - tone / turn-taking rules
4. Add tests for:
   - relevant answer retrieval
   - bounded unknown answers
   - no hallucinated facts when knowledge is missing
5. Document when runtime should consult retrieval vs rely on the short KnowledgeSummary.
6. For property_management, distinguish:
   - retrieval/search use cases
   - structured record lookup
   - write/update actions

Important:
- Do not turn retrieval into a replacement for core prompt rules.
- Do not mix retrieval with broad provisioning changes.
- Keep `hasan-sharif` as canary unless explicitly expanding scope.
- Stop after completing Phase 4 and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 5 — Niche Delta Cleanup

```text
I want to make niche differences explicit without breaking current working behavior.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Inventory all niches and identify:
   - shared builder path
   - bespoke builder path
   - special runtime rules
   - special booking behavior
   - capability differences
2. Create or update a niche delta map/table in docs.
3. Refactor only enough to make overrides explicit and easier to maintain.
4. Keep bespoke paths deliberate and documented.
5. Add representative tests per niche family.

Important:
- Do not force bespoke niches into the shared path if that risks regression.
- Focus on clarity and isolation, not over-abstraction.
- Keep changes reviewable.
- Use `hasan-sharif` as canary first.
- Stop after completing Phase 5 and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 6 — Provisioning Hardening

```text
I want to harden provisioning without changing product behavior.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Trace the full setup flow:
   - payment/subscription
   - onboarding completion
   - Twilio number purchase/assignment
   - Ultravox agent creation/update
   - Supabase writes
   - prompt deployment
   - any Telegram or notification setup
2. Identify side effects, ordering assumptions, failure points, and orphan-resource risks.
3. Add safeguards where safe:
   - validation
   - idempotency
   - clearer state transitions
   - retry/rollback notes or helpers
4. Add tests for partial failure scenarios if feasible.
5. Document the exact sequence and safe recovery steps.

Important:
- Do not mix this phase with large prompt/runtime logic changes.
- Preserve existing behavior.
- Keep live-critical changes narrow and explicit.
- Stop after completing Phase 6 and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 7 — Property Management Structured Ops

```text
I want property_management to be modeled safely as structured operations, not just prompt text or loose retrieval.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Define the property_management data model boundaries:
   - tenants
   - units/buildings
   - maintenance requests
   - statuses
   - categories
   - notifications
2. Separate three concerns clearly:
   - structured records/system of record
   - retrieval/searchable docs and policies
   - write/update actions
3. Propose or implement a safe first version that does not overreach.
4. Add docs showing what the agent can read, what it can retrieve, and what it can update.
5. Add tests for:
   - tenant lookup behavior
   - maintenance request intake
   - bounded unknown behavior
   - no accidental exposure of unsupported actions

Important:
- Do not fake this with "RAG only."
- Do not let freeform prompt text become the write path.
- Keep this separate from generic niche cleanup if possible.
- Stop after completing Phase 7 and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

## Phase 8 — Live Eval Harness

```text
I want a lightweight live-eval and regression harness for voice-agent changes.

Read and follow this file strictly:
- docs/unmissed-master-refactor-runbook.md

Your job:
1. Create a documented test matrix for manual live calls.
2. Add any safe helper scripts/docs to record:
   - scenario
   - expected behavior
   - actual behavior
   - pass/fail
   - transcript / call ID
3. Organize scenarios by:
   - booking
   - message taking
   - after-hours
   - emergency
   - unknown questions
   - adversarial/weird calls
   - property management
4. Keep it simple and usable.
5. Update the master checklist with live-eval gates.

Important:
- Do not build a huge framework if a documented checklist + small helper is enough.
- Make it easy to use after every phase that changes runtime behavior.
- Stop after completing Phase 8 and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run
```

---

# Refactor Master Checklist

## Phase Progress

* [ ] Phase 0 Freeze complete
* [ ] Phase 1A Capability Flags complete
* [ ] Phase 1B AgentContext complete
* [ ] Phase 2 Prompt Builder consumes AgentContext
* [ ] Phase 3 KnowledgeSummary complete
* [ ] Phase 4 Retrieval complete
* [ ] Phase 5 Niche delta cleanup complete
* [ ] Phase 6 Provisioning hardening complete
* [ ] Phase 7 Property management structured ops complete
* [ ] Phase 8 Live eval harness complete

## Safety

* [ ] freeze branch created
* [ ] freeze tag created
* [ ] prompt exports saved
* [ ] Ultravox config export saved
* [ ] Supabase snapshot/export saved if possible
* [ ] client/phone/agent mapping saved

## Test Gates

* [ ] snapshot tests passing
* [ ] unit tests passing
* [ ] integration tests passing
* [ ] promptfoo passing
* [ ] live canary calls reviewed
* [ ] no critical regressions

## Risk Controls

* [ ] emergency false trigger controlled
* [ ] booking only enabled where capability allows
* [ ] bespoke niches documented
* [ ] prompt size controlled
* [ ] long-form knowledge not blindly injected
* [ ] property management not faked with RAG-only writes

---

# Manual Live Eval Checklist

Use this after runtime-affecting phases.

## Core Scenarios

* [ ] simple message taking
* [ ] property showing booking
* [ ] general meeting booking
* [ ] after-hours message
* [ ] explicit emergency
* [ ] non-emergency urgent request
* [ ] unknown question
* [ ] interruption mid-turn
* [ ] long pause / silence
* [ ] wrong number
* [ ] returning caller
* [ ] "are you AI?"
* [ ] caller changes intent mid-call

## Property Management

* [ ] tenant lookup
* [ ] maintenance request intake
* [ ] request status inquiry
* [ ] unknown tenant/policy question
* [ ] unsupported action correctly bounded

## Call Review Fields

* scenario:
* expected:
* actual:
* call id:
* pass/fail:
* issues:
* follow-up:

---

# First Command to Run in Claude Code

Paste this into Claude Code:

```text
Read and follow `docs/unmissed-master-refactor-runbook.md` strictly.

Rules:
- execute one phase at a time
- start with Phase 0 Freeze
- use hasan-sharif as the canary
- stop after each phase and summarize:
  1. files changed
  2. tests added/updated
  3. risks
  4. exact next phase to run

Begin now with Phase 0 Freeze.
```

---

# Final Reminder

Do not let this run as a full autonomous multi-phase rewrite.

Correct workflow:

1. run one phase
2. inspect diff
3. run tests
4. review summary
5. then run next phase

That discipline is the difference between a safe senior refactor and a dumb self-inflicted outage.
