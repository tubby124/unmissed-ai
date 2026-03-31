# Prompt Architecture Execution Plan (Revised 2026-03-31, updated 2026-03-31 post-Phase-1)

> **North Star:** D280 — UI-driven prompt composition. Users never touch raw prompts.
> **Core principle:** "To us, it's variables. To them, it's fields they populate." See `CALLINGAGENTS/Decisions/Prompt Sandwich Ownership Model.md`.
> **D277 removed:** plumber-calgary-nw was built with the old system. Fixing the architecture fixes it.
> **outbound_isa_realtor excluded:** n8n workflow niche, not inbound voice. Untouched by this refactor.
> **NO redeployment** to the 4 working clients (hasan-sharif, exp-realty, windshield-hub, urban-vibe). They stay on current prompts. This is for **new clients going forward**.
> **Opus protocol:** Write handoff after every phase AND after ~15 tool calls (whichever comes first). Never wait for compaction.
> **Sonar research:** Every phase includes targeted Perplexity Sonar Pro queries. Findings go into Obsidian.
> **Obsidian tracking:** Every completed D-item gets its tracker note updated to `status: done`. Findings from research go into `00-Inbox/` or relevant note.
> **Parallel golden tests:** Before any prompt-shrinking phase, expand golden tests to 50+ unique niche×mode×feature combos. Run test expansion agents in parallel with research.

---

## Architecture Summary

```
CURRENT:  template-body.ts (monolith) → buildPromptFromIntake() (829 lines) → 9 patchers → 17-20K prompts
TARGET:   Named slots → composePrompt() → recomposePrompt() → 4-7K prompt (derived from UI fields)
```

### Ownership Model (from Decisions/Prompt Sandwich Ownership Model.md)
```
BREAD (us, non-negotiable):  Safety + Forbidden + Voice + Grammar + Returning Caller
FILLING (them, their data):  Identity + Tone + Goal + Flow + Triage + FAQ + Knowledge + Features
```
Three onboarding tiers: "Decide for me" | "Let me tweak" | "Here's my stuff" — all produce populated variables.

## Critical Path

```
Phase 1: D235 + D285 + golden tests + Sonar research                          ← DONE ✅
    │
    ▼  GATE 1: spec exists, tests hardened, D235 shipped, research logged      ← PASSED ✅
Phase 2: D274 (named slots) + golden test expansion + Sonar               ← DONE ✅
    │
    ▼  GATE 2: shadow tests pass, 19 slot functions, 191 total tests       ← PASSED ✅
Phase 3: D265 + D272 + D268 (shrink + clean) + Sonar on safety/RAG
    │
    ▼  GATE 3: prompts < 8K base, golden tests updated, build passes
Phase 4: D260 + D281 + D282 (gap wiring — parallelizable)               ← DONE ✅
    │
    ▼  GATE 4: service edits sync, owner/business name editable + patched  ← PASSED ✅
Phase 5: D283a/b/c + D286 + D288 + D290 + D300 + Sonar on agent config UX
    │    (D283 split into 3 sub-tasks; D300 added for service KB reseed)
    ▼  GATE 5: variable registry, section regen works, capabilities shown
Phase 6: D280 + D278 + D276 (north star — scope reduced since Phase 5 handles section regen)
    │
    ▼  GATE 6: full recomposePrompt(), Agent Brain page, raw editor removed for owners
```

---

## Standing Rules (apply to EVERY phase)

### Handoff Protocol
- Write handoff after ~15 tool calls OR when a phase completes (whichever comes first)
- If approaching compaction, write handoff IMMEDIATELY before anything else
- Handoff path: `~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase{N}.md`
- Intermediate handoffs: `handoff-phase{N}-part{M}.md` if a phase takes multiple compactions

### Sonar Research Protocol
- Run 2-3 Perplexity Sonar Pro queries per phase (specific topics listed per phase)
- Log findings in Obsidian: `CALLINGAGENTS/00-Inbox/Research-Phase{N}.md`
- If findings conflict with existing architecture, FLAG to user before proceeding
- Use `$OPENROUTER_API_KEY` with `perplexity/sonar-pro` model (conserve Brave credits)

### Obsidian Tracker Protocol
- When starting a D-item: update its `Tracker/D{N}.md` → `status: in-progress`
- When completing a D-item: update → `status: done`, add completion date
- When discovering something: create or update the relevant note in vault
- When completing a phase: update `Project/Index.md` if the architecture section changes

### Deploy Rule
- **NEVER redeploy to the 4 working clients** unless explicitly asked
- Test all changes against `e2e-test-plumbing-co` (test client)
- New clients provisioned after this work will use the new system automatically
- Existing clients can be migrated later as an explicit opt-in task

---

## Phase 1 — ✅ DONE | Phase 2 — ✅ DONE

> **Archived to:** `docs/architecture/prompt-architecture-completed-phases.md`
> **Phase 1 handoff:** `~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase1.md`
> **Phase 2 handoff:** `~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase2.md`

### Phase 1 Summary (2026-03-31)
D235 ✅ (reseed fix — already done), D285 ✅ (sandwich spec — 19 slots), golden tests 24→70.
Sonar: slot architecture validated, Ultravox has no hard char limit, shorter CAN degrade performance.
Research: `CALLINGAGENTS/00-Inbox/Research-Phase1-Prompt-Architecture.md`

### Phase 2 Summary (2026-03-31)
D274 ✅ (19 slot functions in `prompt-slots.ts`), golden tests 70→100, shadow tests 91. Total: 191 tests.
Key finding: variable resolution timing critical — niche defaults with `{{CLOSE_PERSON}}` need early resolve.
UI audit: 8 gaps identified. Raw prompt editor is biggest ownership-model violation.
Research: `CALLINGAGENTS/00-Inbox/Research-Phase2-Slot-Architecture.md` + `Research-Phase2-UI-Alignment.md`
Memory: `memory/feedback_slot_variable_resolution.md`

