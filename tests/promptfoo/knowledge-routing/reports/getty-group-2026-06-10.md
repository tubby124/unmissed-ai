# Knowledge-Routing Audit — getty-group

**Generated:** 2026-06-10T22:27:17.284Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** getty-group (real_estate)
**Agent ID:** e266d93e-02f8-44e9-8ece-7cd03c23965a
**Deployed prompt:** 8,478 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 18

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
0/4 scenarios match KB content · 3 empty results (corpus gaps)

    [service-area          ] ⚠ 1 chunks · sim=0.463 · tier=medium
    [commission-structure  ] ✗ 0 chunks · sim=---- · tier=----
    [first-time-buyer      ] ✗ 0 chunks · sim=---- · tier=----
    [showing-process       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        8,478 chars · sha=890feaa12bbd
  Ultravox callTemplate.systemPrompt: 8,850 chars · sha=0f0220f7a080
  Normalized DB sha=890feaa12bbd · Normalized Ultravox sha=890feaa12bbd

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
No queryKnowledge instructions in prompt — agent has no priming to call the tool

  Total prompt: 8,478 chars · target 12,000 (ratio 0.71x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 3/4 scenarios return zero results (commission-structure, first-time-buyer, showing-process)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt-bloat instruction fatigue (8,478c + 0 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.