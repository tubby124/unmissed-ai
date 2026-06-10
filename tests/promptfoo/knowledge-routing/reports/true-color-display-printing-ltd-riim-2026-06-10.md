# Knowledge-Routing Audit — true-color-display-printing-ltd-riim

**Generated:** 2026-06-10T22:28:45.003Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** true-color-display-printing-ltd-riim (print_shop)
**Agent ID:** 2b0faf3d-9fa4-4667-ab04-2cccbfff355b
**Deployed prompt:** 20,135 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 0

## Check Results

### 🔴 Check 1 — Tool Registration
queryKnowledge missing from both DB and Ultravox — tool never registered

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 2 tools total · queryKnowledge MISSING ✗
  Ultravox callTemplate.selectedTools: 2 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
0/3 scenarios match KB content · 3 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✗ 0 chunks · sim=---- · tier=----
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        20,135 chars · sha=7812a362ef6b
  Ultravox callTemplate.systemPrompt: 19,658 chars · sha=aef66aec3a83
  Normalized DB sha=9e6e5fe0be3d · Normalized Ultravox sha=9e6e5fe0be3d

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (20,135c) — compression recommended

  Total prompt: 20,135 chars · target 12,000 (ratio 1.68x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 3/3 scenarios return zero results (service-area, services-offered, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (20,135c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.