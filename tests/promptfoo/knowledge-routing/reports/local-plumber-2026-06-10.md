# Knowledge-Routing Audit — local-plumber

**Generated:** 2026-06-10T22:27:32.638Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** local-plumber (plumbing)
**Agent ID:** 21cff67f-e218-491d-9e9b-0ccf1f4ec1f7
**Deployed prompt:** 22,098 chars · hand_tuned=false
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

  DB clients.system_prompt:        22,098 chars · sha=8d65df3fb181
  Ultravox callTemplate.systemPrompt: 22,470 chars · sha=de126659dc76
  Normalized DB sha=5c8b303429d6 · Normalized Ultravox sha=5c8b303429d6

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (22,098c) — compression recommended

  Total prompt: 22,098 chars · target 12,000 (ratio 1.84x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 3/3 scenarios return zero results (service-area, services-offered, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (22,098c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.