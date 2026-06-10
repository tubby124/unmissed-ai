# Knowledge-Routing Audit — windshield-hub

**Generated:** 2026-06-10T22:29:10.478Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** windshield-hub (auto_glass)
**Agent ID:** 00652ba8-5580-4632-97be-0fd2090bbb71
**Deployed prompt:** 15,483 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 83

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 6 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 6 tools total · queryKnowledge PRESENT ✓

### ✅ Check 2 — pgvector Content
4/4 scenarios match KB content

    [service-area          ] ✓ 4 chunks · sim=0.572 · tier=medium
    [mobile-service        ] ✓ 5 chunks · sim=0.605 · tier=medium
    [insurance-claims      ] ✓ 5 chunks · sim=0.625 · tier=medium
    [warranty              ] ✓ 5 chunks · sim=0.781 · tier=medium

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        15,483 chars · sha=1222e31e90ef
  Ultravox callTemplate.systemPrompt: 14,682 chars · sha=8f3f406d3a2d
  Normalized DB sha=003b72b4e38d · Normalized Ultravox sha=003b72b4e38d

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
15,483c prompt + 4 tool instructions → high instruction-fatigue risk (GLM-4.6 long-context degradation)

  Total prompt: 15,483 chars · target 12,000 (ratio 1.29x)
  Tool instructions (queryKnowledge mentions): 4
    L  33: 9. ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy q…
    L  39: For any factual question about the business (services, hours, pricing, policies,…
    L 210: When the caller asks a factual question about the business (services, pricing, h…
    L 213: If queryKnowledge returns no results or an empty answer: say "I don't have that …

## Suspect Ranking

**1. Prompt-bloat instruction fatigue (15,483c + 4 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.