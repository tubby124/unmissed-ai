# Knowledge-Routing Audit — bowness-property-group

**Generated:** 2026-06-10T22:26:32.000Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** bowness-property-group (property_management)
**Agent ID:** 04757468-12c4-40ba-b696-a5640ae48101
**Deployed prompt:** 11,971 chars · hand_tuned=false
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

  DB clients.system_prompt:        11,971 chars · sha=5bf69421044a
  Ultravox callTemplate.systemPrompt: 12,343 chars · sha=33c8c507f6e5
  Normalized DB sha=18e14429f265 · Normalized Ultravox sha=18e14429f265

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
No queryKnowledge instructions in prompt — agent has no priming to call the tool

  Total prompt: 11,971 chars · target 12,000 (ratio 1.00x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 5/5 scenarios return zero results (areas-served, rent-guarantee, pets-policy, application-process, services-offered)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt-bloat instruction fatigue (11,971c + 0 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.