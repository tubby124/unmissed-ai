---
type: research
tags: [phase3, learnings, architectural, carry-forward]
created: 2026-03-31
affects: [phase4, phase5, phase6, phase7]
---

# Phase 3 Learnings — Carry Forward to Future Phases

## Phase 4 Prerequisites (MUST DO)
1. **Patcher verification** — `patchAgentName()` and `patchBusinessName()` must work against slot-composed prompts (different text from old template)
2. **FILTER_EXTRA grep** — check for D296-pattern bug (`nicheDefaults.FILTER_EXTRA` should be `variables.FILTER_EXTRA`)

## Phase 6 Architecture Changes
3. **Conditional rules pattern** — D272 proved `pricingPolicy` → conditional rule text works cleanly. Apply to ALL business-logic rules. Consider `clientRules[]` array on SlotContext.
4. **buildSlotContext decomposition** — 530+ lines of niche if/else chains. Decompose into per-niche config modules (`niches/hvac.ts`, `niches/dental.ts`).
5. **Shadow tests restructure** — Rename to "slot isolation tests" since old/new paths are now the same function.

## Phase 7+ (Behavioral Content RAG)
6. **8K target requires moving behavioral content** — Inline FAQ removal only saves ~1-3K. Real shrink needs INLINE_EXAMPLES (~2K) and parts of CONVERSATION_FLOW (~3K) moved to RAG retrieval.
7. **"Playbook retrieval" pattern** — Agent retrieves "how to handle wrong number" from knowledge instead of inline. Each example becomes a retrievable playbook entry.

## Product Decisions (any phase)
8. **pgvector as default** — Make `knowledge_backend='pgvector'` default for all new clients. queryKnowledge with 0 chunks is harmless.
9. **Prompt char count dashboard** — Add to agent readiness display. Flag > 12K.
10. **Sonar as standing practice** — Keep research step in every phase. ~$0.10, prevents wrong turns.

## Related
- Full detail: `~/.claude/projects/.../memory/feedback_phase3_learnings.md`
- [[Architecture/Prompt Slots]] — Phase 3 implementation
- [[Decisions/Prompt Sandwich Ownership Model]] — core philosophy
