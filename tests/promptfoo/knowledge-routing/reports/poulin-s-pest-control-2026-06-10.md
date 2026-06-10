# Knowledge-Routing Audit — poulin-s-pest-control

**Generated:** 2026-06-10T22:28:09.944Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** poulin-s-pest-control (pest_control)
**Agent ID:** 24aa7d7d-cc1f-4dc3-aab9-99973520a337
**Deployed prompt:** 17,458 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 16

## Check Results

### 🟠 Check 1 — Tool Registration
queryKnowledge in DB only (runtime OK via toolOverrides, but Ultravox stored config is stale)

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 2 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
2/3 scenarios match KB content · 1 empty results (corpus gaps)

    [service-area          ] ✓ 1 chunks · sim=0.554 · tier=medium
    [services-offered      ] ✓ 3 chunks · sim=0.550 · tier=medium
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        17,458 chars · sha=e81194ba4e68
  Ultravox callTemplate.systemPrompt: 17,830 chars · sha=8c6403596643
  Normalized DB sha=5aafe56c6803 · Normalized Ultravox sha=5aafe56c6803

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (17,458c) — compression recommended

  Total prompt: 17,458 chars · target 12,000 (ratio 1.45x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Ultravox stored tools stale (runtime via clients.tools is OK)** — probability: LOW (cosmetic)
   → Fix: Optional: call updateAgent() to refresh Ultravox stored config. Runtime tool path is fine via toolOverrides.

**2. Corpus gaps — 1/3 scenarios return zero results (pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (17,458c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.