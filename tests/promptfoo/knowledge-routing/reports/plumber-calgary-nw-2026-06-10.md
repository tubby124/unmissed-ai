# Knowledge-Routing Audit — plumber-calgary-nw

**Generated:** 2026-06-10T22:28:04.201Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** plumber-calgary-nw (plumbing)
**Agent ID:** d863d0c5-2ac8-4065-94a4-867559bb8d05
**Deployed prompt:** 5,312 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 38

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### ✅ Check 2 — pgvector Content
3/3 scenarios match KB content

    [service-area          ] ✓ 3 chunks · sim=0.528 · tier=medium
    [services-offered      ] ✓ 3 chunks · sim=0.514 · tier=high
    [pricing-general       ] ✓ 5 chunks · sim=0.531 · tier=medium

### 🟠 Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts differ — propagation gap or manual edit

  DB clients.system_prompt:        5,312 chars · sha=e3f965c555e4
  Ultravox callTemplate.systemPrompt: 18,764 chars · sha=8cda5964302c
  Normalized DB sha=dd66e1ae3140 · Normalized Ultravox sha=5dd2ddb8a32d
  First divergence at char 45 (out of 5228)

### ✅ Check 4 — Prompt-Bloat Instruction Fatigue
Prompt within bounds (5,312c, 1 tool instructions)

  Total prompt: 5,312 chars · target 12,000 (ratio 0.44x)
  Tool instructions (queryKnowledge mentions): 1
    L 100: Use the queryKnowledge tool to answer questions about services, pricing ranges, …

## Suspect Ranking

**1. DB ↔ Ultravox prompt drift** — probability: MEDIUM
   → Fix: Call updateAgent(agentId, agentFlags) to push DB prompt to Ultravox. Investigate why drift occurred (failed updateAgent? manual edit? hand_tuned bypass?).

## Next Actions

_(none — audit clean)_