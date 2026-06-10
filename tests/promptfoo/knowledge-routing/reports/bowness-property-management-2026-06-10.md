# Knowledge-Routing Audit — bowness-property-management

**Generated:** 2026-06-10T22:26:36.168Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** bowness-property-management (property_management)
**Agent ID:** ce4bbe2b-6f7d-4f32-b3ce-e9b044aeef3e
**Deployed prompt:** 24,788 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 0

## Check Results

### 🔴 Check 1 — Tool Registration
queryKnowledge missing from both DB and Ultravox — tool never registered

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge MISSING ✗
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
0/5 scenarios match KB content · 5 empty results (corpus gaps)

    [areas-served          ] ✗ 0 chunks · sim=---- · tier=----
    [rent-guarantee        ] ✗ 0 chunks · sim=---- · tier=----
    [pets-policy           ] ✗ 0 chunks · sim=---- · tier=----
    [application-process   ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        24,788 chars · sha=443468cd5711
  Ultravox callTemplate.systemPrompt: 24,050 chars · sha=ad0661b6ede0
  Normalized DB sha=b4e472a5c980 · Normalized Ultravox sha=b4e472a5c980

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (24,788c) — compression recommended

  Total prompt: 24,788 chars · target 12,000 (ratio 2.07x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 5/5 scenarios return zero results (areas-served, rent-guarantee, pets-policy, application-process, services-offered)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (24,788c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.