# Knowledge-Routing Audit — e2e-test-plumbing-co

**Generated:** 2026-06-10T22:26:55.031Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** e2e-test-plumbing-co (plumbing)
**Agent ID:** be59c7a9-1f2d-4d79-b0de-d3c51946491f
**Deployed prompt:** 14,157 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 15

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 5 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 5 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
1/3 scenarios match KB content · 2 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✗ 0 chunks · sim=---- · tier=----
    [pricing-general       ] ✓ 1 chunks · sim=0.521 · tier=high

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        14,157 chars · sha=56dc6077ecd0
  Ultravox callTemplate.systemPrompt: 12,044 chars · sha=effc2e9d3b79
  Normalized DB sha=16c96b77d7e5 · Normalized Ultravox sha=16c96b77d7e5

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (14,157c) — compression recommended

  Total prompt: 14,157 chars · target 12,000 (ratio 1.18x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 2/3 scenarios return zero results (service-area, services-offered)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt over 12K target (14,157c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.