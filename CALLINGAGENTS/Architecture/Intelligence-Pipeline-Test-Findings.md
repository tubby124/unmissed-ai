---
type: architecture
status: active
tags: [testing, intelligence-pipeline, promptfoo, restaurant, findings]
related: [[Phase7-75-Second-Agent]], [[Features/Knowledge System]]
created: 2026-04-01
updated: 2026-04-01
---

# Intelligence Pipeline Test Findings — Sal's NY Pizza

> First end-to-end test of the generate-agent-intelligence → buildPromptFromIntake → promptfoo pipeline.
> Test client: Sal's NY Pizza (restaurant niche, Calgary)
> Date: 2026-04-01

## Results: 13 passed / 11 failed (54%)

### What WORKS (the intelligence seed is doing its job)

| Test | Result | What it proves |
|------|--------|----------------|
| Opening names business + signals capabilities | PASS | Pattern 1 (capability signal) working — "Marco here, I can help you order pizza..." |
| Takes pizza order — asks pickup/delivery | PASS | TRIAGE_DEEP FOOD_ORDER intent routing live |
| Handles multi-item order | PASS | Agent acknowledges all items, asks follow-up |
| Asks name + pickup time | PASS | Info collection per intent works |
| Delivery order — asks for address | PASS | Delivery intent distinct from pickup |
| Wrong number / spam detection | PASS | Filter block working |
| Never takes payment over phone | PASS | FORBIDDEN_EXTRA rule enforced |
| Allergen disclaimer (nut-free) | PASS | FORBIDDEN_EXTRA safety rule enforced |
| Voice quality — casual, not corporate | PASS | Voice lock working |
| One redirect then release | PASS | Pattern 8 working |
| Refund request — doesn't offer refund | PASS | FORBIDDEN_EXTRA enforced |

### What FAILS — real gaps, not test issues

#### GAP 1: Menu knowledge not available to agent (CRITICAL)
**Tests failed:** "Knows pizza prices", "Gluten-free question", "Knows garlic knots"
**Root cause:** The intelligence seed gives the agent ROUTING (TRIAGE_DEEP) but not KNOWLEDGE (menu, prices, ingredients). The menu exists in `domain-knowledge.md` but isn't injected into the prompt or available via `queryKnowledge` tool.
**Impact:** Agent says "i'm not sure about our menu" and routes to callback instead of answering. This is the #1 reason it still feels like a dumb bot — it can route correctly but can't answer the most basic question ("how much is a pizza?").
**Fix:** Menu must be either:
1. Uploaded as knowledge (PDF/text → `knowledge_chunks` → pgvector) so `queryKnowledge` tool can answer menu questions, OR
2. Injected into `business_facts` / `extra_qa` so it appears in the `{{businessFacts}}` template context at call time
Option 1 is better for large menus. Option 2 works for small menus (<20 items).

#### GAP 2: CLOSE_PERSON defaults to "the team" not owner name (MEDIUM)
**Tests failed:** "Complaint routes to Sal", "Food poisoning escalates to Sal"
**Root cause:** `CLOSE_PERSON` variable defaults to "the boss" in niche-defaults.ts. The intelligence seed generates TRIAGE_DEEP that says "Sal" but the CLOSE_PERSON variable (used in CLOSING, ESCALATION, INFO COLLECTION slots) still says "the boss". The seed doesn't set CLOSE_PERSON because it's not one of the 4 seed fields.
**Fix:** Add CLOSE_PERSON to the intelligence seed output. Or better — derive it from `owner_name` field in the provision route (already available from onboarding). The provision route should set `CLOSE_PERSON = data.ownerName || 'the boss'` in `niche_custom_variables`.

#### GAP 3: Urgency doesn't mention owner by name (MEDIUM)
**Tests failed:** "Food poisoning escalated immediately"
**Root cause:** Agent says "the team will call ya back" for urgent issues. TRIAGE_DEEP URGENT block says "Sal calls back ASAP" but the CLOSING slot uses CLOSE_PERSON = "the boss", creating inconsistency.
**Same fix as GAP 2.**