### Carry-Forward Findings (read before Phase 3+)
- 19 slots (OBJECTION_HANDLING is 19th)
- Current prompts 17-20K chars → Phase 3 target < 8K
- Shorter can degrade — 191 golden tests are the safety net
- Voicemail builder untouched (separate template)
- outbound_isa_realtor excluded (n8n workflow)
- Patchers must still work on OLD client prompts (4 working clients)
- KNOWLEDGE_BASE marker boundary fixed in Phase 2

---

## Phase 3: Shrink + Clean (D265 + D272 + D268 + D269 + D296) — ✅ DONE

**Status:** COMPLETE (2026-03-31)
**Items:** D265 (remove KB — pgvector-first with fallback), D272 (conditional pricing), D268 (switch to slots), D269 (pgvector primary), D296 (FORBIDDEN_EXTRA bug fix)
**Depends on:** GATE 2 passed ✅
**Handoff:** `~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase3.md`
**Key results:** buildPromptFromIntake() now uses slot composition (101 lines vs 828). pgvector clients get 1-line queryKnowledge instruction instead of inline FAQ. Pricing rule conditional on pricing_policy. FORBIDDEN_EXTRA dead code fixed. 406 tests passing. INBOUND_TEMPLATE_BODY preserved as dead code for rollback.
**Files touched:** prompt-builder.ts (rewritten), prompt-slots.ts (modified), 5 snapshot files regenerated, 3 test files updated
**Risk:** HIGH — point of no return for the build system (NOT for live clients)
**outbound_isa_realtor:** Excluded from all tests and slot functions (n8n workflow, not inbound)

### Sonar Research (run BEFORE writing code)

Query 1: `"voice AI agent" safety rules "prompt injection" defense minimal 2025 2026`
- Goal: Validate which safety rules are truly mandatory vs business logic
- Look for: OWASP for LLMs, Ultravox-specific injection defense recommendations

Query 2: `"RAG vs inline context" LLM performance latency "knowledge base" voice agent`
- Goal: Validate that moving knowledge to RAG (pgvector) won't degrade voice response time
- Look for: latency impact of tool calls vs inline context, pgvector query speed benchmarks

Query 3: `"pricing policy" "voice agent" "quote prices" customer service AI best practices`
- Goal: Research how other voice AI products handle pricing — never quote vs dynamic quoting
- Look for: industry patterns for D272's conditional pricing rules

Log all findings to: `CALLINGAGENTS/00-Inbox/Research-Phase3-Safety-And-RAG.md`

### Copy-paste prompt

```
CONTEXT: unmissed.ai voice agent SaaS. Phase 3 of prompt architecture refactor.
Phase 2 is DONE. Read the handoff first.
This phase changes prompt output — golden snapshots WILL change.
Write handoff after ~15 tool calls OR when done. NEVER wait for compaction.

⚠️ DEPLOY RULE: Do NOT redeploy to hasan-sharif, exp-realty, windshield-hub, or urban-vibe.
This only affects NEW clients provisioned after this ships. Test with e2e-test-plumbing-co.

READ FIRST (mandatory):
- ~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase2.md — prior handoff
- CALLINGAGENTS/00-Inbox/Research-Phase2-Slot-Architecture.md — prior Sonar findings
- docs/architecture/prompt-sandwich-spec.md — slot spec
- src/lib/prompt-slots.ts — slot functions from Phase 2
- src/lib/__tests__/prompt-slots-shadow.test.ts — shadow tests (confirm passing)
- memory/glm46-prompting-rules.md — char limits + safety rules
- src/lib/prompt-config/template-body.ts — the template being retired

TASK 0 — Sonar Research
Run 3 Sonar Pro queries via $OPENROUTER_API_KEY:
  1. "voice AI agent" safety rules "prompt injection" defense minimal
  2. "RAG vs inline context" LLM performance latency knowledge base voice agent
  3. "pricing policy" voice agent "quote prices" customer service AI best practices
Log findings to: CALLINGAGENTS/00-Inbox/Research-Phase3-Safety-And-RAG.md via obsidian MCP.
If research suggests keeping more safety rules than planned, FLAG before proceeding.

TASK 1 — D265 + D269: Remove PRODUCT KNOWLEDGE BASE, use pgvector
Modify buildKnowledgeBase() slot in prompt-slots.ts:
  - If knowledge_backend='pgvector' AND knowledge_chunk_count > 0:
    Return 1-line instruction: "Use queryKnowledge tool for factual questions. If no results,
    say you'll have {{CLOSE_PERSON}} follow up."
  - If no pgvector: return current inline FAQ block (backward compat)
Remove KB replacement logic from prompt-builder.ts (lines 721-737).
Remove buildNicheFaqDefaults() from prompt-helpers.ts (200+ lines).
Remove buildPrintShopFaq() from prompt-helpers.ts.
After: Update CALLINGAGENTS/Tracker/D265.md and D269.md → status: done via obsidian MCP.

TASK 2 — D272: Make business-logic constraints conditional
Classify FORBIDDEN_ACTIONS rules:
  KEEP (true safety): rules 1, 2, 8, 10, 11, 14, 15, 16
  CONDITIONAL: rule 3 (prices — depends on pricing_policy), rule 5 (transfer)
In buildForbiddenActions() slot: make rule 3 conditional on pricing_policy variable.
  - 'never_quote' or unset → keep "NEVER quote prices"
  - 'quote_from_kb' → "You MAY quote prices from knowledge base"
  - 'quote_ranges' → "You MAY give approximate price ranges"
After: Update CALLINGAGENTS/Tracker/D272.md → status: done via obsidian MCP.

TASK 3 — D268: Switch buildPromptFromIntake to slot composition
Rewrite buildPromptFromIntake() to:
  1. Build SlotContext from intake data (same variable resolution)
  2. Call each slot function
  3. Call composePrompt(slots)
  4. Apply section markers
Keep INBOUND_TEMPLATE_BODY as dead export for 1 week (rollback safety).
Update golden test snapshots to match new (smaller) output.
After: Update CALLINGAGENTS/Tracker/D268.md → status: done via obsidian MCP.

Run: npm run build && npx tsx --test src/lib/__tests__/prompt-builder-golden.test.ts

GATE 3 CHECK — before marking done, verify ALL of:
  □ Sonar research logged to CALLINGAGENTS/00-Inbox/Research-Phase3-Safety-And-RAG.md
  □ No golden test snapshot exceeds 8000 chars (base, without features)
  □ buildPromptFromIntake() now uses slot composition path
  □ PRODUCT KNOWLEDGE BASE section removed from template
  □ Rule 3 (pricing) is conditional on pricing_policy
  □ npm run build passes
  □ All golden tests pass with updated snapshots
  □ INBOUND_TEMPLATE_BODY still exists as dead code (rollback)
  □ D265, D269, D272, D268 tracker notes all updated to status: done
  □ Research findings don't contradict our approach (or conflicts flagged)

HANDOFF: Write ~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase3.md with:
  - Sonar research summary (safety rules validated? RAG latency OK?)
  - Char count BEFORE/AFTER for each golden snapshot
  - Files changed
  - Which rules were made conditional
  - Rollback instructions (how to revert to old template)
  - Exact gate status
  - WARNING: Do NOT deploy to any working client. Test with e2e-test-plumbing-co only.

STOP after gate check + handoff. Do NOT deploy to any live client.
```

