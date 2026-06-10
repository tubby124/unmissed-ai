# Knowledge-Routing Audit — roto-rooter-plumbing-water-cleanup

**Generated:** 2026-06-10T22:28:24.436Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** roto-rooter-plumbing-water-cleanup (plumbing)
**Agent ID:** 479c5673-e59c-46fc-8fd6-7e7d5b98d48a
**Deployed prompt:** 18,024 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 19

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
2/3 scenarios match KB content · 1 empty results (corpus gaps)

    [service-area          ] ✓ 1 chunks · sim=0.451 · tier=medium
    [services-offered      ] ✓ 5 chunks · sim=0.423 · tier=medium
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        18,024 chars · sha=6ae20e5a645d
  Ultravox callTemplate.systemPrompt: 18,285 chars · sha=1ee048e4aba9
  Normalized DB sha=0446aec92a69 · Normalized Ultravox sha=0446aec92a69

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (18,024c) — compression recommended

  Total prompt: 18,024 chars · target 12,000 (ratio 1.50x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 1/3 scenarios return zero results (pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt over 12K target (18,024c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.