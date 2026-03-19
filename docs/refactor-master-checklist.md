# Refactor Master Checklist
_Source of truth for phase progress. Update after each phase._
_Runbook: `docs/unmissed-master-refactor-runbook.md`_
_Phase state tracker: `memory/refactor-phase-state.md`_

---

## Phase Progress

* [x] Phase 0 Freeze — baseline docs created (2026-03-18)
* [x] Phase 1A Capability Flags — DONE (2026-03-18)
* [x] Phase 1B AgentContext — DONE (2026-03-18)
* [x] Phase 2 Prompt Builder consumes AgentContext — DONE (2026-03-19)
* [x] Phase 3 KnowledgeSummary — DONE (2026-03-18)
* [x] Phase 4 Retrieval — DONE (2026-03-18)
* [x] Phase 5 Niche delta cleanup — DONE (2026-03-18)
* [x] Phase 6 Provisioning hardening — DONE (2026-03-18)
* [x] Phase 7 Property management structured ops — DONE (2026-03-18)
* [x] Phase 8 Live eval harness — DONE (2026-03-18)

---

## Git Freeze

Run these once after Phase 0 docs are reviewed:

```bash
cd "/Users/owner/Downloads/CALLING AGENTs"
git checkout -b freeze/current-working-state
git tag pre-agent-context-refactor
git push origin freeze/current-working-state --tags
```

* [x] freeze branch created (`freeze/current-working-state`) — commit ee90aa6
* [x] freeze tag created (`pre-agent-context-refactor`) — on commit ee90aa6

---

## Prompt Export

Local prompt files are already in the repo under `clients/*/SYSTEM_PROMPT.txt`. No separate export needed.

To export live Supabase prompts (optional, for belt-and-suspenders):

```sql
-- Run in Supabase SQL editor (project: qwhvblomlgeapzhnuwlb)
SELECT slug, length(system_prompt) as prompt_len, updated_at
FROM clients
WHERE status = 'active'
ORDER BY slug;
```