---

## Phase 4: Gap Wiring (D260 + D281 + D282) — ✅ DONE

**Status:** COMPLETE (2026-03-31)
**Items:** D260 (service catalog sync), D281 (owner name), D282 (business name — already implemented, contract updated)
**Depends on:** GATE 3 passed ✅
**Handoff:** `~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase4.md`
**Key results:** Service catalog CRUD now syncs to prompt + Ultravox. owner_name changes patch CLOSE_PERSON in prompt. business_name already worked — mutation contract updated. FILTER_EXTRA + 3 siblings bug fixed (same D296 pattern). 448 tests pass.
**Files touched:** 9 (1 new + 8 modified)
**Risk:** MEDIUM

### Phase 3 Carry-Forward (MUST READ before Phase 4)

These findings from Phase 3 directly affect Phase 4 work:

1. **Patcher → slot mismatch risk (CRITICAL for D281/D282):**
   Patchers (`patchAgentName`, `patchBusinessName`) string-match section headers in stored prompts.
   Slot-composed prompts have slightly different text (cleaner conditionals, different marker positions).
   **BEFORE wiring D281/D282:** verify the patchers' regex works against a slot-composed prompt.
   Generate a test prompt via `buildPromptFromIntake()`, then run the patcher against it.
   If the patcher fails to match, update the matcher first.

2. **D296 FORBIDDEN_EXTRA bug pattern — check for others:**
   The bug was `nicheDefaults.FILTER_EXTRA` being read instead of `variables.FILTER_EXTRA`.
   Grep `prompt-slots.ts` for any remaining `nicheDefaults.` references that should be `variables.`
   Quick fix if found, but check before Phase 4 coding starts.

3. **pgvector should be default for new clients:**
   If Phase 4 touches provisioning routes, set `knowledge_backend: 'pgvector'` as default.
   The queryKnowledge instruction is harmless with 0 chunks.

4. **Prompt char count metric:**
   Consider adding prompt length to the agent readiness display while touching settings code.
   Cheap to implement, high operational value.

5. **Full Phase 3 learnings:** `memory/feedback_phase3_learnings.md` — 10 findings.

### Sonar Research (run BEFORE writing code)

Query 1: `"service catalog" "voice agent" sync dashboard real-time update SaaS architecture`
- Goal: Research how other SaaS products sync catalog/service changes to live AI agents
- Look for: event-driven sync patterns, debouncing strategies, optimistic UI

Log to: `CALLINGAGENTS/00-Inbox/Research-Phase4-Sync-Patterns.md`

### Copy-paste prompt

