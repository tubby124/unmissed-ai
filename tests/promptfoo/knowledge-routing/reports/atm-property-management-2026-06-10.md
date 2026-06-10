# Knowledge-Routing Audit — atm-property-management

**Generated:** 2026-06-10T22:26:27.065Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** atm-property-management (property_management)
**Agent ID:** b78042ff-b017-4f75-9126-4af22e85e919
**Deployed prompt:** 21,169 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 51

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
0/5 scenarios match KB content · 3 empty results (corpus gaps)

    [areas-served          ] ⚠ 2 chunks · sim=0.591 · tier=high
    [rent-guarantee        ] ✗ 0 chunks · sim=---- · tier=----
    [pets-policy           ] ✗ 0 chunks · sim=---- · tier=----
    [application-process   ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ⚠ 5 chunks · sim=0.613 · tier=high

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        21,169 chars · sha=2d8f270c5d7d
  Ultravox callTemplate.systemPrompt: 21,430 chars · sha=754c6a5f5d34
  Normalized DB sha=f949d406a8e6 · Normalized Ultravox sha=f949d406a8e6

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (21,169c) — compression recommended

  Total prompt: 21,169 chars · target 12,000 (ratio 1.76x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 3/5 scenarios return zero results (rent-guarantee, pets-policy, application-process)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt over 12K target (21,169c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.