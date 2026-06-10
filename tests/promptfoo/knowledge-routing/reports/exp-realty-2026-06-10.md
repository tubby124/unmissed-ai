# Knowledge-Routing Audit — exp-realty

**Generated:** 2026-06-10T22:27:14.076Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** exp-realty (real_estate)
**Agent ID:** c9019927-49a7-4676-b97b-5c6395e58a37
**Deployed prompt:** 10,628 chars · hand_tuned=true
**Knowledge backend:** pgvector · approved chunks: 18

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 7 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 7 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
1/4 scenarios match KB content · 3 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [commission-structure  ] ✗ 0 chunks · sim=---- · tier=----
    [first-time-buyer      ] ✗ 0 chunks · sim=---- · tier=----
    [showing-process       ] ✓ 2 chunks · sim=0.671 · tier=medium

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        10,628 chars · sha=e8a3f5036710
  Ultravox callTemplate.systemPrompt: 10,981 chars · sha=6790c8d3f6eb
  Normalized DB sha=8594786df2ac · Normalized Ultravox sha=8594786df2ac

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
No queryKnowledge instructions in prompt — agent has no priming to call the tool

  Total prompt: 10,628 chars · target 12,000 (ratio 0.89x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 3/4 scenarios return zero results (service-area, commission-structure, first-time-buyer)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt-bloat instruction fatigue (10,628c + 0 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Reseed corpus for the empty-result scenarios.
- Phase 2d niche-defaults compression is the critical path. Phase 2b alone will not help — recompose currently rejects this client at >12K.