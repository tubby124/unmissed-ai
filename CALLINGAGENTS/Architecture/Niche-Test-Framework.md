---
type: architecture
status: active
tags: [testing, promptfoo, niche, framework]
related: [[Intelligence-Pipeline-Test-Findings]], [[Phase7-75-Second-Agent]]
created: 2026-04-01
updated: 2026-04-01
---

# Niche Test Framework — Reusable Pattern

> How to test any niche agent end-to-end: intelligence seed → prompt → behavioral validation.
> Reference implementation: Sal's NY Pizza (restaurant)

## The Pattern (5 steps)

### Step 1: Create test client
```
clients/{slug}/config.json     — identity, niche, location
clients/{slug}/domain-knowledge.md — menu/services/policies/what owner needs
```

### Step 2: Generate intelligence seed
Either via the endpoint (`/api/onboard/generate-agent-intelligence`) or manually.
Produces: TRIAGE_DEEP, GREETING_LINE, URGENCY_KEYWORDS, FORBIDDEN_EXTRA.

### Step 3: Build full prompt
```bash
npx tsx tests/promptfoo/scripts/generate-{slug}-prompt.ts > tests/promptfoo/generated/SYSTEM_PROMPT_GENERATED.txt
```

### Step 4: Write niche-specific promptfoo tests
5 test categories per niche:

| Category | What it tests | Example |
|----------|---------------|---------|
| **Capability signal** | Opening line names business + says what it can do | "Sal's NY Pizza, Marco here — I can help you order..." |
| **Intent routing** | Each TRIAGE_DEEP intent gets its own test | FOOD_ORDER: asks pickup/delivery. CATERING: asks guest count. |
| **Knowledge answers** | Can answer domain questions from KB | "How much is a large pepperoni?" → actual price |
| **Business rules** | FORBIDDEN_EXTRA enforced | Never promises delivery under 30 min |
| **Info collection** | Collects the RIGHT fields per intent | Order: items + size + pickup/delivery + name. Catering: date + count. |

Plus universal tests (voice lock, security, 911, spam) from `generated-agent-test.yaml`.

### Step 5: Run and iterate
```bash
promptfoo eval -c tests/promptfoo/{slug}-test.yaml
```
Document findings → fix prompt/pipeline → re-run.

## The "Magic Question" Per Niche

From [[working-agent-patterns]]: every good agent has ONE critical question per intent that unlocks the owner's ability to act.

| Niche | The magic question | Why it matters |
|-------|-------------------|----------------|
| auto_glass | "does it have the lane assist camera by the mirror?" | ADAS calibration = $150-300 price difference |
| plumbing | "is water actively coming in or more of a drip?" | Determines emergency dispatch vs routine booking |
| restaurant | "pickup or delivery?" | Determines what info to collect next |
| property_mgmt | "are you a tenant, owner, or looking to lease?" | Routes to completely different triage |
| dental | "new patient or coming back to see us?" | New patient has different booking flow |
| real_estate | "what property are you looking at?" | Agent can't schedule without an address |
| hvac | "is your heat/AC completely out or just not working right?" | Emergency vs routine |
| salon | "what service were you looking to book?" | Different time slots per service |

The intelligence seed must generate this question for each business. The test must verify the agent asks it.

## Niche Registry (for future niches)

When adding a new niche:
1. Add magic question + expected intents to this table
2. Create test client in `clients/`
3. Generate prompt + write tests
4. Run promptfoo → must pass 80%+ on first run
5. Fix gaps → re-run → target 95%+

## Key Finding: Knowledge Is The Bottleneck

The intelligence seed gives ROUTING (what to do per intent).
But the agent also needs KNOWLEDGE (prices, menu, services, policies).

Without knowledge: agent routes correctly but says "I'm not sure" to basic questions.
With knowledge: agent answers directly AND routes correctly.

**Knowledge sources (ranked by impact):**
1. Menu/service list uploaded as PDF or text → pgvector chunks → queryKnowledge tool
2. FAQ pairs from onboarding → business_facts/extra_qa → injected at call time
3. Website scrape → approved facts → same injection path
4. GBP description → business_facts

The test framework must validate BOTH routing AND knowledge answers.

## Files

| File | Purpose |
|------|---------|
| `tests/promptfoo/generated-agent-test.yaml` | Universal baseline (any niche) |
| `tests/promptfoo/sals-ny-pizza-test.yaml` | Restaurant reference test (24 tests) |
| `tests/promptfoo/scripts/generate-pizza-prompt.ts` | Restaurant prompt generator |
| This document | Framework documentation |
