# Knowledge-Routing Audit — phase-f-auto-glass

**Generated:** 2026-06-10T22:27:52.545Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** phase-f-auto-glass (auto_glass)
**Agent ID:** fb81739d-c04f-4b62-87e8-ec809d326c66
**Deployed prompt:** 12,931 chars · hand_tuned=false
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

  DB clients.system_prompt:        12,931 chars · sha=9928ea41c753
  Ultravox callTemplate.systemPrompt: 12,311 chars · sha=a180381a2f2f
  Normalized DB sha=cd99ad104097 · Normalized Ultravox sha=cd99ad104097

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (12,931c) — compression recommended

  Total prompt: 12,931 chars · target 12,000 (ratio 1.08x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 4/4 scenarios return zero results (service-area, mobile-service, insurance-claims, warranty)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. Prompt over 12K target (12,931c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.