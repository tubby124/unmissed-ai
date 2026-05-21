---
type: tracker
status: open
priority: P1
discovered_during: Mohammad Emon manual provision trace (slug=emon)
related:
  - "[[Architecture/Prompt-Pipeline]]"
  - "[[Architecture/Harness-Pipeline]]"
  - "[[Projects/unmissed/2026-05-21-harness-pipeline-shipped]]"
tags: [onboarding, prompt-pipeline, niche-defaults, product-bug]
updated: 2026-05-21
---

# D-onboarding-bugs-2026-05-21

Bugs uncovered while manually driving the onboarding pipeline end-to-end for Mohammad Emon (KO Realty, Calgary). Each one is a real product gap — a customer hitting the same flow through the `/onboard` wizard would get blocked or get an off-brand result. The Emon trace artifacts at [[00-Inbox/onboard-emon-trace]] are the receipts.

## Resolution status of the 7 bugs

| # | Bug | Status | Workaround used for Emon |
|---|-----|--------|-------------------------|
| 1 | Real-estate niche default + Sonar's 6 intent buckets → 23K prompt over the 21K cap | OPEN — niche default rework | Dropped `agentIntelligenceSeed`, used niche default + concise pronunciation rule |
| 2 | `businessHoursText="Available 24/7"` + hours object produces awkward formatting ("weekday hours are Available 24/7 — agent answers anytime; weekend hours are Saturday 12 AM–11:59 PM, Sunday 12 AM–11:59 PM") | OPEN | Set `businessHoursText="Available anytime"`, owner can edit from dashboard |
| 3 | No "what should I call your business?" field — agent uses `businessName` from Google Places ("Mohammad Emon \| KO Realty \| Calgary REALTOR®") instead of a clean brand label | OPEN — needs `displayName` column + onboard wizard input | Hasan said dashboard already supports editing — owner fixes post-activation |
| 4 | Greeting template too stiff: "Mohammad Emon — KO Realty — this is Maya, an AI assistant. How can I help ya today?" | OPEN — needs greeting template update | Owner edits from dashboard |
| 5 | No "you can ask me about ___" capability signal in greeting — callers don't know what the agent CAN help with | OPEN — niche default identity slot needs capability line | Owner edits from dashboard |
| 6 | FAQs / business facts auto-stuffed into prompt slots instead of seeded into `knowledge_chunks` (pgvector). Inflates prompt past cap. | OPEN — wizard default should route to pgvector | Manually emptied `faqPairs` in Emon's intake, seeded `knowledge_chunks` via `seedKnowledgeFromScrape` |
| 7 | `PROMPT_CHAR_HARD_MAX = 21000` is below operational reality (Brian 22.9K, Urban Vibe 22.7K in prod) | **RESOLVED 2026-05-21** | Bumped to 25000 in `src/lib/knowledge-summary.ts:49` |

## Why these matter

Without these fixes, every real_estate signup hits #1 (blocks activation) and every signup hits #2-#5 (off-brand first impression). #6 is the silent killer — it eats into the prompt budget that should be available for niche logic. #7 is now resolved but the underlying niche-template bloat (#1, #6) still needs attention.

## Recommended fix order

1. **#3 + #4 + #5** — single PR, adds `displayName` column + greeting template + capability signal. Highest customer-impact-to-effort ratio.
2. **#2** — single-file fix in `intake-transform.ts:toIntakePayload()` — when `scheduleMode='24_7'`, skip per-day rendering.
3. **#6** — change wizard default for "FAQ pairs" to "send to knowledge base" instead of "embed in prompt".
4. **#1** — biggest, touches `niche-defaults.real_estate`. Rebalance which content lives in niche template vs runtime intelligence vs pgvector.

## Reference snapshot (Emon at activation, slug=emon)

The first deploy that went through the manual trace serves as the "as-currently-shipped" baseline. Future onboarding-flow fixes can compare against the Emon snapshot to validate they improve (not regress) prompt quality + size + slot composition.

- Prompt size: **21,698 chars**, 18 of 19 slots
- Slot breakdown: see [[00-Inbox/onboard-emon-trace/STEP-06-build-slot-prompt|STEP-06-build-slot-prompt.json]]
- Knowledge chunks seeded: 12 facts + 6 Q&As from mohammademon.ca
- All 9 dimensions on `provisioning-completeness-check.ts`: ✓ at activation (confirmed via [[00-Inbox/onboard-emon-trace/STEP-13-validator-run|STEP-13-validator-run.json]])
