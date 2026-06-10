# Knowledge-Routing Audit — windshield-hub-autoglass

**Generated:** 2026-06-10T22:29:15.197Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** windshield-hub-autoglass (auto_glass)
**Agent ID:** 7d76cb13-a9ac-46d3-9252-c6c5ce79f5d5
**Deployed prompt:** 20,017 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 0

## Check Results

### 🔴 Check 1 — Tool Registration
queryKnowledge missing from both DB and Ultravox — tool never registered

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 2 tools total · queryKnowledge MISSING ✗
  Ultravox callTemplate.selectedTools: 2 tools total · queryKnowledge MISSING ✗

### 🔴 Check 2 — pgvector Content
0/4 scenarios match KB content · 4 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [mobile-service        ] ✗ 0 chunks · sim=---- · tier=----
    [insurance-claims      ] ✗ 0 chunks · sim=---- · tier=----
    [warranty              ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        20,017 chars · sha=02936e4e27d1
  Ultravox callTemplate.systemPrompt: 20,278 chars · sha=c0bc004b44b6
  Normalized DB sha=a4346e23f943 · Normalized Ultravox sha=a4346e23f943

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (20,017c) — compression recommended

  Total prompt: 20,017 chars · target 12,000 (ratio 1.67x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 4/4 scenarios return zero results (service-area, mobile-service, insurance-claims, warranty)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (20,017c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.