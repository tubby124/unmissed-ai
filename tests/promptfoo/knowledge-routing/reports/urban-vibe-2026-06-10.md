# Knowledge-Routing Audit — urban-vibe

**Generated:** 2026-06-10T22:28:52.527Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** urban-vibe (property_management)
**Agent ID:** 5f88f03b-5aaf-40fc-a608-2f7ed765d6a6
**Deployed prompt:** 22,667 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 34

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 7 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 7 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
2/5 scenarios match KB content · 2 empty results (corpus gaps)

    [areas-served          ] ✗ 0 chunks · sim=---- · tier=----
    [rent-guarantee        ] ✗ 0 chunks · sim=---- · tier=----
    [pets-policy           ] ✓ 1 chunks · sim=0.542 · tier=medium
    [application-process   ] ⚠ 4 chunks · sim=0.484 · tier=medium
    [services-offered      ] ✓ 2 chunks · sim=0.544 · tier=medium

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        22,667 chars · sha=f0524a650a35
  Ultravox callTemplate.systemPrompt: 21,872 chars · sha=44f07b82e07a
  Normalized DB sha=e13e4a7cb332 · Normalized Ultravox sha=e13e4a7cb332

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
22,667c prompt + 9 tool instructions → high instruction-fatigue risk (GLM-4.6 long-context degradation)

  Total prompt: 22,667 chars · target 12,000 (ratio 1.89x)
  Tool instructions (queryKnowledge mentions): 9
    L  33: 9. ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy q…
    L  36: 12. SCOPE: For general building policies (parking layout, pet rules at the build…
    L  45: BEFORE deflecting any factual question (services, hours, general policies, areas…
    L 121: 1. Bridge first — say one of these out loud BEFORE queryKnowledge fires: "yeah l…
    L 123: 2. Call queryKnowledge with the topic.
    L 131: 6. If queryKnowledge returns nothing useful OR caller asks for case-specific det…
    L 148: → For GENERAL questions about how the building works (areas covered, building am…
    L 234: When the caller asks a factual question about the business (services, pricing, h…
    L 237: If queryKnowledge returns no results or an empty answer: say "I don't have that …

## Suspect Ranking

**1. Corpus gaps — 2/5 scenarios return zero results (areas-served, rent-guarantee)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt-bloat instruction fatigue (22,667c + 9 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.