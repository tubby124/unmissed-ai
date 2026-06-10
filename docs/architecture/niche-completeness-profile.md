# Niche Completeness Profile — Design Spec

**Status:** SPEC — schema + first niche file shipped, dashboard wiring not yet built. Needs Hasan sign-off.
**Created:** 2026-06-04
**Source:** Hasan's vision — "the agent should suggest: hey, you could also add info about X"

---

## Problem statement

Today's dashboard surfaces problems AFTER they happen:
- `prompt-suggestions.ts` clusters `call_insights` rows where the agent was frustrated, confused, or unanswered
- `lesson-generator.ts` clusters `knowledge_query_log` rows where queries went unresolved
- LearningLoopCard surfaces "your agent failed at X — fix it"

This is reactive. The agent has to fail before the owner sees the gap.

The vision is proactive: **agents in your niche typically configure X, Y, Z. You haven't configured Y yet. Want to add it now?**

This is what makes a new client onboard from zero to 80% "complete" in 2 minutes instead of after a week of trial-and-error.

---

## Core concept

For each niche, define a `NicheCompletenessProfile` JSON file declaring:
1. **Required fields** — without these, the agent shouldn't go live for this niche
2. **Recommended fields** — typical for the niche; surface nudges in the dashboard
3. **Recommended KB seeds** — niche-typical FAQs the agent should be able to answer
4. **Recommended business_facts** — typical facts owners in this niche have written down
5. **Niche-tagged variables** — `niche_custom_variables` keys with default values + descriptions

The dashboard compares the client's actual state against this profile and surfaces gaps as nudges:

```
Your agent setup
  ✓ Business name              ← required, set
  ✓ Service area               ← required, set
  ✓ Hours                      ← required, set
  ⚠ Pricing policy             ← recommended, NOT set — "Most home_renovation businesses
                                   configure how to handle pricing questions. [Set up →]"
  ⚠ Top 5 services             ← recommended, NOT set — "Add the 5 most common renovation
                                   types you handle. [Add now →]"
  ⚠ Material lead time policy  ← recommended, NOT set — "Owners typically tell us 'cabinets
                                   take 6-8 weeks'. Want to add yours? [Configure →]"
```

---

## Schema

```ts
// src/lib/prompt-config/niche-completeness/types.ts (NEW)

export interface NicheCompletenessProfile {
  niche: string                              // matches clients.niche
  version: number                            // schema version for migration
  required: ProfileField[]                   // must be set before agent goes live
  recommended: ProfileField[]                // typical for the niche; nudges shown in dashboard
  recommended_kb_topics: KbTopic[]           // niche-typical FAQ topics
  recommended_business_facts: FactTemplate[] // niche-typical facts
  niche_variables: NicheVariable[]           // niche_custom_variables defaults + descriptions
}

export interface ProfileField {
  field: string                              // FIELD_REGISTRY key (must exist)
  display_name: string                       // shown in dashboard nudge
  why: string                                // one-line rationale ("most reno owners configure this")
  example_value?: string                     // shown as placeholder
  priority: 1 | 2 | 3                        // 1 = block setup, 2 = surface high, 3 = surface low
}

export interface KbTopic {
  topic_key: string                          // e.g. "warranty_policy"
  display_name: string                       // "Warranty policy"
  why: string                                // "callers in your niche ask about this 40%+ of calls"
  example_question: string                   // "How long is your warranty on a kitchen reno?"
  example_answer_template: string            // "Most owners say: 'We offer X years on labor, Y on materials.'"
}

export interface FactTemplate {
  fact_key: string                           // e.g. "insurance_coverage_summary"
  display_name: string                       // "Insurance coverage summary"
  why: string
  example_value: string                      // pre-fill suggestion
}

export interface NicheVariable {
  variable_key: string                       // niche_custom_variables key
  display_name: string
  why: string
  default_value: string | null               // null = required, no default
  affects_slots: string[]                    // e.g. ['triage_flow', 'goal']
}
```

---

## First profile — home_renovation

Shipped at [src/lib/prompt-config/niche-completeness/home_renovation.json](../../src/lib/prompt-config/niche-completeness/home_renovation.json).