```
CONTEXT: unmissed.ai voice agent SaaS. Phase 4 of prompt architecture refactor.
Phase 3 is DONE. Read the handoff first.
These 3 tasks are INDEPENDENT — they touch different files and different DB fields.
Write handoff after ~15 tool calls OR when done. NEVER wait for compaction.

⚠️ DEPLOY RULE: Do NOT redeploy to hasan-sharif, exp-realty, windshield-hub, or urban-vibe.

⚠️ PHASE 3 CARRY-FORWARD (read memory/feedback_phase3_learnings.md):
- Patchers may not match slot-composed prompts — VERIFY before wiring D281/D282
- Check for nicheDefaults.FILTER_EXTRA bug (same pattern as D296)
- buildPromptFromIntake() now delegates to prompt-slots.ts — do NOT modify prompt-builder.ts body
- 406 tests must still pass after Phase 4

READ FIRST (mandatory):
- ~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase3.md — prior handoff
- memory/feedback_phase3_learnings.md — 10 learnings that affect Phase 4
- docs/architecture/control-plane-mutation-contract.md — Section 2 + Section 5 checklist
- src/lib/prompt-slots.ts — THE source of truth for prompt composition (not prompt-builder.ts)
- src/lib/prompt-patcher.ts — patchBusinessName, patchAgentName, patchServicesOffered
- src/lib/service-catalog.ts — formatServiceCatalog, parseServiceCatalog
- src/app/api/dashboard/services/ — all route files
- src/app/api/dashboard/settings/route.ts — syncToUltravox

TASK 0 — Pre-flight checks (before any code)
  A. Sonar: Run 1 query: "service catalog" voice agent sync dashboard real-time update SaaS
     Log to: CALLINGAGENTS/00-Inbox/Research-Phase4-Sync-Patterns.md via obsidian MCP.
  B. Patcher verification: Generate a slot-composed prompt, run patchAgentName() and
     patchBusinessName() against it. If either fails to match, fix the matcher FIRST.
  C. Grep prompt-slots.ts for `nicheDefaults.FILTER_EXTRA` — if found, change to
     `variables.FILTER_EXTRA` (same D296 bug pattern).

TASK 1 — D260: Service catalog → agent runtime sync
Create src/lib/service-catalog-sync.ts:
  async function syncServiceCatalogToPrompt(clientId: string): Promise<void>
    1. Read client_services WHERE client_id AND active=true, ordered by sort_order
    2. Build SERVICES_OFFERED string via formatServiceCatalog()
    3. Read current system_prompt from clients
    4. Call patchServicesOffered(prompt, newServices)
    5. Write updated system_prompt to DB
    6. Trigger syncToUltravox
Wire into: POST services/apply (after insert), PATCH services/[id] (after update),
DELETE services/[id] (after delete). Fire-and-forget OK.
Handle duplicates: check for existing services with same name (case-insensitive) before insert.
After: Update CALLINGAGENTS/Tracker/D260.md → status: done via obsidian MCP.

TASK 2 — D281: CLOSE_PERSON editable post-onboarding
⚠️ Patcher verification must pass (Task 0B) before starting this.
In settings-patchers.ts, when body.owner_name is present:
  - Get old CLOSE_PERSON from current prompt (try both old template and slot patterns)
  - Get new first name: body.owner_name.split(' ')[0]
  - Word-boundary replace throughout system_prompt
  - Flag triggersSync because prompt changed
After: Update CALLINGAGENTS/Tracker/D281.md → status: done via obsidian MCP.

TASK 3 — D282: Business name change patches prompt
⚠️ Patcher verification must pass (Task 0B) before starting this.
Verify patchBusinessName() fires in settings-patchers.ts when body.business_name set.
Verify patchBusinessName() works against BOTH old template prompts AND slot-composed prompts.
Verify business_name in select() for syncToUltravox.
Update docs/architecture/control-plane-mutation-contract.md: business_name → DB_PLUS_PROMPT.
After: Update CALLINGAGENTS/Tracker/D282.md → status: done via obsidian MCP.

Run: npm run build
Run: npx tsx --test src/lib/__tests__/prompt-builder-golden.test.ts
Run: npx tsx --test src/lib/__tests__/prompt-slots-shadow.test.ts
Verify total: 406+ tests pass

GATE 4 CHECK — before marking done, verify ALL of:
  □ Sonar research logged to CALLINGAGENTS/00-Inbox/Research-Phase4-Sync-Patterns.md
  □ Patcher verification passed for slot-composed prompts (Task 0B)
  □ No nicheDefaults.FILTER_EXTRA bug found (or fixed if found)
  □ Service catalog edits trigger prompt update + Ultravox sync
  □ owner_name patcher wired, prompt patched on change
  □ business_name triggersSync=true, patchBusinessName fires, mutation contract updated
  □ Patchers work on BOTH old (4 existing client) and new (slot-composed) prompts
  □ npm run build passes
  □ All 406+ tests pass
  □ No new columns needed (owner_name already exists in clients table)
  □ D260, D281, D282 tracker notes all updated to status: done

HANDOFF: Write ~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase4.md with:
  - Pre-flight check results (patcher verification outcome, FILTER_EXTRA grep)
  - Files changed per task
  - Which settings now trigger Ultravox sync (updated list)
  - Mutation contract changes
  - Exact gate status
  - Obsidian notes updated
  - NOTE: After this phase, test with e2e-test-plumbing-co. Do NOT touch working clients.

STOP after gate check + handoff.
```

---

## Phase 5: Agent Knowledge UX (D283 + D286 + D288 + D290) — REVISED post-Phase 4

**Items:** D283 (split into 3 sub-tasks), D286 (UI alignment), D288 (capability preview), D290 ("what your agent knows"), D300 (service knowledge reseed gap)
**Depends on:** GATE 4 passed ✅
**Input:** UI alignment audit from Phase 2 (`CALLINGAGENTS/00-Inbox/UI-Alignment-Audit-Phase2.md`)
**Files touched:** 8-12 new + 6-8 modified + 2 Obsidian research notes
**Risk:** **HIGH (revised up from MEDIUM)** — Phase 4 revealed that D283's "editable variables" requires section-level regeneration, not individual patchers. See carry-forward findings.
**This is where users first SEE the new model.** Everything before this was backend plumbing.

### Phase 4 Carry-Forward Findings (MUST READ before Phase 5)

1. **Patcher approach doesn't scale (CRITICAL for D283):**
   We have ~11 patchers. D283 wants 30+ variables editable. We can't write 30 patchers.
   The solution: split D283 into 3 sub-tasks. D283a (registry) and D283b (read-only display) are safe.
   D283c (editable with section regeneration) pulls forward a small piece of Phase 6's `recomposePrompt()`.
   **Before D283c:** implement `regenerateSlot(clientId, slotId)` — regenerates one slot section from current DB state + slot function, replaces that section in the stored prompt.

2. **Mutation contract needs audit (pre-flight):**
   D282 was listed as `DB_ONLY` but already had a patcher wired. Other DB_ONLY fields may be misclassified too.
   Walk all DB_ONLY fields in FIELD_REGISTRY and verify against actual code paths.

3. **niche_custom_variables is DB_ONLY but affects prompt (FAKE CONTROL risk):**
   Editing `niche_custom_variables` (e.g., TRIAGE_DEEP from intake review) saves to DB but doesn't
   trigger a prompt rebuild. Phase 5 will expose these variables → users will edit → nothing happens.
   D283c must handle this: variable edit → regenerateSlot → sync.

