---
type: feature
status: active
tags: [routing, triage, classification, call-stages]
related: [[IVR Platform Feature]], [[TRIAGE_DEEP]], [[Onboarding Audit 2026-04-01]]
updated: 2026-04-01
---

# Call Routing (AI Intent Classification)

## What It Is

**AI-based intent classification** — NOT a phone menu (that's [[IVR Platform Feature|IVR]]).

When a caller phones in, the agent **listens** to what they say and silently classifies their intent into one of 3 buckets configured by the business owner. Different buckets trigger different triage questions and conversation paths.

The caller never presses buttons or hears a menu. They just talk naturally.

## How It's Different from IVR

| Feature | Call Routing | IVR |
|---------|-------------|-----|
| User experience | Caller talks naturally | "Press 1 for..." |
| Classification | AI listens + infers intent | DTMF digit press |
| Config strip pill | `Routing` | `IVR` |
| DB fields | `niche_custom_variables.TRIAGE_DEEP` + `_caller_reasons` | `ivr_enabled` + `ivr_prompt` |
| Prompt impact | Injected into `## 3. TRIAGE` section of system_prompt | Separate TwiML before agent connects |
| Medium support | All (phone + WebRTC) | Phone only (DTMF) |

## How It's Different from Call Stages (Ultravox Pattern D)

Call Stages would be full prompt-switching mid-call — different prompt + tool set per stage (greeting → triage → booking → close). We do **NOT** use call stages.

What we have is a **TRIAGE section within a single monoprompt**. The agent reads the whole prompt, and the TRIAGE section tells it how to branch based on caller intent. Same prompt, same tools, just smarter questioning.

**When to upgrade to Call Stages:**
- Monoprompt exceeds ~10K chars for a complex client
- Different call types need completely different tool sets mid-call
- Strict ordering enforcement (MUST collect X before allowing Y)

## The Full Runtime Flow

### Step 1: Owner configures routing (dashboard)

Owner opens Overview → clicks Routing pill → fills in 3 reasons:
1. "Windshield replacement quote"
2. "Chip repair"
3. "Insurance claim help"

Clicks **"Generate routing"**.

### Step 2: Haiku generates TRIAGE_DEEP

`POST /api/onboard/infer-niche` receives:
```json
{
  "businessName": "Windshield Hub",
  "knownNiche": "auto_glass",
  "callerReasons": ["Windshield replacement quote", "Chip repair", "Insurance claim help"]
}
```

Haiku generates a structured `TRIAGE_DEEP` block — a multi-branch script:
```
TRIAGE (Windshield)
If "chip": "gotcha, just a chip? we can usually fix those..."
If "crack" or "smashed": "oof, yeah that sounds like a full replacement."
If price asked: "I can get you a quick quote — what year, make, model?"
...
```

### Step 3: Saved to DB (two writes)

1. `niche_custom_variables.TRIAGE_DEEP` = the generated block (DB_ONLY)
2. `section_id: 'triage'` + `section_content: <TRIAGE_DEEP>` = patches live `system_prompt` (DB_PLUS_PROMPT → triggers `needsAgentSync` → `updateAgent()`)

Both writes happen in `CallRoutingCard.tsx` `handleGenerate()`.

### Step 4: At call time

Caller phones in → agent reads `system_prompt` which now contains the TRIAGE section → agent listens to caller → classifies intent → follows the matching branch → asks relevant follow-up questions.

**No special runtime machinery.** It's just prompt text that tells the AI how to branch.

## Who Has It Today (2026-04-01)

| Client | Has TRIAGE_DEEP? | How triage works |
|--------|-----------------|------------------|
| windshield-hub | **No** | Hand-written in prompt: "get vehicle year/make/model" |
| hasan-sharif | **No** | Hand-written: real estate buyer/seller qualification |
| exp-realty | **No** | Hand-written: same pattern |
| urban-vibe | **No** | Hand-written: maintenance/rent/lease |
| red-swan-pizza | **Yes** | Auto-generated via Haiku during onboarding |
| true-color (test) | **Yes** | Auto-generated via Haiku during onboarding |

**Key insight:** The 4 live clients have triage logic hand-written into their prompts. It works well but isn't structured via Call Routing. They would need D304 (old-client prompt migration) to get section markers and structured routing.

**For new clients:** Call Routing is auto-generated during onboarding via the `generate-agent-intelligence` endpoint, which produces TRIAGE_DEEP from GBP data + caller reasons.

## Dashboard Pill Logic

The "Routing" pill in QuickConfigStrip shows:
- **"Active"** (green) — when `niche_custom_variables.TRIAGE_DEEP` is non-null
- **"Set up"** (yellow) — when TRIAGE_DEEP is null

Computed at: `src/app/api/dashboard/home/route.ts` line 430:
```ts
hasTriage: !!((client.niche_custom_variables as Record<string, string> | null)?.TRIAGE_DEEP)
```

## Mutation Class

- `niche_custom_variables` → **DB_ONLY** (stored, feeds into prompt regeneration)
- `section_id: 'triage'` patch → **DB_PLUS_PROMPT** (triggers `needsAgentSync` → `updateAgent()`)

## Key Files

| File | Role |
|------|------|
| `src/components/dashboard/settings/CallRoutingCard.tsx` | Settings card — edit reasons + generate |
| `src/components/dashboard/home/QuickConfigStrip.tsx` | Overview strip — routing pill + inline edit |
| `src/app/api/onboard/infer-niche/route.ts` | Haiku inference — generates TRIAGE_DEEP from reasons |
| `src/app/api/onboard/generate-agent-intelligence/route.ts` | Onboarding intelligence — generates TRIAGE_DEEP from GBP data |
| `src/lib/prompt-sections.ts` | `replacePromptSection('triage')` — patches live prompt |
| `src/lib/prompt-config/niche-defaults.ts` | Per-niche default TRIAGE_DEEP templates (18 niches) |

## Niche Placeholder Hints

Both `CallRoutingCard` and `QuickConfigStrip` show niche-specific example placeholders. As of 2026-04-01, **17 niches** have custom hints (all except `outbound_isa_realtor`).

**When adding a new niche to `niche-defaults.ts`:** also add placeholder hints to BOTH:
- `CallRoutingCard.tsx` → `NICHE_PLACEHOLDERS`
- `QuickConfigStrip.tsx` → `NICHE_PH`

## Open Issues

- [ ] D323 — Routing pill UX: explain what it does, not just "Active" (copy improvement)
- [ ] D304 — Old-client prompt migration: add section markers so routing card works for existing 4 clients
- [ ] Future: show generated TRIAGE_DEEP to user for review before applying
- [ ] Future: dynamic reason count (currently hardcoded to 3)
- [ ] Future: Call Stages (Ultravox Pattern D) if monoprompt ceiling hit