Derived from:
- The [home_renovation.yaml](../../tests/promptfoo/niche-templates/home_renovation.yaml) test scenarios (50 scenarios encode what owners need to handle)
- The Velly deep study findings (what the proposed Velly slot prompt configures)
- Common patterns from real reno-contractor configs

---

## Dashboard integration (not implemented)

The proposed surface is a "Setup completeness" card on the Overview page:

```
┌─ Setup completeness — home_renovation ─────────────────┐
│                                                         │
│  Required:        ✓✓✓✓✓✓  (6/6)                        │
│  Recommended:     ✓✓⚠⚠⚠⚠  (2/6)                        │
│  KB topics:       ✓⚠⚠⚠⚠⚠  (1/6)                        │
│                                                         │
│  Next 3 to configure:                                   │
│                                                         │
│  ⚠ Pricing policy                              [Set up] │
│     Most home_renovation owners tell their agent        │
│     how to handle "how much does it cost?" calls.       │
│                                                         │
│  ⚠ Warranty policy (KB)                        [Add Q&A] │
│     Callers ask about warranty on ~40% of calls.        │
│     Example: "We offer X years on labor, Y on materials." │
│                                                         │
│  ⚠ Top 5 services list                         [Add now] │
│     Helps the agent answer "what do you guys do?" cleanly. │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Each `[Set up]` deep-links to the correct settings card.

---

## Telemetry — closing the loop

A profile is only as good as its data. The Niche Completeness Profile gets better when we feed it real call patterns.

Two feedback channels:

1. **Hot-query view** (Tier 3 from session note — sketched as `v_hot_knowledge_queries` migration):
   - Aggregates `knowledge_query_log` rows by niche × normalized_query × hit_count
   - When a query hits ≥ 20 times across 5+ clients in the same niche, propose it as a new `recommended_kb_topic` in the profile
   - Owner sees: "We noticed agents in your niche keep getting asked about X — want to add an answer?"

2. **Configuration adoption rate**:
   - Track which recommended fields owners actually set (vs ignore)
   - Promote high-adoption to `required`, demote ignored fields to lower priority or remove

The profile itself becomes a learning artifact — niche-level patterns emerge from the aggregate fleet data.

---

## Phased rollout

**Phase 0 (this session — done):**
- Schema defined
- First profile (home_renovation) drafted as JSON
- This spec doc

**Phase 1 (next session — Hasan sign-off):**
- Implement profile loader (`src/lib/niche-completeness.ts`)
- Add `useNicheCompleteness(clientId)` hook
- Add SetupCompletenessCard component to dashboard Overview

**Phase 2 (post-validation):**
- Profiles for property_management, auto_glass, real_estate
- 'other' niche fallback (uses _universal profile derived from _universal.yaml)

**Phase 3 (telemetry feedback):**
- `v_hot_knowledge_queries` view → auto-propose new recommended_kb_topics
- Adoption rate tracking → profile self-tuning

---

## Open questions for Hasan

1. **Profile location:** filesystem (JSON files in repo, versioned via git) or database (`niche_profiles` table, editable in admin panel)?
2. **Per-client override:** can owners say "this isn't relevant to me" and dismiss a recommendation? Stored where?
3. **Block vs nudge on `required`:** if a required field is missing, do we block agent activation? Or just show a red banner?
4. **Smart-promotion integration:** when `v_hot_knowledge_queries` proposes a new topic, does it auto-update the profile file (PR-style) or just append to a "pending review" queue?

---

## References

- Schema + first profile: [src/lib/prompt-config/niche-completeness/home_renovation.json](../../src/lib/prompt-config/niche-completeness/home_renovation.json)
- Companion test: [tests/promptfoo/niche-templates/home_renovation.yaml](../../tests/promptfoo/niche-templates/home_renovation.yaml)
- Settings reconciler (orchestrator for the writes): [settings-change-reconciler.md](settings-change-reconciler.md)
- Vault notes:
  - [Projects/unmissed/2026-06-04-matrix-test-findings-and-smart-promotion.md](../../../Obsidian%20Vault/Projects/unmissed/2026-06-04-matrix-test-findings-and-smart-promotion.md)
  - [Projects/unmissed/2026-06-04-architectural-reformation-mandate.md](../../../Obsidian%20Vault/Projects/unmissed/2026-06-04-architectural-reformation-mandate.md)