4. **Service catalog sync doesn't reseed knowledge (D300 — new item):**
   D260 patches the prompt FAQ line but doesn't reseed pgvector knowledge chunks.
   For pgvector clients, service changes sit in `clients.services_offered` but the agent's
   knowledge base doesn't learn about them.
   **Action:** D300 extends D260 to also trigger `reseedKnowledgeFromSettings()` when
   `knowledge_backend='pgvector'` after service CRUD.

5. **buildSlotContext is 530+ lines — decompose before D283a:**
   The variable → slot mapping is buried in if/else chains. Extracting the registry (D283a)
   requires reading this function. Consider extracting a static `VARIABLE_DEFINITIONS` map
   alongside the registry.

6. **4 working clients drifting further from new architecture:**
   Not blocking, but add Phase 7 (Client Migration) to the plan to keep it visible.

### What ships in Phase 5 (REVISED)

**D283a — Prompt Variable Registry (data model, no UI) — NEW SUB-TASK**
Create `src/lib/prompt-variable-registry.ts`:
- Static registry of all 30+ template variables with: key, label, slotId, dbField, editable flag, currentSettingsCard, defaultSource
- Populated by reading buildSlotContext + niche-defaults
- This is pure data — no UI, no patching, no side effects
- **Gate:** registry covers all variables found in buildSlotContext

**D283b — Variable Dashboard Surface (read-only) — NEW SUB-TASK**
Create `PromptVariablesCard.tsx` that displays variables grouped by slot:
- Shows current value (resolved from DB state)
- Read-only initially — labels each variable's source and editability
- Links to existing settings cards where edit paths exist
- **Gate:** card renders without errors, all variables displayed

**D283c — Section-Level Regeneration for Variable Edits — NEW SUB-TASK**
Create `regenerateSlot(clientId, slotId)`:
- Reads current client state from DB
- Builds SlotContext
- Runs the slot function for the target slot
- Replaces that section in the stored prompt (using section markers from Phase 2)
- Saves + syncs to Ultravox
- **This is the mini-recompose engine.** It's a narrower version of Phase 6's recomposePrompt().
- Wire into settings PATCH for any field that maps to a prompt variable via the registry
- **Gate:** editing a variable triggers section regen + Ultravox sync

**D300 — Service catalog knowledge reseed (extends D260) — NEW ITEM**
After service CRUD, if `knowledge_backend='pgvector'`, also trigger `reseedKnowledgeFromSettings()`.
Ensures pgvector clients' knowledge base reflects current services.

**D286 — Dashboard UI Alignment**
Reorganize settings cards to match ownership model. Group by: Identity, Conversation Flow, Knowledge, Capabilities, Notifications. Remove or merge cards that duplicate each other.

**D288 — "Your agent can do X right now" Capability Preview**
Post-onboarding: "Alex is live! Here's what she can do: take messages, answer 12 FAQ questions, send Telegram summaries." On dashboard: always-visible capability card with active/inactive badges + deep links to set up missing features. Settings change feedback: "SMS enabled! Your agent will now text callers."

**D290 — "What Your Agent Knows" Surface**
Single view showing: facts (count + preview), FAQ (count + preview), services (list), knowledge base (chunks + sources), knowledge gaps (from recent calls). Links to edit each category. This becomes the skeleton for Phase 6's Agent Brain.

### Pre-flight checks (run BEFORE any code)

**A. Mutation contract audit:**
Walk all DB_ONLY fields in FIELD_REGISTRY. For each, check if:
- A patcher already handles it (check settings-patchers.ts PATCH_TRIGGER_FIELDS)
- A sync path exists (check service routes, webhook handlers)
- The mutation contract field classification matches reality
Log findings. Update FIELD_REGISTRY and mutation contract for any mismatches.

**B. Sonar Research:**

Query 1: `"agent configuration UI" SaaS dashboard "prompt variables" editable fields 2025 2026`
- Goal: Research how other AI agent platforms expose configuration to users
- Look for: variable registry patterns, inline editing UX, "what your agent knows" surfaces

Query 2: `"voice AI" "agent brain" dashboard knowledge visibility configuration SaaS`
- Goal: Research "agent brain" or "agent knowledge" dashboard patterns
- Look for: how competitors display what an AI agent knows, edit flows

Log to: `CALLINGAGENTS/00-Inbox/Research-Phase5-Agent-Config-UX.md`

### Execution order (gated — each sub-task has its own gate)

```
D283a (variable registry)  ──→  D283b (read-only dashboard)  ──→  D283c (section regeneration)
       ↓ parallel                        ↓ parallel                        ↓ then
     D300 (service KB reseed)         D288 (capability preview)         D286 (UI alignment)
                                      D290 ("what agent knows")
```

D283a and D300 can run in parallel (different files).
D283b, D288, D290 can run in parallel after D283a (all read-only UI).
D283c and D286 are sequential — D283c needs section markers, D286 reorganizes cards.

### Copy-paste prompt

