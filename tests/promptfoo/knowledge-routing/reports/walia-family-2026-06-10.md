# Knowledge-Routing Audit — walia-family

**Generated:** 2026-06-10T22:29:05.133Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** walia-family (real_estate)
**Agent ID:** c3832f54-144f-4182-be19-e14cd245d6df
**Deployed prompt:** 24,949 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 0

## Check Results

### 🔴 Check 1 — Tool Registration
queryKnowledge missing from both DB and Ultravox — tool never registered

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 4 tools total · queryKnowledge MISSING ✗
  Ultravox callTemplate.selectedTools: 4 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
0/4 scenarios match KB content · 4 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [commission-structure  ] ✗ 0 chunks · sim=---- · tier=----
    [first-time-buyer      ] ✗ 0 chunks · sim=---- · tier=----
    [showing-process       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        24,949 chars · sha=66295e787841
  Ultravox callTemplate.systemPrompt: 24,205 chars · sha=008409c637d5
  Normalized DB sha=b0eab3bb84d7 · Normalized Ultravox sha=b0eab3bb84d7

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (24,949c) — compression recommended

  Total prompt: 24,949 chars · target 12,000 (ratio 2.08x)
  Tool instructions (queryKnowledge mentions): 2
    L  33: 9. ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy q…
    L  39: 15. COMMISSION + FEES: For general published commission structures or standard l…

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 4/4 scenarios return zero results (service-area, commission-structure, first-time-buyer, showing-process)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (24,949c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.