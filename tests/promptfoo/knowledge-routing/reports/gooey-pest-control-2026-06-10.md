# Knowledge-Routing Audit — gooey-pest-control

**Generated:** 2026-06-10T22:27:20.676Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** gooey-pest-control (other)
**Agent ID:** 4ca7dd19-3fd5-45a9-b078-8d7bc595469e
**Deployed prompt:** 17,408 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 25

## Check Results

### 🟠 Check 1 — Tool Registration
queryKnowledge in DB only (runtime OK via toolOverrides, but Ultravox stored config is stale)

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 4 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 2 tools total · queryKnowledge MISSING ✗

### ✅ Check 2 — pgvector Content
3/3 scenarios match KB content

    [service-area          ] ✓ 1 chunks · sim=0.518 · tier=medium
    [services-offered      ] ✓ 3 chunks · sim=0.623 · tier=high
    [pricing-general       ] ✓ 2 chunks · sim=0.490 · tier=medium

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        17,408 chars · sha=cc876756e16b
  Ultravox callTemplate.systemPrompt: 17,780 chars · sha=fc24dca6da75
  Normalized DB sha=286bad5e7f6e · Normalized Ultravox sha=286bad5e7f6e

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (17,408c) — compression recommended

  Total prompt: 17,408 chars · target 12,000 (ratio 1.45x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Ultravox stored tools stale (runtime via clients.tools is OK)** — probability: LOW (cosmetic)
   → Fix: Optional: call updateAgent() to refresh Ultravox stored config. Runtime tool path is fine via toolOverrides.

**2. Prompt over 12K target (17,408c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

_(none — audit clean)_