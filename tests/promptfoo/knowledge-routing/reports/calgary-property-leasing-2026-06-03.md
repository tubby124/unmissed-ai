# Knowledge-Routing Audit — calgary-property-leasing

**Generated:** 2026-06-03T20:19:58.410Z
**Audit version:** 1.1.0
**Git:** cef527cec193 on `main` (dirty working tree)
**Client:** calgary-property-leasing (property_management)
**Agent ID:** a30e9023-9dc5-4aa7-b7cf-b1cf623fb082
**Deployed prompt:** 23,184 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 52

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 5 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 4 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
0/5 scenarios match KB content · 5 empty results (corpus gaps)

    [areas-served          ] EMBED FAILED
    [rent-guarantee        ] EMBED FAILED
    [pets-policy           ] EMBED FAILED
    [application-process   ] EMBED FAILED
    [services-offered      ] EMBED FAILED

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        23,184 chars · sha=666770764a2d
  Ultravox callTemplate.systemPrompt: 22,381 chars · sha=9bee2028da3a
  Normalized DB sha=1939decc200f · Normalized Ultravox sha=1939decc200f

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
23,184c prompt + 9 tool instructions → high instruction-fatigue risk (GLM-4.6 long-context degradation)

  Total prompt: 23,184 chars · target 12,000 (ratio 1.93x)
  Tool instructions (queryKnowledge mentions): 9
    L  33: 9. ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy q…
    L  36: 12. SCOPE: For general building policies (parking layout, pet rules at the build…
    L  51: BEFORE deflecting any factual question (services, hours, general policies, areas…
    L 128: 1. Bridge first — say one of these out loud BEFORE queryKnowledge fires: "yeah l…
    L 130: 2. Call queryKnowledge with the topic.
    L 138: 6. If queryKnowledge returns nothing useful OR caller asks for case-specific det…
    L 155: → For GENERAL questions about how the building works (areas covered, building am…
    L 245: When the caller asks a factual question about the business (services, pricing, h…
    L 248: If queryKnowledge returns no results or an empty answer: say "I don't have that …

## Suspect Ranking

**1. Corpus gaps — 5/5 scenarios return zero results (areas-served, rent-guarantee, pets-policy, application-process, services-offered)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt-bloat instruction fatigue (23,184c + 9 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.