* [x] local prompt files confirmed in repo (clients/*/SYSTEM_PROMPT.txt)
* [ ] live Supabase prompts exported (optional — do via SQL editor if needed)

---

## Ultravox Config Export

For each live agent, export the current config for rollback reference:

```bash
# hasan-sharif
curl -s -H "Authorization: Bearer $ULTRAVOX_API_KEY" \
  https://api.ultravox.ai/api/agents/f19b4ad7-233e-4125-a547-94e007238cf8 \
  > docs/refactor-baseline/ultravox-agent-hasan-sharif.json

# windshield-hub (LOCKED — export only, do not modify)
curl -s -H "Authorization: Bearer $ULTRAVOX_API_KEY" \
  https://api.ultravox.ai/api/agents/00652ba8-5580-4632-97be-0fd2090bbb71 \
  > docs/refactor-baseline/ultravox-agent-windshield-hub.json

# urban-vibe (LOCKED — export only, do not modify)
curl -s -H "Authorization: Bearer $ULTRAVOX_API_KEY" \
  https://api.ultravox.ai/api/agents/5f88f03b-5aaf-40fc-a608-2f7ed765d6a6 \
  > docs/refactor-baseline/ultravox-agent-urban-vibe.json
```

* [x] Ultravox agent configs exported to `docs/refactor-baseline/`

---

## Safety

* [x] freeze branch created
* [x] freeze tag created
* [x] prompt exports saved (local files confirmed)
* [x] Ultravox config export saved
* [ ] Supabase snapshot optional (slugs + prompt lengths recorded above)
* [ ] client/phone/agent mapping saved (`docs/refactor-baseline/baseline-client-agent-map.md`)

---

## Test Gates (per phase)

* [x] Phase 1A: capability unit tests pass (17/17)
* [x] Phase 1B: AgentContext unit tests pass (51/51)
* [x] Phase 2: snapshot tests pass (before + after diff empty or intentional)
* [x] Phase 2: promptfoo hasan-sharif-test.yaml — all 17 pass
* [x] Phase 3: prompt length controlled; knowledge tests pass (33/33)
* [x] Phase 4: retrieval tests pass (43/43)
* [x] Phase 5: niche delta tests pass (73/73); all 217 tests green
* [x] Phase 6: provisioning idempotency tests pass (47/47)
* [x] Phase 7: PM structured ops tests pass (56/56)
* [x] Phase 8: live eval harness created (26 scenarios, 7 categories, helper script)
* [ ] Phase 8 GATE: canary live eval — 6 core scenarios pass (M1, B1, AH1, U1, A1, A2)
* [ ] Phase 8 GATE: full canary eval — all Category 1-6 scenarios pass for hasan-sharif

---

## Risk Controls

* [ ] windshield-hub and urban-vibe LOCKED until all phases done
* [ ] emergency false trigger controlled (never fires on silence)
* [ ] booking only enabled where capability flag allows
* [ ] bespoke niches documented and paths explicit
* [ ] prompt size controlled (8K char hard max for GLM-4.6)
* [ ] long-form knowledge NOT blindly injected into base prompt
* [ ] property management NOT faked with RAG-only writes

---

## Canary Rule

**Only hasan-sharif is modified during Phases 0–8.**

windshield-hub and urban-vibe are LOCKED. After all 8 phases complete and hasan-sharif passes live eval, explicitly ask user before expanding to other clients.

---

## Live Eval Harness (Phase 8)

**Matrix:** `tests/live-eval/EVAL_MATRIX.md` — 26 scenarios across 7 categories
**Helper:** `tests/live-eval/record-eval.sh` — records pass/fail to CSV
**Results:** `tests/live-eval/results.csv` — append-only eval log

### When to Run Live Eval

| Trigger | Minimum Scenarios |
|---------|-------------------|
| Prompt text change | 6 core (M1, B1, AH1, U1, A1, A2) |
| Prompt builder / AgentContext change | All Category 1-6 |
| Tool registration change | B1-B4, E1-E3, A2 |
| Knowledge / retrieval change | U1-U4, M1 |
| Pre-release to locked clients | Full matrix per client |

### Three Test Layers

| Layer | Tool | Scope |
|-------|------|-------|
| Automated behavioral | `bash tests/promptfoo/run-all.sh` | Prompt text regression |
| Unit tests | `npm test` in agent-app/ | Pure functions (320 tests) |
| Live eval | Manual calls + `record-eval.sh` | End-to-end voice |

---

## Frontend Refactor (L1 + F0–F4)

_Runbook: `docs/unmissed-frontend-refactor-runbook.md`_
_Audit: `audit/frontend-audit-2026-03-19.md`_
_Baseline docs: `docs/frontend-refactor/baseline-component-audit.md` + `decomposition-targets.md`_

### Phase Progress

* [x] Phase F0 — Baseline audit (docs only) — 2026-03-18
* [x] Phase L1 — Behavioral gating (7 changes) — 2026-03-18
* [ ] Phase F1 — SettingsView decomposition — IN PROGRESS (AgentTab remaining)
* [ ] Phase F2 — SetupView + onboard/status — deferred
* [ ] Phase F3 — AgentOverviewCard + LabView — deferred
* [ ] Phase F4 — Shared primitives + cleanup — deferred

### L1 Changes (all done — committed in agent-app 5f0c70f)

| # | Change | File(s) |
|---|--------|---------|
| L1.1 | System prompt: amber "Advanced — edit with caution" warning for non-admins | SettingsView.tsx |
| L1.2 | Prompt History: Restore button hidden behind isAdmin | SettingsView.tsx |
| L1.3 | AI Improve (Beta) hidden from non-admins | SettingsView.tsx |
| L1.4 | Removed duplicate "Right Now" injected_note surface | SettingsView.tsx |
| L1.5 | Removed duplicate Context Data UI from Advanced Context | SettingsView.tsx |
| L1.6 | UNKNOWN → "Unclassified" in client-facing labels | StatusBadge, CallsList, calls/page |
| L1.7 | Test Call moved after Agent Script (edit-then-test flow) | SettingsView.tsx |

### F1 Decomposition (in progress)

| File | Lines | Status |
|------|-------|--------|
| SettingsView.tsx (shell) | 393 | Done (was 2,993) |
| constants.ts | 87 | Done |
| shared.tsx | 54 | Done |
| SmsTab.tsx | 201 | Done |
| VoiceTab.tsx | 158 | Done |
| AlertsTab.tsx | 240 | Done |
| BillingTab.tsx | 182 | Done |
| AgentTab.tsx | ~1,917 | In progress (parallel instance) |

### Line Count

| Before | After (so far) | Delta |
|--------|----------------|-------|
| SettingsView: 2,993 | Shell: 393 + 6 tabs: ~2,783 + constants: 87 + shared: 54 | ~+324 (extraction overhead, expected) |

---

## Ship / No-Ship Gate (any phase)

STOP and rollback if any of:
- Critical tool flow breaks (booking, transfer, hangUp)
- Emergency fires on silence or noise
- Booking loops or lies
- Unsupported capability leaks into prompt
- Promptfoo regression (hasan-sharif-test.yaml)
- Naturalness drops badly in live calls
- Live eval failure on any core scenario (M1, B1, AH1, U1, A1, A2)
