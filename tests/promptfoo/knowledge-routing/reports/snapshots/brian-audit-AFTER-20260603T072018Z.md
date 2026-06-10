# Knowledge-Routing Audit — calgary-property-leasing

**Generated:** 2026-06-03T07:20:22.464Z
**Audit version:** 1.1.0
**Git:** ee65ea2f1e0a on `main` (dirty working tree)
**Client:** calgary-property-leasing (property_management)
**Agent ID:** a30e9023-9dc5-4aa7-b7cf-b1cf623fb082
**Deployed prompt:** 22,922 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 51

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 5 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 5 tools total · queryKnowledge PRESENT ✓

### 🟠 Check 2 — pgvector Content
4/5 scenarios match KB content · 1 empty results (corpus gaps)

    [areas-served          ] ✓ 3 chunks · sim=0.566 · tier=high
    [rent-guarantee        ] ✓ 2 chunks · sim=0.779 · tier=high
    [pets-policy           ] ✗ 0 chunks · sim=---- · tier=----
    [application-process   ] ✓ 2 chunks · sim=0.492 · tier=high
    [services-offered      ] ✓ 4 chunks · sim=0.699 · tier=high

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        22,922 chars · sha=e6e75fee6e13
  Ultravox callTemplate.systemPrompt: 22,190 chars · sha=aee775873680
  Normalized DB sha=0822ba3ccaab · Normalized Ultravox sha=0822ba3ccaab

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
22,922c prompt + 9 tool instructions → high instruction-fatigue risk (GLM-4.6 long-context degradation)

  Total prompt: 22,922 chars · target 12,000 (ratio 1.91x)
  Tool instructions (queryKnowledge mentions): 9
    L  33: 9. ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy q…
    L  36: 12. SCOPE: For general building policies (parking layout, pet rules at the build…
    L  51: BEFORE deflecting any factual question (services, hours, general policies, areas…
    L 128: 1. Bridge first — say one of these out loud BEFORE queryKnowledge fires: "yeah l…
    L 130: 2. Call queryKnowledge with the topic.
    L 138: 6. If queryKnowledge returns nothing useful OR caller asks for case-specific det…
    L 155: → For GENERAL questions about how the building works (areas covered, building am…
    L 243: When the caller asks a factual question about the business (services, pricing, h…
    L 246: If queryKnowledge returns no results or an empty answer: say "I don't have that …

## Suspect Ranking

**1. Partial corpus coverage — 1 scenarios returned chunks but content did not match expected patterns (pets-policy)** — probability: MEDIUM
   → Fix: Review the top chunk content for the gap scenarios — may be a scenario-pattern mismatch (update mustMatchAny in scenarios.ts) or a corpus refinement need.

**2. Prompt-bloat instruction fatigue (22,922c + 9 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.