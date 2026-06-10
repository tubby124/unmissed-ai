# Knowledge-Routing Audit — brazzers-office

**Generated:** 2026-06-10T22:26:39.401Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** brazzers-office (salon)
**Agent ID:** 56bd534f-9677-4929-a299-b5540ac3d384
**Deployed prompt:** 18,018 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 13

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
2/3 scenarios match KB content · 1 empty results (corpus gaps)

    [service-area          ] ✓ 1 chunks · sim=0.461 · tier=medium
    [services-offered      ] ✓ 2 chunks · sim=0.445 · tier=medium
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        18,018 chars · sha=dccc65c7950d
  Ultravox callTemplate.systemPrompt: 18,279 chars · sha=e7c9451825b1
  Normalized DB sha=f82229518865 · Normalized Ultravox sha=f82229518865

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (18,018c) — compression recommended

  Total prompt: 18,018 chars · target 12,000 (ratio 1.50x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 1/3 scenarios return zero results (pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt over 12K target (18,018c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.