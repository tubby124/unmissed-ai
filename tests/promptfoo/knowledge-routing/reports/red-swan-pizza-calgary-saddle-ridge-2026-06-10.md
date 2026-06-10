# Knowledge-Routing Audit — red-swan-pizza-calgary-saddle-ridge

**Generated:** 2026-06-10T22:28:17.246Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** red-swan-pizza-calgary-saddle-ridge (restaurant)
**Agent ID:** fc9e7039-9be5-418a-a176-b2296e0727a8
**Deployed prompt:** 18,847 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 28

## Check Results

### 🟠 Check 1 — Tool Registration
queryKnowledge in DB only (runtime OK via toolOverrides, but Ultravox stored config is stale)

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 2 tools total · queryKnowledge MISSING ✗

### ✅ Check 2 — pgvector Content
3/3 scenarios match KB content

    [service-area          ] ✓ 1 chunks · sim=0.631 · tier=medium
    [services-offered      ] ✓ 3 chunks · sim=0.477 · tier=medium
    [pricing-general       ] ✓ 1 chunks · sim=0.458 · tier=medium

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        18,847 chars · sha=e7d7f99f1d59
  Ultravox callTemplate.systemPrompt: 19,219 chars · sha=9ad3b2f7a6b2
  Normalized DB sha=5e9543204c71 · Normalized Ultravox sha=5e9543204c71

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (18,847c) — compression recommended

  Total prompt: 18,847 chars · target 12,000 (ratio 1.57x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Ultravox stored tools stale (runtime via clients.tools is OK)** — probability: LOW (cosmetic)
   → Fix: Optional: call updateAgent() to refresh Ultravox stored config. Runtime tool path is fine via toolOverrides.

**2. Prompt over 12K target (18,847c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

_(none — audit clean)_