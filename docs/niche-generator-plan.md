# Plan: niche-generator.ts for `other` niche

## Context

When an `other` niche client signs up, they get the generic NICHE_DEFAULTS.other prompt vars (INDUSTRY: 'business', PRIMARY_CALL_REASON: 'service or inquiry', etc.). The agent sounds generic. This builds `niche-generator.ts` to AI-generate business-specific values for those same slot variables at provision time, so the agent sounds like it was built for that business.

**Key finding:** `custom_niche_config` column does NOT exist yet (no migration, no type, no generator). Memory was projecting future state. This is a fresh build.

---

## Architecture fit

The slot pipeline already supports this: `niche_custom_variables` (jsonb in intakeData) → `buildSlotContext()` merges it into `variables` → fills INDUSTRY, PRIMARY_CALL_REASON, TRIAGE_DEEP, INFO_TO_COLLECT, CLOSE_PERSON, CLOSE_ACTION, URGENCY_KEYWORDS in the prompt template. The `other` niche defaults are generic placeholders — AI-gen replaces them with business-specific text. No new slots needed.

FAQs route through existing `niche_faq_pairs` (JSON string) → `FAQ_PAIRS` slot. Only written if no manual `faqPairs` were entered, so no duplication with `extra_qa`.

---

## Files to change

| File | Change |
|------|--------|
| `supabase/migrations/20260413000000_add_custom_niche_config.sql` | New — add `custom_niche_config jsonb` column |
| `src/types/onboarding.ts` | Add `CustomNicheConfig` type export |
| `src/lib/niche-generator.ts` | New — `generateNicheConfig()` function |
| `src/app/api/provision/trial/route.ts` | Call generator + merge into intakeData + save to clients |
| `src/app/api/dashboard/regenerate-prompt/route.ts` | Read `custom_niche_config` from clients + re-merge on regen |

---

## Step 1 — Migration

```sql
-- supabase/migrations/20260413000000_add_custom_niche_config.sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_niche_config jsonb;
```

Apply via `supabase db push` or migration API.

---

## Step 2 — Type definition

In `src/types/onboarding.ts`, add before the `OnboardingData` interface:

```typescript
export type CustomNicheConfig = {
  industry: string
  primary_call_reason: string
  triage_deep: string
  info_to_collect: string
  close_person: string
  close_action: string
  urgent_scenario: string
  faq_defaults: Array<{ q: string; a: string }>
}
```

---

## Step 3 — niche-generator.ts

New file at `src/lib/niche-generator.ts`.

### Gap-fill logic (applied before the AI call)
- If `callerReasons` (string[]) is present:
  - `primary_call_reason` = `callerReasons[0]` or joined list
  - `triage_deep` = built directly from callerReasons list (each reason gets a "gotcha" → collect → close script block) — **do not send these to AI**
- If `hasFaqPairs` = true → omit `faq_defaults` from AI request and return `[]`
- If `urgencyWords` is present → pass as input to AI; AI uses it to write `urgent_scenario`

### AI call
Model: `anthropic/claude-haiku-4-5` via OpenRouter.
Max tokens: 1024. Temperature: 0.

Prompt asks for only the non-gap-filled fields. Returns JSON object with the 8 fields (or a subset when gap-filled). Parse with regex `/{[\s\S]*}/` fallback, same defensive pattern as the callerFaqText extractor at line 596 of provision/trial.

### Error handling
Non-fatal: catch and return `null`. Caller skips merge on null.

### Function signature
```typescript
export async function generateNicheConfig(
  input: {
    businessName: string
    callerReasons?: string[]
    urgencyWords?: string
    gbpDescription?: string
    websiteContent?: string
    servicesOffered?: string
    hasFaqPairs?: boolean
  },
  apiKey: string
): Promise<CustomNicheConfig | null>
```

---

## Step 4 — provision/trial/route.ts

### Imports to add
```typescript
import { generateNicheConfig } from '@/lib/niche-generator'
import type { CustomNicheConfig } from '@/types/onboarding'
```

### Variable declaration (after `mergedNicheVars`, before INSERT)
```typescript
let generatedNicheConfig: CustomNicheConfig | null = null
```

### Insertion point: after websiteContent is ready (~line 303), before the prompt attempts loop

