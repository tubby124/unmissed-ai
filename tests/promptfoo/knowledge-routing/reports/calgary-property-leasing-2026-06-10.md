# Knowledge-Routing Audit — calgary-property-leasing

**Generated:** 2026-06-10T22:26:46.284Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** calgary-property-leasing (property_management)
**Agent ID:** a30e9023-9dc5-4aa7-b7cf-b1cf623fb082
**Deployed prompt:** 25,243 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 52

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 5 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 5 tools total · queryKnowledge PRESENT ✓

### 🟠 Check 2 — pgvector Content
4/5 scenarios match KB content · 1 empty results (corpus gaps)

    [areas-served          ] ✓ 3 chunks · sim=0.577 · tier=medium
    [rent-guarantee        ] ✓ 2 chunks · sim=0.779 · tier=high
    [pets-policy           ] ✗ 0 chunks · sim=---- · tier=----
    [application-process   ] ✓ 2 chunks · sim=0.492 · tier=high
    [services-offered      ] ✓ 4 chunks · sim=0.699 · tier=high

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        25,243 chars · sha=c2fc0df4055a
  Ultravox callTemplate.systemPrompt: 24,568 chars · sha=dec7bf69a270
  Normalized DB sha=1a61bbc693e6 · Normalized Ultravox sha=1a61bbc693e6

### 🔴 Check 4 — Prompt-Bloat Instruction Fatigue
25,243c prompt + 15 tool instructions → high instruction-fatigue risk (GLM-4.6 long-context degradation)

  Total prompt: 25,243 chars · target 12,000 (ratio 2.10x)
  Tool instructions (queryKnowledge mentions): 15
    L  33: 9. ANSWER-FIRST RULE: When queryKnowledge returns content for a general policy q…
    L  35: 11. FAIR HOUSING — ESA/SERVICE ANIMAL/DISABILITY (OVERRIDES ALL): trigger words …
    L  37: 13. SCOPE: For building-level POLICIES (parking layout, pet rules at the buildin…
    L  38: 14. LEGAL ADVICE (RTA / eviction / landlord/tenant rights): NEVER bridge. NEVER …
    L  39: 15. UTILITIES: NEVER claim heat/water/electricity/gas are included or excluded —…
    L  40: 16. APPLICATION PROCESS: NEVER enumerate steps (credit check, employment verific…
    L  41: 17. PET RULES (only when NO service animal/ESA/disability mentioned): NEVER inve…
    L  54: DEFAULT for ANY factual question (fees, policies, procedures, pet rules, applica…
    L  56: EXCEPTION — IDENTITY questions only (5 topics): 1) areas/cities you cover, 2) yo…
    L  58: No queryKnowledge for greetings, emergencies, or booking confirmations.
    L 134: IDENTITY (FIVE topics only — answer DIRECTLY, no bridge, no queryKnowledge):
    L 141: For these FIVE, read the answer straight from the Identity section in your conte…
    L 147: 2. Call queryKnowledge with the topic. When it returns, share the answer directl…
    L 251: When the caller asks a factual question about the business (services, pricing, h…
    L 254: If queryKnowledge returns no results or an empty answer: say "I don't have that …

## Suspect Ranking

**1. Partial corpus coverage — 1 scenarios returned chunks but content did not match expected patterns (pets-policy)** — probability: MEDIUM
   → Fix: Review the top chunk content for the gap scenarios — may be a scenario-pattern mismatch (update mustMatchAny in scenarios.ts) or a corpus refinement need.

**2. Prompt-bloat instruction fatigue (25,243c + 15 tool instructions)** — probability: HIGH
   → Fix: A4 recompose under 12K. Prerequisite: Phase 2d niche-defaults compression (current recompose rejects >12K). For hand_tuned clients: owner go required.

## Next Actions

- Trigger recompose via settings PATCH or scripts/regenerate-all-slots.ts.