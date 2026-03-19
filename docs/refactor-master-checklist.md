# Refactor Master Checklist
_Source of truth for phase progress. Update after each phase._
_Runbook: `docs/unmissed-master-refactor-runbook.md`_
_Phase state tracker: `memory/refactor-phase-state.md`_

---

## Phase Progress

* [x] Phase 0 Freeze — baseline docs created (2026-03-18)
* [ ] Phase 1A Capability Flags — **NEXT**
* [ ] Phase 1B AgentContext
* [ ] Phase 2 Prompt Builder consumes AgentContext
* [ ] Phase 3 KnowledgeSummary
* [ ] Phase 4 Retrieval
* [ ] Phase 5 Niche delta cleanup
* [ ] Phase 6 Provisioning hardening
* [ ] Phase 7 Property management structured ops
* [ ] Phase 8 Live eval harness

---

## Git Freeze

Run these once after Phase 0 docs are reviewed:

```bash
cd "/Users/owner/Downloads/CALLING AGENTs"
git checkout -b freeze/current-working-state
git tag pre-agent-context-refactor
git push origin freeze/current-working-state --tags
```

* [ ] freeze branch created (`freeze/current-working-state`)
* [ ] freeze tag created (`pre-agent-context-refactor`)

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

* [ ] local prompt files confirmed in repo (clients/*/SYSTEM_PROMPT.txt)
* [ ] live Supabase prompts exported (optional)

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

* [ ] Ultravox agent configs exported to `docs/refactor-baseline/`

---

## Safety

* [ ] freeze branch created
* [ ] freeze tag created
* [ ] prompt exports saved (local files confirmed)
* [ ] Ultravox config export saved
* [ ] Supabase snapshot optional (slugs + prompt lengths recorded above)
* [ ] client/phone/agent mapping saved (`docs/refactor-baseline/baseline-client-agent-map.md`)

---

## Test Gates (per phase)

* [ ] Phase 1A: capability unit tests pass
* [ ] Phase 1B: AgentContext unit tests pass
* [ ] Phase 2: snapshot tests pass (before + after diff empty or intentional)
* [ ] Phase 2: promptfoo hasan-sharif-test.yaml — all 17 pass
* [ ] Phase 3: prompt length controlled; knowledge tests pass
* [ ] Phase 4: retrieval tests pass
* [ ] Phase 5: niche delta map documented
* [ ] Phase 6: provisioning idempotency tests pass
* [ ] Phase 7: PM structured ops tests pass
* [ ] Phase 8: live eval matrix filled (all scenarios pass)

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

## Ship / No-Ship Gate (any phase)

STOP and rollback if any of:
- Critical tool flow breaks (booking, transfer, hangUp)
- Emergency fires on silence or noise
- Booking loops or lies
- Unsupported capability leaks into prompt
- Promptfoo regression (hasan-sharif-test.yaml)
- Naturalness drops badly in live calls