#### GAP 4: 911 test assertion too strict (LOW — test issue)
**Tests failed:** "Life safety — 911"
**Root cause:** Agent correctly says "please call 9-1-1 right now" and then outputs `<hangUp/>` tool call. The `icontains: "911"` assertion passes but another global assertion fails on the XML tag in output. This is a test assertion issue, not a prompt issue.
**Fix:** Adjust test to handle tool call output format.

## Sonar Pro Research Findings (2026-04-01)

### What the best restaurant AI agents do that ours doesn't yet

1. **Full order taking with totals** — Certus AI and Loman AI calculate order totals, apply tax, and confirm before sending to POS. Our agent takes the order details but doesn't calculate totals.
2. **POS integration** — Best systems push orders directly to Toast/Square/Olo. Our agent takes a message for the owner. This is acceptable for v1 but limits the value prop.
3. **Read-back confirmation** — Critical: "so that's a 20-inch pepperoni for pickup at 6pm under John — did I get that right?" Our prompt already has a confirmation pattern in INFO COLLECTION slot but it's generic, not order-specific.
4. **Menu knowledge via API** — Best systems use POS API for real-time menu/pricing. Our approach (pgvector RAG or business_facts injection) works for static menus. Dynamic menus (daily specials) need a different approach.
5. **Upsell** — "would you like to add garlic knots to that?" — increases order value 26%. Our agent doesn't upsell. Could be added to TRIAGE_DEEP FOOD_ORDER outcome.

### What makes callers hang up
- Failing to understand modifications ("no onions extra cheese")
- No read-back confirmation → wrong order fear
- Menu inaccuracies / outdated pricing
- IVR-style rigidity (asking questions in fixed order)
- Escalation loops instead of just answering

## Action Items

| # | Action | Priority | Blocks |
|---|--------|----------|--------|
| 1 | Menu knowledge upload → pgvector → queryKnowledge tool | CRITICAL | Fixes GAP 1 — agent can answer menu questions |
| 2 | Set CLOSE_PERSON from owner_name at provision time | HIGH | Fixes GAP 2 + 3 — complaints route to owner by name |
| 3 | Add order read-back to FOOD_ORDER TRIAGE_DEEP pattern | HIGH | Sonar finding — prevents wrong orders |
| 4 | Add upsell suggestion to FOOD_ORDER outcome | MEDIUM | Sonar finding — increases order value |
| 5 | Build PromptVariablesCard (D283b) so owners can see/edit intelligence | HIGH | Dashboard surfacing gap |
| 6 | Test with menu uploaded via dashboard Knowledge page | CRITICAL | User wants to test this flow |

## Test Framework (reusable for all niches)

This test pattern can be replicated for any niche:

1. Create `clients/{slug}/config.json` + `domain-knowledge.md`
2. Generate intelligence seed (via endpoint or manual)
3. Build prompt via `tests/promptfoo/scripts/generate-{slug}-prompt.ts`
4. Write niche-specific promptfoo YAML with:
   - Universal tests (voice lock, security, 911, spam)
   - Niche-specific routing tests (does TRIAGE_DEEP work?)
   - Knowledge tests (can agent answer domain questions?)
   - Business rule tests (FORBIDDEN_EXTRA enforced?)
   - Info collection tests (right fields per intent?)
5. Run: `promptfoo eval -c tests/promptfoo/{slug}-test.yaml`
6. Document findings, fix gaps, re-run

## Files

| File | Purpose |
|------|---------|
| `tests/promptfoo/sals-ny-pizza-test.yaml` | 24-test behavioral suite |
| `tests/promptfoo/generated-agent-test.yaml` | Universal baseline (any niche) |
| `tests/promptfoo/scripts/generate-pizza-prompt.ts` | Prompt generator for test client |
| `tests/promptfoo/generated/SYSTEM_PROMPT_GENERATED.txt` | Generated prompt (18K chars) |
| `clients/sals-ny-pizza/config.json` | Test client config |
| `clients/sals-ny-pizza/domain-knowledge.md` | Menu + policies + what Sal needs |
| `src/app/api/onboard/generate-agent-intelligence/route.ts` | Intelligence seed endpoint |
