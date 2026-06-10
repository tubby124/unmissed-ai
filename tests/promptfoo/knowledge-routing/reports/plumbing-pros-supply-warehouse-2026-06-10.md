# Knowledge-Routing Audit — plumbing-pros-supply-warehouse

**Generated:** 2026-06-10T22:28:06.693Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** plumbing-pros-supply-warehouse (other)
**Agent ID:** ccc6b975-3d10-46ea-8e09-9016626ee913
**Deployed prompt:** 16,675 chars · hand_tuned=false
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

### 🟠 Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts differ — propagation gap or manual edit

  DB clients.system_prompt:        16,675 chars · sha=2b69b9ff03e2
  Ultravox callTemplate.systemPrompt: 16,584 chars · sha=52c08fe24bc4
  Normalized DB sha=8d48566ed12b · Normalized Ultravox sha=d33df5f55afb
  First divergence at char 16210 (out of 16210)

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (16,675c) — compression recommended

  Total prompt: 16,675 chars · target 12,000 (ratio 1.39x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Tool not registered in runtime path** — probability: CRITICAL
   → Fix: Run syncClientTools(slug) or toggle a tool-affecting setting (e.g. sms_enabled off+on) to force buildAgentTools() rebuild. Verify clients.tools after.

**2. Corpus gaps — 3/3 scenarios return zero results (service-area, services-offered, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**3. DB ↔ Ultravox prompt drift** — probability: MEDIUM
   → Fix: Call updateAgent(agentId, agentFlags) to push DB prompt to Ultravox. Investigate why drift occurred (failed updateAgent? manual edit? hand_tuned bypass?).

**4. Prompt over 12K target (16,675c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Fix tool registration FIRST — no other check matters until runtime tool path is wired.
- Reseed corpus for the empty-result scenarios.