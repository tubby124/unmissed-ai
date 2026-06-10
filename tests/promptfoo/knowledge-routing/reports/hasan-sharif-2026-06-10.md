# Knowledge-Routing Audit — hasan-sharif

**Generated:** 2026-06-10T22:27:23.805Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** hasan-sharif (real_estate)
**Agent ID:** f19b4ad7-233e-4125-a547-94e007238cf8
**Deployed prompt:** 8,361 chars · hand_tuned=true
**Knowledge backend:** pgvector · approved chunks: 29

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 7 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 7 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
2/4 scenarios match KB content · 1 empty results (corpus gaps)

    [service-area          ] ⚠ 2 chunks · sim=0.502 · tier=medium
    [commission-structure  ] ✓ 1 chunks · sim=0.537 · tier=medium
    [first-time-buyer      ] ✗ 0 chunks · sim=---- · tier=----
    [showing-process       ] ✓ 1 chunks · sim=0.693 · tier=medium

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        8,361 chars · sha=617a40fafc28
  Ultravox callTemplate.systemPrompt: 8,714 chars · sha=28f373494da2
  Normalized DB sha=8b15210f047b · Normalized Ultravox sha=8b15210f047b

### ✅ Check 4 — Prompt-Bloat Instruction Fatigue
Prompt within bounds (8,361c, 5 tool instructions)

  Total prompt: 8,361 chars · target 12,000 (ratio 0.70x)
  Tool instructions (queryKnowledge mentions): 5
    L  40: MANDATORY: Before EVER saying "that's a Hasan question" or "I don't have those d…
    L  41: When to call queryKnowledge: halal, financing, Manzil, Islamic mortgage, specifi…
    L  42: How: say "let me check on that..." THEN call queryKnowledge with the caller's qu…
    L  93: Halal, financing, Manzil, Islamic mortgage, specific programs, specializations: …
    L  94: Prices, commission rates, legal advice: "that's a Hasan question — he'll have th…

## Suspect Ranking

**1. Corpus gaps — 1/4 scenarios return zero results (first-time-buyer)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

## Next Actions

- Reseed corpus for the empty-result scenarios.