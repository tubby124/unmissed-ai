# Baseline Test Plan
_Frozen: 2026-03-18_

## Current Test Assets

### Promptfoo Behavioral Tests

| File | Test Count | Client | Notes |
|------|-----------|--------|-------|
| `tests/promptfoo/hasan-sharif-test.yaml` | 17 | hasan-sharif | v31 draft prompt |
| `tests/promptfoo/hasan-sharif.yaml` | 17 | hasan-sharif | old prod prompt |
| `tests/promptfoo/windshield-hub.yaml` | 13 | windshield-hub | LOCKED — do not modify |
| `tests/promptfoo/urban-vibe-test.yaml` | 14 | urban-vibe | LOCKED — do not modify |
| `tests/promptfoo/urban-vibe.yaml` | ? | urban-vibe | LOCKED — do not modify |
| `tests/promptfoo/unmissed-demo.yaml` | ? | demo | — |

**Run command:** `bash tests/promptfoo/run-all.sh`

**Canary test file for refactor:** `tests/promptfoo/hasan-sharif-test.yaml` (v31, 17 tests)

### What Promptfoo Tests Cover

- Opener skip if caller already spoke
- One-question rule enforcement
- Voice-lock / tone consistency
- AI disclosure response
- After-hours behavior
- Wrong number handling
- Booking flow patterns (where enabled)
- Spam/robocall rejection
- Completion check (required fields collected before hang-up)

### What Is NOT Tested (Gaps)

| Gap | Risk | Phase to Address |
|-----|------|-----------------|
| Generated prompt output (snapshot) | Prompt refactors silently break content | Phase 2 |
| `buildPromptFromIntake()` output per niche | Niche defaults silently change | Phase 2 |
| `buildAgentContext()` field mapping | AgentContext missing or wrong fields | Phase 1B |
| After-hours detection logic | Time-based logic breaks in edge cases | Phase 1B |
| Capability flag enforcement | Booking shown to non-bookable niches | Phase 1A |
| Returning caller assembly | Wrong name or history injected | Phase 1B |
| Emergency routing logic | Wrong phone or false trigger | Phase 1B |
| Provisioning partial failure | Twilio/Ultravox orphan on error | Phase 6 |
| Property management structured ops | Agent hallucinate tenant/unit data | Phase 7 |

---

## Test Additions by Phase

### Phase 1A — Capability Flags
- Unit tests: `NICHE_CAPABILITIES` mapping — confirm voicemail has `bookAppointments=false`, real_estate has `bookAppointments=true`, etc.
- Unit tests: disabled capability does not appear in assembled prompt/context

### Phase 1B — AgentContext
- Unit tests: `buildAgentContext()` — required fields present
- Unit tests: fallback/default behavior for missing fields
- Unit tests: after-hours field injection
- Unit tests: emergency phone field
- Unit tests: returning caller context assembly

### Phase 2 — Prompt Builder → AgentContext
- **Snapshot tests:** generate prompt for hasan-sharif (real_estate) before and after refactor → diff must be empty or intentional
- Snapshot tests: windshield-hub (auto_glass), urban-vibe (property_management) — for reference only, not modified
- Promptfoo: re-run hasan-sharif-test.yaml → all 17 must pass

### Phase 3 — KnowledgeSummary
- Tests: prompt length stays under target (8K chars)
- Tests: KnowledgeSummary answers remain correct
- Tests: unknown-answer behavior when knowledge missing

### Phase 4 — Retrieval
- Tests: relevant answer retrieved for known questions
- Tests: unknown-answer bounded (no hallucination)
- Tests: core behavior rules NOT in retrieval path

### Phase 6 — Provisioning
- Tests: partial failure scenarios (Twilio success + Ultravox failure → no orphan Twilio number)
- Tests: idempotency (double-activation does not create second Ultravox agent)

### Phase 7 — Property Management
- Tests: tenant lookup returns correct unit
- Tests: maintenance intake collects required fields
- Tests: unsupported action correctly deflected
- Tests: emergency triage routes correctly

---

## Live Call Baseline Matrix

To be completed manually before Phase 2 (any phase touching runtime behavior).
See `docs/refactor-baseline/baseline-live-call-notes.md`.

**Minimum required for canary (hasan-sharif):**
- Simple message taking
- Property showing booking request
- After-hours call
- "Are you AI?" challenge
- Unknown question
- Caller ends call mid-flow
