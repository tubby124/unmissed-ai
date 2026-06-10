# Knowledge-Routing Audit — speedy-glass-calgary-crowfoot

**Generated:** 2026-06-10T22:28:28.051Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** speedy-glass-calgary-crowfoot (auto_glass)
**Agent ID:** be66247e-de45-44a3-9f12-c3ced41b192f
**Deployed prompt:** 19,897 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 17

## Check Results

### 🟠 Check 1 — Tool Registration
queryKnowledge in DB only (runtime OK via toolOverrides, but Ultravox stored config is stale)

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 2 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
1/4 scenarios match KB content

    [service-area          ] ✓ 1 chunks · sim=0.460 · tier=medium
    [mobile-service        ] ⚠ 5 chunks · sim=0.669 · tier=medium
    [insurance-claims      ] ⚠ 5 chunks · sim=0.687 · tier=medium
    [warranty              ] ⚠ 5 chunks · sim=0.705 · tier=medium

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        19,897 chars · sha=2e6f36cd38bc
  Ultravox callTemplate.systemPrompt: 20,269 chars · sha=5ce2e60c092c
  Normalized DB sha=4c2436251f1a · Normalized Ultravox sha=4c2436251f1a

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (19,897c) — compression recommended

  Total prompt: 19,897 chars · target 12,000 (ratio 1.66x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Ultravox stored tools stale (runtime via clients.tools is OK)** — probability: LOW (cosmetic)
   → Fix: Optional: call updateAgent() to refresh Ultravox stored config. Runtime tool path is fine via toolOverrides.

**2. Corpus gaps — 0/4 scenarios return zero results ()** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (19,897c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.