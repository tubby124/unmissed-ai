# Knowledge-Routing Audit — plum-coffee-and-cocktails

**Generated:** 2026-06-10T22:28:01.104Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** plum-coffee-and-cocktails (restaurant)
**Agent ID:** d71a1de1-fff4-4251-a13c-fd6c1f8d11ee
**Deployed prompt:** 76 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 3

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
1/3 scenarios match KB content · 2 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✓ 1 chunks · sim=0.459 · tier=medium
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        76 chars · sha=f76d94fba60b
  Ultravox callTemplate.systemPrompt: 448 chars · sha=85e9c3f75aba
  Normalized DB sha=f76d94fba60b · Normalized Ultravox sha=f76d94fba60b

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
No queryKnowledge instructions in prompt — agent has no priming to call the tool

  Total prompt: 76 chars · target 12,000 (ratio 0.01x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 2/3 scenarios return zero results (service-area, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt-bloat instruction fatigue (76c + 0 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.