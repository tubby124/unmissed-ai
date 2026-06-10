# Knowledge-Routing Audit — velly-remodeling

**Generated:** 2026-06-10T22:29:01.635Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** velly-remodeling (home_renovation)
**Agent ID:** 2164eda9-764d-41ce-9c8a-054e2d5458e1
**Deployed prompt:** 20,680 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 16

## Check Results

### 🔴 Check 1 — Tool Registration
queryKnowledge missing from both DB and Ultravox — tool never registered

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 2 tools total · queryKnowledge MISSING ✗
  Ultravox callTemplate.selectedTools: 2 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
2/3 scenarios match KB content · 1 empty results (corpus gaps)

    [service-area          ] ✓ 1 chunks · sim=0.603 · tier=medium
    [services-offered      ] ✓ 3 chunks · sim=0.509 · tier=medium
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        20,680 chars · sha=6ed80527884d
  Ultravox callTemplate.systemPrompt: 19,934 chars · sha=3fa7ad83fea4
  Normalized DB sha=29180c7025d7 · Normalized Ultravox sha=29180c7025d7

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
20,680c prompt + 7 tool instructions → high instruction-fatigue risk (GLM-4.6 long-context degradation)

  Total prompt: 20,680 chars · target 12,000 (ratio 1.72x)
  Tool instructions (queryKnowledge mentions): 7
    L  33: 9. ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy q…
    L  35: 11. PRICING: For general published rates (per-sq-ft ranges, hourly rates, packag…
    L  47: DEFAULT for factual questions (fees, policies, procedures), bridge then queryKno…
    L  49: EXCEPTION — IDENTITY (5 topics: areas served, hours, business model, what you do…
    L  51: No queryKnowledge for greetings, emergencies, or booking confirmations.
    L 200: When the caller asks a factual question about the business (services, pricing, h…
    L 203: If queryKnowledge returns no results or an empty answer: say "I don't have that …

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 1/3 scenarios return zero results (pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt-bloat instruction fatigue (20,680c + 7 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.