```
CONTEXT: unmissed.ai voice agent SaaS. Phase 5 of prompt architecture refactor.
Phase 4 is DONE. Read the handoff first.
Write handoff after ~15 tool calls OR when done. NEVER wait for compaction.

⚠️ DEPLOY RULE: Do NOT redeploy to hasan-sharif, exp-realty, windshield-hub, or urban-vibe.

⚠️ PHASE 4 CARRY-FORWARD (read memory/feedback_phase4_learnings.md):
- Patchers don't scale to 30+ variables — D283c needs section-level regeneration
- niche_custom_variables is DB_ONLY but affects prompt — fake-control risk
- Mutation contract has stale entries — audit first
- Service sync (D260) doesn't reseed knowledge — D300 fixes this
- buildSlotContext is 530+ lines — extract variable map alongside registry

READ FIRST (mandatory):
- ~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase4.md — prior handoff
- memory/feedback_phase4_learnings.md — 6 learnings that affect Phase 5
- memory/feedback_phase3_learnings.md — still relevant (buildSlotContext bottleneck)
- src/lib/prompt-slots.ts — slot functions and their variable dependencies
- src/lib/prompt-sections.ts — section markers (needed for D283c)
- docs/architecture/prompt-sandwich-spec.md — slot spec with variable mapping
- src/lib/settings-schema.ts — FIELD_REGISTRY
- src/lib/settings-patchers.ts — auto-patch orchestrator (11 patchers, not scalable)
- memory/settings-card-architecture.md — existing card layout
- memory/feedback_user_designs_prompt.md — core philosophy

TASK 0 — Pre-flight (before any code)
  A. Mutation contract audit: walk DB_ONLY fields, verify against actual code paths.
  B. Sonar: 2 queries (agent config UI, agent brain dashboard).
     Log to: CALLINGAGENTS/00-Inbox/Research-Phase5-Agent-Config-UX.md via obsidian MCP.
  C. If audit reveals misclassified fields, fix FIELD_REGISTRY + mutation contract first.

TASK 1 — D283a: Prompt Variable Registry (pure data, no UI)
Create src/lib/prompt-variable-registry.ts.
  interface PromptVariable {
    key: string           // 'CLOSE_PERSON'
    label: string         // 'Contact person for callbacks'
    slotId: string        // 'goal' (from prompt-sandwich-spec.md)
    dbField: string|null  // 'owner_name' (clients table column)
    intakeField: string|null // 'owner_name' (intake data key)
    editable: boolean     // true if a settings card or patcher exists
    editPath: string|null // 'settings.owner_name' or null
    category: 'identity' | 'voice' | 'flow' | 'knowledge' | 'capability' | 'safety'
  }
Populate for EVERY variable in buildSlotContext().
Method: read buildSlotContext line by line, extract every `variables.X = ...` assignment.
Expected: 30-40 variables.
After: Update CALLINGAGENTS/Tracker/D283.md → status: in-progress via obsidian MCP.

TASK 2 — D300: Service catalog knowledge reseed
In src/lib/service-catalog-sync.ts, after DB update:
  If client.knowledge_backend === 'pgvector':
    Call reseedKnowledgeFromSettings(clientId, facts, qa) (fire-and-forget)
    (facts/qa fetched from fresh client read)
After: Create CALLINGAGENTS/Tracker/D300.md via obsidian MCP.

TASK 3 — D283b: PromptVariablesCard (read-only dashboard)
Create src/components/dashboard/settings/PromptVariablesCard.tsx.
  - Read-only display of all variables from registry
  - Grouped by category (identity, voice, flow, knowledge, capability, safety)
  - Shows: current value, source label, editability status
  - Editable vars link to their existing settings card
  - Uses client data already fetched in settings page
After: Update CALLINGAGENTS/Tracker/D283.md via obsidian MCP.

TASK 4 — D283c: Section-level regeneration (mini-recompose)
Create src/lib/slot-regenerator.ts:
  async function regenerateSlot(clientId: string, slotId: string): Promise<void>
    1. Read client row from DB (all fields needed by buildSlotContext)
    2. Build SlotContext from client row (using clientToSyntheticIntake or similar)
    3. Run the slot function for slotId
    4. Replace that section in system_prompt (using section markers)
    5. Validate with validatePrompt()
    6. Save + sync to Ultravox
Wire into settings PATCH: when a body field maps to a prompt variable (via registry),
  call regenerateSlot for the owning slot instead of an individual patcher.
After: Update CALLINGAGENTS/Tracker/D283.md → status: done via obsidian MCP.

TASK 5 — D288 + D290 (parallel, both read-only UI)
D288: CapabilityPreviewCard — "your agent can: take messages, answer X questions..."
D290: KnowledgeSummaryCard — facts count, FAQ count, services list, KB chunks, gaps
After: Update Obsidian tracker notes.

TASK 6 — D286: Dashboard UI alignment
Reorganize settings sections to match ownership model:
  Identity | Conversation Flow | Knowledge | Capabilities | Notifications
After: Update Obsidian tracker notes.

Run: npm run build
Run: all prompt tests (448+)

GATE 5 CHECK — before marking done, verify ALL of:
  □ Mutation contract audit complete, mismatches fixed
  □ Sonar research logged
  □ prompt-variable-registry.ts covers 30+ variables
  □ D300 service knowledge reseed wired
  □ PromptVariablesCard renders without errors (read-only)
  □ regenerateSlot() works for at least 3 variables (agent_name, owner_name, services)
  □ Section regen triggers Ultravox sync
  □ npm run build passes
  □ All 448+ tests pass
  □ D283, D286, D288, D290, D300 tracker notes updated
  □ No niche_custom_variables fake-control (variable edit → regen → sync)

HANDOFF: Write ~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase5.md with:
  - Mutation contract audit results
  - Sonar research summary
  - Variable count (total, editable via regen, read-only, with existing card)
  - regenerateSlot() capabilities and limitations
  - Files changed per task
  - Exact gate status

STOP after gate check + handoff.
```

---

## Phase 6: North Star (D280 + D278 + D276 + D287 + D289)

**Items:** D280 (recompose engine), D278 (Agent Brain), D276 (calendar adapts triage), D287 (niche-adaptive onboarding), D289 (services input UX)
**Depends on:** GATE 5 passed
**Files touched:** 12-18 new + several modified
**Risk:** HIGH — fundamental change to prompt management AND onboarding UX
**This is the full product vision shipping.** Agent Brain + niche-adaptive onboarding + structured services + recompose engine.

### Sonar Research (run BEFORE writing code)

Query 1: `"AI agent" "prompt recomposition" derived artifact configuration-driven 2025 2026`
- Goal: Validate the recompose-from-DB approach (prompt as derived artifact)
- Look for: other platforms that treat prompts as computed outputs from config

Query 2: `"no-code AI agent builder" prompt composition user interface UX patterns 2025 2026`
- Goal: Research how no-code/low-code agent builders handle prompt composition via UI
- Look for: agent brain dashboards, knowledge management UIs, configuration-driven agents

