# Knowledge-Routing Audit — it-consulting-it-support-web-consulting-cloud-services

**Generated:** 2026-06-10T22:27:26.613Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** it-consulting-it-support-web-consulting-cloud-services (other)
**Agent ID:** cf0edb30-2470-4e83-be08-eb26d57acf5b
**Deployed prompt:** 13,080 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 4

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
1/3 scenarios match KB content · 2 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✓ 1 chunks · sim=0.589 · tier=medium
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        13,080 chars · sha=4fca74023370
  Ultravox callTemplate.systemPrompt: 12,460 chars · sha=e66414da0a87
  Normalized DB sha=5e8b472072a5 · Normalized Ultravox sha=5e8b472072a5

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (13,080c) — compression recommended

  Total prompt: 13,080 chars · target 12,000 (ratio 1.09x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 2/3 scenarios return zero results (service-area, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt over 12K target (13,080c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.