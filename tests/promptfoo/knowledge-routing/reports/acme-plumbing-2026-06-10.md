# Knowledge-Routing Audit — acme-plumbing

**Generated:** 2026-06-10T22:26:13.647Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** acme-plumbing (hvac)
**Agent ID:** ad3318c1-9830-458a-a46f-889115c33928
**Deployed prompt:** 18,187 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 24

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
0/3 scenarios match KB content · 3 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✗ 0 chunks · sim=---- · tier=----
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        18,187 chars · sha=01367fb04c39
  Ultravox callTemplate.systemPrompt: 18,448 chars · sha=d48f5352db7f
  Normalized DB sha=c7d37bcac35b · Normalized Ultravox sha=c7d37bcac35b

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (18,187c) — compression recommended

  Total prompt: 18,187 chars · target 12,000 (ratio 1.52x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 3/3 scenarios return zero results (service-area, services-offered, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt over 12K target (18,187c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.