Log to: `CALLINGAGENTS/00-Inbox/Research-Phase6-Recomposition-UX.md`

### Copy-paste prompt

```
CONTEXT: unmissed.ai voice agent SaaS. Phase 6 — the NORTH STAR.
Phase 5 is DONE. Read the handoff first.
Write handoff after ~15 tool calls OR when done. NEVER wait for compaction.

⚠️ DEPLOY RULE: Do NOT redeploy to hasan-sharif, exp-realty, windshield-hub, or urban-vibe.
Deploy ONLY to e2e-test-plumbing-co for testing. New clients use the new system automatically.

READ FIRST (mandatory):
- ~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase5.md — prior handoff
- CALLINGAGENTS/00-Inbox/Research-Phase5-Agent-Config-UX.md — prior Sonar findings
- src/lib/prompt-slots.ts — slot functions
- src/lib/prompt-variable-registry.ts — variable registry from Phase 5
- docs/architecture/prompt-sandwich-spec.md — slot spec
- docs/architecture/control-plane-mutation-contract.md — mutation flow
- memory/feedback_user_designs_prompt.md — core philosophy

TASK 0 — Sonar Research
Run 2 Sonar Pro queries via $OPENROUTER_API_KEY:
  1. "AI agent" "prompt recomposition" derived artifact configuration-driven
  2. "no-code AI agent builder" prompt composition user interface UX patterns
Log to: CALLINGAGENTS/00-Inbox/Research-Phase6-Recomposition-UX.md via obsidian MCP.

TASK 1 — D280: Prompt recomposition engine
Create src/lib/prompt-recompose.ts:
  async function recomposePrompt(clientId: string, supabase: SupabaseClient): Promise<string>
    1. Read full client row from DB
    2. Read client_services for service catalog
    3. Read knowledge_chunks count
    4. Build SlotContext from all data
    5. Call slot functions → composePrompt()
    6. Apply section markers
    7. validatePrompt() (max 12K)
    8. Write to clients.system_prompt
    9. syncToUltravox()
    10. insertPromptVersion()

Wire as the SINGLE prompt update path in settings-patchers.ts.
Every field change triggers recomposePrompt instead of individual patchers.
Keep individual patchers as dead code for 2 weeks (rollback safety).
Remove raw prompt editing for non-admin users.
After: Update CALLINGAGENTS/Tracker/D280.md → status: done via obsidian MCP.

TASK 2 — D278: Agent Brain dashboard
Create src/app/(dashboard)/dashboard/brain/page.tsx.
Sections: Identity, Services, Knowledge Base, Call Flow, Capabilities, FAQ, Recent Gaps.
Each editable inline → triggers recomposePrompt() via settings PATCH.
Add nav link in sidebar.
After: Update CALLINGAGENTS/Tracker/D278.md → status: done via obsidian MCP.

TASK 3 — D276: Calendar auto-updates triage
In buildConversationFlow() slot, make TRIAGE booking-aware:
  If booking_enabled AND calendar connected:
    Add "If caller wants to book, proceed to CALENDAR BOOKING FLOW"
This replaces patchCalendarBlock() append-only behavior.
After: Update CALLINGAGENTS/Tracker/D276.md → status: done via obsidian MCP.

TASK 4 — D287: Niche-adaptive onboarding
Rebuild onboarding steps to adapt per niche:
  - Services step: checkboxes/chips pre-populated from NICHE_DEFAULTS, not free text
  - FAQ step: "Here's what callers ask about [niche] — edit or confirm" (pre-populated)
  - Niche-specific fields shown only when relevant (emergency handling, booking type, etc.)
  - 3-tier UX: "Decide for me" (click through) / "Let me tweak" (edit pre-filled) / "Here's my stuff" (upload)
  - Post-onboarding summary: "Here's what Alex can do right now" (from D288)
After: Update CALLINGAGENTS/Tracker/D287.md → status: done via obsidian MCP.

TASK 5 — D289: Services input UX (structured, not text box)
Replace services text box with structured chips component:
  - Pre-populated per niche from NICHE_DEFAULTS
  - Toggle on/off, add custom
  - Optional duration + price range per service
  - client_services table = single source of truth
  - Reuse same component in onboarding AND dashboard ServiceCatalogCard
After: Update CALLINGAGENTS/Tracker/D289.md → status: done via obsidian MCP.

Run: npm run build
Test recomposePrompt for e2e-test-plumbing-co. Compare output to current system_prompt.
Test onboarding flow for plumbing niche — verify chips pre-populate correctly.

GATE 6 (FINAL) CHECK — verify ALL of:
  □ Sonar research logged to CALLINGAGENTS/00-Inbox/Research-Phase6-Recomposition-UX.md
  □ recomposePrompt() produces correct prompt from DB state alone
  □ Agent Brain page loads and shows all categories
  □ Inline edits trigger recomposePrompt + Ultravox sync
  □ Non-admin users cannot see raw prompt editor
  □ Calendar toggle adapts triage flow section
  □ Onboarding adapts per niche (services chips, FAQ pre-populated)
  □ Services input uses structured chips, not text box
  □ Post-onboarding summary shows "what your agent can do"
  □ npm run build passes
  □ All tests pass
  □ D280, D278, D276, D287, D289 tracker notes all updated to status: done
  □ e2e-test-plumbing-co test call passes with recomposed prompt

HANDOFF: Write ~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase6-final.md with:
  - Sonar research summary
  - Char count for recomposed prompts (test client)
  - Files changed
  - Deployment instructions for new clients
  - Rollback plan: how to revert to patchers if recompose breaks
  - SUCCESS CRITERIA checklist (from below)
  - Obsidian notes updated
  - NEXT STEPS: optional migration path for existing 4 clients (user's choice when ready)

TEST ORDER (e2e-test-plumbing-co only):
  1. Verify recomposePrompt output matches expected
  2. Run test call via dashboard
  3. Verify tools registered correctly
  4. Verify Agent Brain page loads with correct data
```

