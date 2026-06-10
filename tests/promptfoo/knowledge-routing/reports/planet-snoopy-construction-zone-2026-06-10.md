# Knowledge-Routing Audit — planet-snoopy-construction-zone

**Generated:** 2026-06-10T22:27:58.157Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** planet-snoopy-construction-zone (other)
**Agent ID:** c7afb196-ef67-4eef-baea-d4b12ee185e8
**Deployed prompt:** 12,939 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 10

## Check Results

### 🟠 Check 1 — Tool Registration
queryKnowledge in DB only (runtime OK via toolOverrides, but Ultravox stored config is stale)

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 2 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
2/3 scenarios match KB content · 1 empty results (corpus gaps)

    [service-area          ] ✓ 1 chunks · sim=0.477 · tier=medium
    [services-offered      ] ✓ 2 chunks · sim=0.354 · tier=medium
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        12,939 chars · sha=d2debd9fd3c8
  Ultravox callTemplate.systemPrompt: 13,311 chars · sha=fdd2ec9d974b
  Normalized DB sha=142678ce29cf · Normalized Ultravox sha=142678ce29cf

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (12,939c) — compression recommended

  Total prompt: 12,939 chars · target 12,000 (ratio 1.08x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Ultravox stored tools stale (runtime via clients.tools is OK)** — probability: LOW (cosmetic)
   → Fix: Optional: call updateAgent() to refresh Ultravox stored config. Runtime tool path is fine via toolOverrides.

**2. Corpus gaps — 1/3 scenarios return zero results (pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (12,939c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.