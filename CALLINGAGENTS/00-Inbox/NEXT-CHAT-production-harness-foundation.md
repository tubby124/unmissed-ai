---
type: next-chat-resume
project: endvoicemail
status: ready
created: 2026-06-04
parent: "[[../../../Obsidian Vault/Projects/unmissed/2026-06-03-auto-harness-onboarding-plan]]"
related:
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-03-identity-tier-architecture-plan]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/2026-06-03-live-test-harness-tier2]]"
  - "[[../../../Obsidian Vault/Projects/unmissed/brand-name-endvoicemail]]"
tags:
  - next-chat
  - production-harness
  - onboarding
  - niche-template
---

# NEXT-CHAT — Production-Grade Harness Foundation

## Session-start command (paste into the new chat)

```
Read CALLINGAGENTS/00-Inbox/NEXT-CHAT-production-harness-foundation.md
and the parent vault note 2026-06-03-auto-harness-onboarding-plan.md.

The product is endvoicemail.ai (NOT unmissed.ai — see vault note brand-name-endvoicemail.md).

Goal: every NEW client onboarded automatically arrives with a 60-90 scenario
frozen baseline harness. Build the foundation in this order:
1. property_management.yaml niche template (canonical 50 scenarios)
2. generate-client-harness.ts (auto-gen client-data scenarios from extra_qa)
3. Wire into provision/trial/route.ts (fire on activation)
4. Roll out to real_estate, auto_glass, home_renovation templates
5. CI gate (pre-push hook)

Standing rules: no redeploys to hasan-sharif, exp-realty, urban-vibe,
windshield-hub, velly-remodeling without explicit owner go. Brian
(calgary-property-leasing) has carve-out.
```

## Where we ended up 2026-06-04

**Brian's identity-tier prompt SHIPPED LIVE** at 04:40 UTC:
- DB chars: 25,243 (up from Phase 1a's 22,493)
- `active_prompt_version_id`: `167076cd-7c3b-4965-bc5a-acf82caa2079`
- Rollback target: `prompt_versions.id=492cd655-c996-4a81-9550-287d88937149`
- Real-call replay validated: 23/25 (vs Phase 1a's 22/25)
- Tier-2 validated in production: rent-program queryKnowledge flow works correctly
- 3 critical bugs fixed: INJECTION 2 prompt leak, ESA Fair Housing, APPLICATION 1 invention
- Stress test 31/31 across 9 safety categories

**Hasan's key insight 2026-06-04:** "Notice how his prompt is about 25,000 characters and it still works pretty fucking good." Translation: the size concern was overblown. Production GLM-4.6 handles a 25K-char rule-dense prompt fine when the rules are unambiguous + properly ordered. Future prompts can be similarly rich without preemptive compression.

## Why this work matters

We just spent a full session iterating Brian's prompt through 3 critical bug catches + a hard-won architectural change. That entire session would NOT happen again for any future client IF:

- Every new client arrives with a canonical 60-90 scenario test suite
- The suite is auto-generated from their actual onboarding data (extra_qa + business_facts)
- Any prompt edit must pass the baseline before going live (CI gate)
- The harness runs on real GLM-4.6 via Tier-2 (`scripts/test-prompt-live.ts`) for production fidelity

That's the production-grade harness foundation. After it ships, onboarding a new client is data entry + one Tier-2 validation call. Not 8 hours of prompt archaeology.

## Phased plan (from `2026-06-03-auto-harness-onboarding-plan.md`)

| Phase | Scope | Estimated effort |
|---|---|---|
| 1 | `tests/promptfoo/niche-templates/property_management.yaml` — canonical 50 scenarios across 7 layers (Identity 5 / Policy 15-20 / Scope-Tier-C 8-12 / Safety-Regulatory 5-8 / Conversation 5-8 / Edge 5-8 / Returning Caller 3-5) | Most of next session |
| 2 | `scripts/generate-client-harness.ts` — reads `clients.extra_qa` + `business_facts` + `niche`, runs `classifyQaTier`, emits per-client scenarios | Follow-up session |
| 3 | Wire to `provision/trial/route.ts` — fire-and-forget after `activateClient()`, Telegram-ping with baseline pass counts | Same session as 2 |
| 4 | Apply to Brian, validate auto-gen output matches the hand-curated harness | Same session as 2-3 |
| 5 | Templates for real_estate, auto_glass, home_renovation | One per session |
| 6 | CI gate — pre-push hook + GitHub Actions, block any prompt edit that drops baseline pass count | After all templates |

## Foundation layer references

- Three-tier knowledge architecture: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-identity-tier-architecture-plan]]
- Tier-2 harness reference: [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-live-test-harness-tier2]]
- Auto-harness plan (parent): [[../../../Obsidian Vault/Projects/unmissed/2026-06-03-auto-harness-onboarding-plan]]
- Brand: [[../../../Obsidian Vault/Projects/unmissed/brand-name-endvoicemail]]
- Brian client note: [[../Clients/calgary-property-leasing]]

## First file to write next session

`tests/promptfoo/niche-templates/property_management.yaml`

Start from `tests/promptfoo/brian-stress-identity-tier.yaml` (31 scenarios, all deterministic, all PASS on Brian's draft). Generalize variable placeholders ({{BUSINESS_NAME}}, {{CLOSE_PERSON}}, {{SERVICE_AREA}}, etc.) so it works for any property_management client. Then expand to 50 scenarios.

Once that exists, the `generate-client-harness.ts` script substitutes per-client values and emits the per-client `<slug>-baseline.yaml`.

## Standing rules (preserved)

- No redeploys to hasan-sharif, exp-realty, urban-vibe, windshield-hub, velly-remodeling without explicit owner go
- Brian (calgary-property-leasing) has carve-out — but still ask before `--live`
- Brian's trial expires 2026-06-15 — 11 days from now
- The product is **endvoicemail.ai**, not unmissed.ai
- Tier-2 is the canonical "live test without notifying owner" path
- `llm-rubric` assertions are advisory only; ship gates use deterministic `icontains-any` / `not-icontains-any`

## Things to remember

1. The 3000-char `FORBIDDEN_EXTRA_MAX` cap got raised to 4500 mid-session because PM niche needed room for the new safety rules. Track for Phase 2d niche-defaults compression.
2. The 25,000-char `PROMPT_CHAR_HARD_MAX` got raised to 25,300 for Brian's identity-tier prompt. Per Hasan's observation, 25K works fine in production — future raises should be cautious but the previous "12K hard max from glm46-prompting-rules" guidance is operationally out of date.
3. The Tier-2 harness has a script bug: doesn't write report on poll timeout. Fix when convenient.