---

## Success Criteria (check after Phase 6)

### Backend
- [ ] No system prompt exceeds 12K chars
- [ ] Average prompt 4-7K chars (was 17-20K)
- [ ] Golden tests pass at every phase boundary (100+ tests)
- [ ] Service catalog edits flow to live agent (D260)
- [ ] Owner name edits patch prompt + sync (D281)
- [ ] Business name edits patch prompt + sync (D282)
- [ ] recomposePrompt() builds correct prompt from DB state alone (D280)
- [ ] Calendar toggle adapts triage flow (D276)
- [ ] e2e-test-plumbing-co passes test call with recomposed prompt
- [ ] 4 working clients UNTOUCHED — still on their current prompts

### UX — "User Designs the Prompt"
- [ ] Every template variable visible on Agent Brain (D278/D283)
- [ ] Non-admin users cannot edit raw prompt (D280)
- [ ] "What your agent knows" surface shows facts, FAQ, services, knowledge, gaps (D290)
- [ ] "Your agent can do X right now" capability preview on dashboard + post-onboarding (D288)
- [ ] Onboarding adapts per niche — services as chips, FAQ pre-populated (D287)
- [ ] Services input uses structured chips/toggles, not text box (D289)
- [ ] Post-onboarding summary shows capabilities + knowledge count (D288)
- [ ] Dashboard settings grouped by ownership model (identity, flow, knowledge, capabilities) (D286)
- [ ] New clients provisioned after this work use the new system

## File Impact Summary

| File | Phase | Change |
|------|-------|--------|
| `src/lib/embeddings.ts` | 1 | D235 3-line fix |
| `docs/architecture/prompt-sandwich-spec.md` | 1 | NEW spec |
| `src/lib/__tests__/prompt-builder-golden.test.ts` | 1, 3 | Expand + update snapshots |
| `src/lib/prompt-slots.ts` | 2, 3, 6 | NEW — core architecture |
| `src/lib/prompt-sections.ts` | 2 | Extend markers |
| `src/lib/__tests__/prompt-slots-shadow.test.ts` | 2 | NEW shadow tests |
| `src/lib/prompt-builder.ts` | 3 | MAJOR REWRITE to use slots |
| `src/lib/prompt-config/template-body.ts` | 3 | ARCHIVE (dead code) |
| `src/lib/prompt-helpers.ts` | 3 | TRIM (remove FAQ builders) |
| `src/lib/service-catalog-sync.ts` | 4 | NEW — D260 |
| `src/lib/prompt-patcher.ts` | 4, 6 | Extend then obsolete |
| `src/lib/settings-patchers.ts` | 4, 5, 6 | Extend then replace |
| `src/lib/settings-schema.ts` | 4 | Add fields + triggers |
| `src/app/api/dashboard/services/*/route.ts` | 4 | Add sync calls |
| `src/lib/prompt-variable-registry.ts` | 5 | NEW — variable catalog |
| `components/dashboard/settings/PromptVariablesCard.tsx` | 5 | NEW — UI |
| `src/lib/prompt-recompose.ts` | 6 | NEW — recompose engine |
| `src/app/(dashboard)/dashboard/brain/page.tsx` | 6 | NEW — Agent Brain |

## Obsidian Artifacts Per Phase

| Phase | Research Note | Tracker Updates |
|-------|-------------|-----------------|
| 1 | `00-Inbox/Research-Phase1-Prompt-Architecture.md` | D235 ✅, D285 ✅ |
| 2 | `00-Inbox/Research-Phase2-Slot-Architecture.md` | D274 ✅ |
| 3 | `00-Inbox/Research-Phase3-Safety-And-RAG.md` | D265 ✅, D269 ✅, D272 ✅, D268 ✅ |
| 4 | `00-Inbox/Research-Phase4-Sync-Patterns.md` | D260 ✅, D281 ✅, D282 ✅ |
| 5 | `00-Inbox/Research-Phase5-Agent-Config-UX.md` | D283 ✅ |
| 6 | `00-Inbox/Research-Phase6-Recomposition-UX.md` | D280 ✅, D278 ✅, D276 ✅ |

**Total D-items closed:** 19 (D235, D285, D274, D265, D269, D272, D268, D260, D281, D282, D283, D286, D288, D290, D280, D278, D276, D287, D289)
**Total Sonar research notes:** 6 + 2 UI research notes
**Total golden tests target:** 100+ (currently 70 after Phase 1)

### D-item Distribution Per Phase
| Phase | D-items | Focus |
|-------|---------|-------|
| 1 ✅ | D235, D285 | Foundation — spec + tests |
| 2 | D274 | Slots — 19 functions + shadow tests |
| 3 | D265, D269, D272, D268 | Shrink — prompts < 8K |
| 4 | D260, D281, D282 | Wiring — broken fields fixed |
| 5 | D283, D286, D288, D290 | UX — variables visible, capabilities shown, knowledge surface |
| 6 | D280, D278, D276, D287, D289 | North Star — recompose, Agent Brain, niche onboarding, structured services |

## Handoff Protocol

Each phase writes a handoff to:
```
~/.claude/projects/-Users-owner-Downloads-CALLING-AGENTs/handoff-phase{N}.md
```

Each handoff MUST contain:
1. Sonar research summary (key findings, surprises, conflicts)
2. Files changed (with line counts if significant)
3. Gate status (all checks with [ ]/[x])
4. Char counts (before/after if applicable)
5. Risks discovered
6. Obsidian notes updated (list them)
7. "Next phase reads:" pointer to what the next session needs
8. Rollback instructions if applicable

**Opus rule:** Write handoff after ~15 tool calls OR when a phase completes, whichever comes first. If approaching compaction, write handoff IMMEDIATELY — do NOT let context be lost. If a phase takes 2+ compactions, write intermediate handoffs (`handoff-phase{N}-part{M}.md`).
