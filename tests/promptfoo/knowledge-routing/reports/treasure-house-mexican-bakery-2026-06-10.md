# Knowledge-Routing Audit — treasure-house-mexican-bakery

**Generated:** 2026-06-10T22:28:41.481Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** treasure-house-mexican-bakery (restaurant)
**Agent ID:** 7570fa9d-2f53-4608-baa3-a33607656ee7
**Deployed prompt:** 11,200 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 18

## Check Results

### 🔴 Check 1 — Tool Registration
queryKnowledge missing from both DB and Ultravox — tool never registered

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 1 tools total · queryKnowledge MISSING ✗
  Ultravox callTemplate.selectedTools: 1 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
2/3 scenarios match KB content · 1 empty results (corpus gaps)

    [service-area          ] ✓ 1 chunks · sim=0.518 · tier=medium
    [services-offered      ] ✓ 2 chunks · sim=0.484 · tier=medium
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        11,200 chars · sha=ef2e9c147cf1
  Ultravox callTemplate.systemPrompt: 10,637 chars · sha=b4afc258e06a
  Normalized DB sha=0303bad484cf · Normalized Ultravox sha=0303bad484cf

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
No queryKnowledge instructions in prompt — agent has no priming to call the tool

  Total prompt: 11,200 chars · target 12,000 (ratio 0.93x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 1/3 scenarios return zero results (pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt-bloat instruction fatigue (11,200c + 0 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.