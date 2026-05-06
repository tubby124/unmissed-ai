# KB-Aware Niche Templates — Architecture Spec

**Status:** Approved 2026-05-06. Phase 1 ready to implement next session.
**Owner:** Hasan (sole engineer)
**Triggered by:** Brian KB enrichment (2026-05-05) shipped 6 chunks that never fired in production. Diagnosis on 2026-05-06 traced to niche templates written before KB existed.

---

## Problem

Voice agents have 4 knowledge tiers (locked architecture, see [unmissed-knowledge-tier-architecture.md](../../docs/architecture/control-plane-mutation-contract.md)):

1. `system_prompt` rules (FORBIDDEN_ACTIONS, TRIAGE branches)
2. `business_facts` (inlined, ~30 entries)
3. `extra_qa` (inlined FAQ pairs, ~10)
4. `knowledge_chunks` via `queryKnowledge` tool (RAG, unlimited)

**The bug:** Niche templates' tier-1 rules were authored when there was NO KB. They use blanket *"NEVER answer X — route to manager"* patterns that pre-empt tiers 3 and 4 entirely. The 6 manually-curated chunks added to Brian's KB on 2026-05-05 (parking, rates, areas, P1, commercial, background check) all map to questions the prompt explicitly forbids answering. Last successful `queryKnowledge` fire on Brian was 2026-04-27 — the 2026-05-05 recompose against trimmed niche-defaults made it worse.

**Verified evidence (2026-05-06):**
- Brian has "rent" content in all 4 tiers (1 prompt mention + 4 business_facts + 7 extra_qa + 3 KB chunks). Data is there.
- Direct `curl` to `/api/knowledge/calgary-property-leasing/query` returns 2 chunks for "what areas do you cover". KB works.
- 5 KB-shaped questions on call `37b87dbe` (2026-05-06 01:53:28 UTC): all routed to "Brian will call you back" via TRIAGE rules at lines 144/148/153 + FORBIDDEN rules 3/11/17/19/23. `queryKnowledge` never fired.

## Industry validation (Perplexity Sonar Pro 2026-05-06)

| Pattern | Confirmed by Sonar | Status in unmissed |
|---|---|---|
| Inline ≤4k chars; RAG retrieve beyond | Yes | Split exists |
| Safety rules engineered as top-of-prompt; win over retrieval | Yes | FORBIDDEN at top |
| Niche-aware prompt template + shared RAG with niche filter | Yes | Templates exist but pre-KB |
| Self-improving loop — post-call queries auto-promote | Yes (production in 2026, Ultravox/Retell ship variants) | D270 designed; data prereq shipped 2026-05-06 |
| 12k–25k char prompt rule-attention ceiling | Yes | Brian at 19k |

The architecture is correct. The niche templates haven't caught up.

## Solution — 3 phases, Alpha sequencing

### Phase 1 — KB-aware niche templates (this is the next session's scope)

**Source-of-truth:** `src/lib/niche-defaults.ts` (and any per-niche files imported from `niche-registry.ts`).

**Reframe pattern:**

Old (blanket-block):
```
NEVER answer questions about availability, pricing, pets, parking, or utilities — route every one to Brian.
```

New (KB-conditional):
```
For questions about general policies (pet rules, parking layout, service areas, business model): call queryKnowledge first.
- If it returns an approved answer, share it naturally.
- If empty, or for property-specific specifics (this unit's rent amount, this building's pet policy, this lease's terms): route to Brian for callback.
Never quote specific dollar amounts or unit-specific terms even if a chunk seems to contain them.
```

**Per-niche tuning by liability profile:**

| Niche | Stance | KB usage |
|---|---|---|
| `property_management`, `legal`, `medical`, `real_estate` | Strict — KB allowed for general policies; route property/case/patient specifics | Conditional |
| `restaurant`, `auto_glass`, `hvac`, `salon`, `barbershop`, `retail` | Permissive — KB-first for most questions; route only when KB miss | KB-first |
| `other` | Defaults to permissive | KB-first |

**Acceptance:**
- Recompose Brian (slug `calgary-property-leasing`) → next test call asking "what areas do you cover" fires `queryKnowledge` (verifiable in `tool_invocations`).
- Recompose Urban Vibe (slug `urban-vibe`) → same verification.
- Promptfoo tests for property_management niche pass with new stance.
- Char count stays under 20k for both.

**Out of scope (do not bundle):**
- AI Compiler (Phase 2).
- Promotion loop (Phase 3).
- Old-client snowflake migrations beyond Brian + Urban Vibe.

### Phase 2 — Onboarding auto-categorization (extends D298)

Scrape + GBP at onboarding feeds AI Compiler. Compiler routes each fact by trust + risk + size:
- Short, high-trust, general policy → `business_facts` (cap ~30 entries)
- Q&A-shaped, owner-approvable → `extra_qa` (cap ~10)
- Long, detailed, specific → `knowledge_chunks`

Owner reviews categorizations once on dashboard. Approves. Future onboarding auto-routes.

**Out of scope here.** Separate spec when Phase 1 is validated.

### Phase 3 — D270 promotion loop

Weekly cron reads `tool_invocations` (shipped 2026-05-06). For each client, top-K most-queried KB chunks get suggested for promotion to `extra_qa`. Owner approves on dashboard. Frequent KB hits become inline knowledge over time.

**Prerequisite already shipped this session:** `tool_invocations` table + helper + 5 instrumented routes (PR commit `ffa7aaa`, verified 2026-05-06 01:56 with row `cce5d554`).

**Out of scope here.** Needs ~2 weeks of `tool_invocations` data first.

## Implementation entry points (Phase 1)

| Concern | File |
|---|---|
| Niche template defaults | `src/lib/niche-defaults.ts` |
| Niche registry | `src/lib/niche-registry.ts` |
| Slot composition | `src/lib/prompt-slots.ts` |
| FORBIDDEN_ACTIONS slot | within prompt-slots.ts (search "FORBIDDEN") |
| TRIAGE_DEEP slot | within prompt-slots.ts (search "TRIAGE") |
| KNOWLEDGE BASE slot | within prompt-slots.ts (search "knowledge\|queryKnowledge") |
| Recompose entry | `src/lib/recompose-prompt.ts` (or scripts/recompose-brian.ts pattern from this session's worktree) |
| Promptfoo tests | `tests/promptfoo/` (run `npm run promptfoo` after changes) |

## Retrofit list

- `calgary-property-leasing` (Brian) — KB has 16 approved chunks, ready
- `urban-vibe` (Ray) — D445 migrated 2026-04-30, slot pipeline ready

Do not touch `hasan-sharif`, `exp-realty`, `windshield-hub` — snowflake clients per standing rule.

## Standing rules (carry forward)

- Push to origin/main is pre-authorized for Hasan-owned repos
- Pre-commit + pre-push hooks enforce build + 4 drift checks
- Never edit `clients.system_prompt` directly on live clients (per `control-plane-mutation-contract.md`)
- KB writes (`knowledge_chunks`) are safe on live clients; no agent sync needed
- Worktree: `~/Downloads/unmissed-home-spine` on `main`
