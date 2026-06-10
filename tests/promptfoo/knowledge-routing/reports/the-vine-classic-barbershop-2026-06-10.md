# Knowledge-Routing Audit — the-vine-classic-barbershop

**Generated:** 2026-06-10T22:28:33.888Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** the-vine-classic-barbershop (salon)
**Agent ID:** b9c60fdd-52db-4f50-8e19-7d526cdac024
**Deployed prompt:** 11,196 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 9

## Check Results

### 🔴 Check 1 — Tool Registration
queryKnowledge missing from both DB and Ultravox — tool never registered

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 1 tools total · queryKnowledge MISSING ✗
  Ultravox callTemplate.selectedTools: 1 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
1/3 scenarios match KB content · 2 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✓ 1 chunks · sim=0.494 · tier=high
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        11,196 chars · sha=cc96fd31ebc6
  Ultravox callTemplate.systemPrompt: 10,575 chars · sha=95e87b2cca74
  Normalized DB sha=51cf92dc4426 · Normalized Ultravox sha=51cf92dc4426

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
No queryKnowledge instructions in prompt — agent has no priming to call the tool

  Total prompt: 11,196 chars · target 12,000 (ratio 0.93x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 2/3 scenarios return zero results (service-area, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt-bloat instruction fatigue (11,196c + 0 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.
- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.