# Knowledge-Routing Audit — unmissed-demo

**Generated:** 2026-06-10T22:28:48.327Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** unmissed-demo (other)
**Agent ID:** 74ccdadb-cd75-4453-baa0-615cff30c63c
**Deployed prompt:** 17,018 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 44

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 7 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 7 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
1/3 scenarios match KB content · 2 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✓ 1 chunks · sim=0.227 · tier=high
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        17,018 chars · sha=b92d0bc2ad8f
  Ultravox callTemplate.systemPrompt: 16,154 chars · sha=cb2a4e6cba09
  Normalized DB sha=0c6dfc3a9a75 · Normalized Ultravox sha=0c6dfc3a9a75

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
17,018c prompt + 4 tool instructions → high instruction-fatigue risk (GLM-4.6 long-context degradation)

  Total prompt: 17,018 chars · target 12,000 (ratio 1.42x)
  Tool instructions (queryKnowledge mentions): 4
    L  33: 9. ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy q…
    L  37: For any factual question about the business (services, hours, pricing, policies,…
    L 233: When the caller asks a factual question about the business (services, pricing, h…
    L 236: If queryKnowledge returns no results or an empty answer: say "I don't have that …

## Suspect Ranking

**1. Corpus gaps — 2/3 scenarios return zero results (service-area, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt-bloat instruction fatigue (17,018c + 4 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.