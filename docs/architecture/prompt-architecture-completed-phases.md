# Prompt Architecture Refactor — Completed Phases Archive

> Full copy-paste prompts, Sonar queries, and gate checks for completed phases.
> Active plan: `docs/architecture/prompt-architecture-execution-plan.md`

---

## Phase 1: Foundation (D235 + D285 + Golden Tests) — DONE 2026-03-31

**Items:** D235 (reseed fix — already done in SCRAPE7 commit), D285 (sandwich spec), golden tests 24→70
**Gate 1:** ALL PASSED

### Sonar Research (3 queries)
1. "voice agent system prompt architecture" slot-based modular sections → Industry validates modular/layered architecture. PLA pattern. "Layering beats cleverness."
2. "Ultravox AI" system prompt best practices → No official char limit. Recommends shorter, focused prompts. Inline tool instructions preferred.
3. "LLM prompt engineering" minimal base dynamic injection RAG → CAUTIONARY: shorter CAN degrade. Golden tests non-negotiable. 50-200 cases recommended.

Research logged: `CALLINGAGENTS/00-Inbox/Research-Phase1-Prompt-Architecture.md`

### Deliverables
- `docs/architecture/prompt-sandwich-spec.md` — 19 slots defined
- `src/lib/__tests__/prompt-builder-golden.test.ts` — Layer 3 added (section headers, feature combos, char baselines, niche sweep, section order)
- `CALLINGAGENTS/Tracker/D235.md` → done
- `CALLINGAGENTS/Tracker/D285.md` → done
- `CALLINGAGENTS/Decisions/Prompt Sandwich Ownership Model.md` — core philosophy
- `CALLINGAGENTS/00-Inbox/Phase1-Char-Count-Baselines.md` — all niches 17-20K

### Key Discoveries
1. 19 slots (not 18) — OBJECTION_HANDLING undocumented
2. Current prompts 17-20K (not 12K as assumed)
3. KNOWLEDGE_BASE marker wraps too far
4. TRANSFER_ENABLED string cleanup is fragile
5. Two variable fill passes needed

---

## Phase 2: Named Slot Infrastructure (D274) — DONE 2026-03-31

**Items:** D274 (19 slot functions + shadow tests), golden tests 70→100, UI audit
**Gate 2:** ALL PASSED

### Sonar Research (4 queries)
1. "template composition pattern" TypeScript slot functions → Type-safe registries, composable builders
2. "shadow testing" parallel implementation → Byte-identical output validation pattern
3. "voice agent" onboarding UX progressive disclosure → 3-tier patterns found
4. "AI agent" dashboard redesign "what your agent knows" → Capability visualization patterns

Research logged: `CALLINGAGENTS/00-Inbox/Research-Phase2-Slot-Architecture.md` + `Research-Phase2-UI-Alignment.md`

### Deliverables
- `src/lib/prompt-slots.ts` — 19 slot functions + `buildSlotContext()` + `composePrompt()`
- `src/lib/__tests__/prompt-slots-shadow.test.ts` — 91 shadow tests
- Golden tests expanded to 100 (Layer 4)
- Section markers extended to all 19 slot IDs
- `CALLINGAGENTS/00-Inbox/UI-Alignment-Audit-Phase2.md` — 8 UI gaps identified
- `CALLINGAGENTS/Tracker/D274.md` → done
- `memory/feedback_slot_variable_resolution.md` — critical timing discovery

### Key Discoveries
1. Variable resolution timing: niche defaults with `{{CLOSE_PERSON}}` must resolve BEFORE slot assembly
2. UI audit found 8 gaps — raw prompt editor is biggest ownership-model violation
3. 191 total tests (100 golden + 91 shadow), all passing
4. MODE_INSTRUCTIONS imported from prompt-patcher.ts (not moved — Phase 6 obsoletes patcher)

### Copy-Paste Prompt (for reference — DO NOT RE-RUN)

<details>
<summary>Phase 1 copy-paste prompt (archived)</summary>

```
CONTEXT: unmissed.ai voice agent SaaS. Phase 1 of prompt architecture refactor.
[... full prompt preserved in handoff-phase1.md ...]
```
</details>

<details>
<summary>Phase 2 copy-paste prompt (archived)</summary>

```
CONTEXT: unmissed.ai voice agent SaaS. Phase 2 of prompt architecture refactor.
[... full prompt preserved in handoff-phase2.md ...]
```
</details>
