# Knowledge-Routing Audit — adventure-printing-ltd

**Generated:** 2026-06-10T22:26:18.310Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** adventure-printing-ltd (print_shop)
**Agent ID:** 811f7da3-a930-4644-903d-e7a8145db603
**Deployed prompt:** 19,132 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 34

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 4 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 4 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
2/3 scenarios match KB content · 1 empty results (corpus gaps)

    [service-area          ] ✓ 2 chunks · sim=0.596 · tier=medium
    [services-offered      ] ✓ 5 chunks · sim=0.549 · tier=high
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        19,132 chars · sha=1235be097a1e
  Ultravox callTemplate.systemPrompt: 18,589 chars · sha=764853460546
  Normalized DB sha=3f483557d844 · Normalized Ultravox sha=3f483557d844

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (19,132c) — compression recommended

  Total prompt: 19,132 chars · target 12,000 (ratio 1.59x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 1/3 scenarios return zero results (pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt over 12K target (19,132c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.