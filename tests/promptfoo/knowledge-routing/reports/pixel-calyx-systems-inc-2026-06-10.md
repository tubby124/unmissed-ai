# Knowledge-Routing Audit — pixel-calyx-systems-inc

**Generated:** 2026-06-10T22:27:55.698Z
**Audit version:** 1.1.0
**Git:** 879cca938936 on `main` (dirty working tree)
**Client:** pixel-calyx-systems-inc (other)
**Agent ID:** 59625aea-36d7-4fed-b58b-ac8575db94a6
**Deployed prompt:** 16,772 chars · hand_tuned=false
**Knowledge backend:** pgvector · approved chunks: 26

## Check Results

### ✅ Check 1 — Tool Registration
queryKnowledge registered in DB + Ultravox

  Expected tool: queryKnowledge (knowledge_backend=pgvector)
  DB clients.tools: 3 tools total · queryKnowledge PRESENT ✓
  Ultravox callTemplate.selectedTools: 3 tools total · queryKnowledge PRESENT ✓

### 🔴 Check 2 — pgvector Content
1/3 scenarios match KB content · 2 empty results (corpus gaps)

    [service-area          ] ✗ 0 chunks · sim=---- · tier=----
    [services-offered      ] ✓ 5 chunks · sim=0.593 · tier=high
    [pricing-general       ] ✗ 0 chunks · sim=---- · tier=----

### ✅ Check 3 — DB ↔ Ultravox Prompt Drift
DB and Ultravox prompts match (normalized)

  DB clients.system_prompt:        16,772 chars · sha=ceba42e51c93
  Ultravox callTemplate.systemPrompt: 17,033 chars · sha=bfb5a7b4bb5c
  Normalized DB sha=72c60fe198f8 · Normalized Ultravox sha=72c60fe198f8

### 🟠 Check 4 — Prompt-Bloat Instruction Fatigue
Prompt over 12K target (16,772c) — compression recommended

  Total prompt: 16,772 chars · target 12,000 (ratio 1.40x)
  Tool instructions (queryKnowledge mentions): 0

## Suspect Ranking

**1. Corpus gaps — 2/3 scenarios return zero results (service-area, pricing-general)** — probability: HIGH (for gap scenarios)
   → Fix: Run /api/dashboard/knowledge/compile or reseedKnowledgeFromSettings to refresh corpus. Verify approved chunk count climbs.

**2. Prompt over 12K target (16,772c)** — probability: MEDIUM
   → Fix: Consider compression. Lower priority if other checks pass.

## Next Actions

- Reseed corpus for the empty-result scenarios.