```typescript
// AI niche config — only for 'other' niche, non-fatal on failure
const effectiveNiche = data.niche || 'other'
if (effectiveNiche === 'other' && process.env.OPENROUTER_API_KEY) {
  generatedNicheConfig = await generateNicheConfig({
    businessName: data.businessName,
    callerReasons: data.callerReasons,
    urgencyWords: data.urgencyWords,
    gbpDescription: data.gbpDescription,
    websiteContent: websiteContent || undefined,
    servicesOffered: typeof intakePayload.services_offered === 'string'
      ? intakePayload.services_offered : undefined,
    hasFaqPairs: (data.faqPairs?.length ?? 0) > 0,
  }, process.env.OPENROUTER_API_KEY)

  if (generatedNicheConfig) {
    // Merge: AI vars as baseline, mergedNicheVars overrides (preserves CLOSE_PERSON from ownerName)
    intakeData.niche_custom_variables = {
      INDUSTRY: generatedNicheConfig.industry,
      PRIMARY_CALL_REASON: generatedNicheConfig.primary_call_reason,
      TRIAGE_DEEP: generatedNicheConfig.triage_deep,
      INFO_TO_COLLECT: generatedNicheConfig.info_to_collect,
      CLOSE_PERSON: generatedNicheConfig.close_person,
      CLOSE_ACTION: generatedNicheConfig.close_action,
      URGENCY_KEYWORDS: generatedNicheConfig.urgent_scenario,
      ...mergedNicheVars,  // higher priority — has CLOSE_PERSON + any manual nicheCustomVariables
    }
    // faq_defaults → niche_faq_pairs only when no manual FAQs (gap-fill rule)
    if (generatedNicheConfig.faq_defaults.length > 0 && !intakeData.niche_faq_pairs) {
      intakeData.niche_faq_pairs = JSON.stringify(
        generatedNicheConfig.faq_defaults.map(p => ({ question: p.q, answer: p.a }))
      )
    }
  }
}
```

### Final clients UPDATE (lines ~383–401)

Add `custom_niche_config` to the update object:
```typescript
...(generatedNicheConfig ? { custom_niche_config: generatedNicheConfig } : {}),
```

---

## Step 5 — regenerate-prompt/route.ts

### Add to SELECT query (line 111)
Append `custom_niche_config` to the field list.

### Import
```typescript
import type { CustomNicheConfig } from '@/types/onboarding'
```

### After the existing merge block (after line ~194), in the `intake?.intake_json` branch

```typescript
// Restore AI-generated niche config for 'other' clients so regen produces the same prompt
if (client.custom_niche_config && (client.niche === 'other' || !client.niche)) {
  const cnc = client.custom_niche_config as CustomNicheConfig
  intakeData.niche_custom_variables = {
    INDUSTRY: cnc.industry,
    PRIMARY_CALL_REASON: cnc.primary_call_reason,
    TRIAGE_DEEP: cnc.triage_deep,
    INFO_TO_COLLECT: cnc.info_to_collect,
    CLOSE_PERSON: cnc.close_person,
    CLOSE_ACTION: cnc.close_action,
    URGENCY_KEYWORDS: cnc.urgent_scenario,
    ...(intakeData.niche_custom_variables as Record<string, string> ?? {}),
  }
  if (cnc.faq_defaults?.length > 0 && !intakeData.niche_faq_pairs) {
    intakeData.niche_faq_pairs = JSON.stringify(
      cnc.faq_defaults.map(p => ({ question: p.q, answer: p.a }))
    )
  }
}
```

---

## What the AI prompt looks like

```
You are configuring a voice receptionist for a small business.

Business: {businessName}
{gbpDescription ? `Google description: ${gbpDescription}` : ''}
{websiteContent ? `Website facts:\n${websiteContent}` : ''}
{servicesOffered ? `Services: ${servicesOffered}` : ''}
{urgencyWords ? `Owner says these situations are urgent: ${urgencyWords}` : ''}

Return ONLY valid JSON with these fields:
{
  "industry": "2–4 word description of what this business does",
  "primary_call_reason": "most common reason callers call",  // omitted if callerReasons provided
  "triage_deep": "...",  // omitted if callerReasons provided
  "info_to_collect": "what to ask caller before closing",
  "close_person": "who the agent hands off to (e.g. 'our team', 'Jake', 'our coordinator')",
  "close_action": "what happens after info is collected",
  "urgent_scenario": "comma-separated trigger words or phrases that warrant [URGENT] flag",
  "faq_defaults": [{"q": "...", "a": "..."}, ...]  // 5 pairs, omitted if hasFaqPairs
}
No markdown. No explanation. JSON only.
```

---

## Duplication guardrails

| Data source | Goes to | NOT duplicated to |
|-------------|---------|-------------------|
| `faqPairs` (manual) | `extra_qa` (line 477) | `niche_faq_pairs` (skip faq_defaults) |
| `callerFaqText` | `extra_qa` (D127, line 563) | `niche_faq_pairs` |
| `faq_defaults` (AI) | `niche_faq_pairs` → `FAQ_PAIRS` slot | `extra_qa` |
| `gbpDescription` | `business_facts` (line 481) | never in niche_custom_variables |
| scrapeContent | `business_facts` + `extra_qa` | never in niche_custom_variables |

---

## Verification

1. Sign up a new trial with niche=other, no website, no faqPairs → confirm `clients.custom_niche_config` is populated with non-generic values
2. Sign up with `callerReasons: ['book appointment', 'get a quote']` → confirm `TRIAGE_DEEP` mentions those reasons, NOT AI-generated
3. Sign up with `faqPairs` manually entered → confirm `faq_defaults` is `[]` in custom_niche_config
4. Dashboard → Rebuild Prompt on an `other` client with custom_niche_config → confirm prompt still uses the niche-specific triage (not reverted to generic)
5. Build passes: `npm run build` in CALLING AGENTs
