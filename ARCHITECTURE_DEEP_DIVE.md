# unmissed.ai — Technical Architecture Briefing

> **Audience:** AI agents and senior developers who need to fully understand, replicate, or extend this system.
> **Status:** Current as of March 2026. Covers Railway-native architecture only. n8n is fully retired for voice agents.
> **Format:** Exact file paths, function names, field names, table/column names throughout. No hand-waving.

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [End-to-End Architecture Flow](#2-end-to-end-architecture-flow)
3. [Onboarding Flow](#3-onboarding-flow)
4. [Settings Flow](#4-settings-flow)
5. [Enrichment Flow](#5-enrichment-flow)
6. [Storage Model — Supabase Schema](#6-storage-model--supabase-schema)
7. [Prompt Assembly Model](#7-prompt-assembly-model)
8. [Runtime Call Assembly](#8-runtime-call-assembly)
9. [Provisioning / Deploy Chain](#9-provisioning--deploy-chain)
10. [Niche Delta Matrix](#10-niche-delta-matrix)
11. [Risks, Duplication, and Coupling Problems](#11-risks-duplication-and-coupling-problems)
12. [Redesign Recommendations](#12-redesign-recommendations)
13. [File Map](#13-file-map)

---

## 1. Executive Summary

**What:** unmissed.ai is an AI voice agent platform. Service businesses (auto glass shops, real estate agents, plumbers, dentists, etc.) sign up, complete a wizard, and receive a live AI receptionist that answers their calls 24/7.

**Stack:** Next.js 15 app on Railway, Ultravox (voice AI), Twilio (telephony), Supabase (data + auth), Resend (transactional email), Telegram bot (owner alerts).

**Core loop:**
1. Owner fills 6-step onboarding wizard → submits intake
2. Admin generates system prompt via Firecrawl/Sonar enrichment → Ultravox agent created
3. Twilio routes inbound calls to Railway webhook → Railway calls Ultravox → voice conversation
4. Call ends → completed webhook fires → OpenRouter classifies lead → Telegram alert to owner
5. Owner views call logs, edits settings, re-deploys prompts from the dashboard

**The system is built around a template-fill prompt architecture.** A 22-variable template (`INBOUND_TEMPLATE_BODY`) is filled per-client using a layered defaults system: `_common` → `NICHE_DEFAULTS[niche]` → intake answers. Two niches (`voicemail`, `real_estate`) use bespoke prompt builders that bypass this template entirely.

**Every active client has:**
- One Supabase row in `clients` (keyed by `slug`)
- One Twilio phone number (bought at activation, stored in `clients.twilio_number`)
- One Ultravox agent (persistent, with per-call `systemPromptSuffix` injection)
- One Supabase Auth user (the client's login)
- One Telegram bot channel (via registration token flow)

---

## 2. End-to-End Architecture Flow

```
OWNER BROWSER
  └─ /onboard wizard (6 steps)
       ↓ POST /api/provision/trial  OR  POST /api/provision (paid)
       ↓
RAILWAY (Next.js)
  ├─ Trial path: activateClient({mode:'trial'}) inline
  │    └─ buys Twilio number, creates Supabase Auth user, sends welcome email+SMS+Telegram token
  └─ Paid path: intake row only → Stripe webhook triggers activateClient({mode:'stripe'})
       ↓
ADMIN (dashboard)
  └─ POST /api/dashboard/generate-prompt
       ├─ (optional) Firecrawl scrapes websiteUrl
       ├─ (optional) Sonar Pro enriches business context
       ├─ buildPromptFromIntake() → system prompt string
       ├─ POST https://api.ultravox.ai/api/agents → ultravox_agent_id
       └─ Supabase UPDATE clients SET system_prompt=..., ultravox_agent_id=...
            ↓
CALLER PHONE → TWILIO NUMBER
  └─ HTTP POST to VoiceUrl = Railway /api/webhook/{slug}/inbound
       ├─ Fetches client row from Supabase
       ├─ Builds callerContext (date/time/phone/history)
       ├─ callViaAgent(agentId, systemPromptSuffix) → Ultravox API
       │    └─ Falls back to createCall(systemPrompt) if agent call fails
       ├─ INSERT call_logs row (status=live)
       └─ Returns TwiML <Stream> with Ultravox joinUrl
            ↓
ULTRAVOX CALL IN PROGRESS
  ├─ Agent executes hangUp / sendSms / transferCall / bookAppointment tools via HTTP back to Railway
  └─ Ultravox fires statusCallback to /api/webhook/{slug}/completed when call ends
            ↓
COMPLETED WEBHOOK
  ├─ Fetches transcript from Ultravox
  ├─ OpenRouter (claude-haiku-4.5) classifies lead (HOT/WARM/COLD/JUNK/MISSED/UNKNOWN)
  ├─ UPDATE call_logs (transcript, classification, duration, status)
  └─ Sends Telegram message to client's chat_id with call summary
```

---

## 3. Onboarding Flow

### Entry Point
File: `agent-app/src/app/onboard/page.tsx`
State type: `OnboardingData` (`agent-app/src/types/onboarding.ts`)
Persistence: `localStorage` key `"unmissed-onboard-draft"`, shape `{step: number, data: OnboardingData}`

### Step Sequence Logic
```typescript
function getStepSequence(niche: Niche | null): number[] {
  if (niche === "voicemail") return [1, 2, 3, 6];  // skips Knowledge (4) and Call Handling (5)
  return [1, 2, 3, 4, 5, 6];
}
```

### Step-by-Step Field Collection

**Step 1 — Industry** (`steps/step1.tsx`)
- `niche`: `"auto_glass" | "hvac" | "plumbing" | "dental" | "legal" | "salon" | "real_estate" | "property_management" | "outbound_isa_realtor" | "restaurant" | "voicemail" | "print_shop" | "barbershop" | "other"`
- Selecting a niche gates visibility of all subsequent fields via `NICHE_CONFIG[niche]`

**Step 2 — Voice** (`steps/step2-voice.tsx`)
- `voiceId`: Ultravox voice UUID (selected from voice picker with audio preview)
- `voiceName`: display name of selected voice
- `agentName`: what the AI calls itself ("Aisha", "Mark", etc.) — per-niche defaults in `defaultAgentNames`
- `businessName`: business display name
- `ownerName`: first name of the owner (real_estate only — used as `CLOSE_PERSON`)
- `contactEmail`: owner's email (receives Resend welcome email)
- `callbackPhone`: the number callers are told will call them back (10+ digits required)
- `city`: city name (injected into `LOCATION_STRING` unless real_estate)
- `state`: province/state code — used in `detectCountry()` for CA vs US Twilio search
- `streetAddress`: optional physical address
- `websiteUrl`: used for Firecrawl scraping during admin prompt generation
- `businessHoursText`: free-text business hours summary (required for most niches; real_estate requires it)

**Step 3 — Basics** (`steps/step3-basics.tsx`)
- `hours`: object `{ [day]: { open: string, close: string, closed: boolean } }` for each day of week
- `afterHoursBehavior`: `"standard" | "strict" | "emergency_only" | "always_open"`
- `emergencyPhone`: optional emergency line number (injected into `AFTER_HOURS_BLOCK`)
- `timezone`: auto-detected on mount via `Intl.DateTimeFormat().resolvedOptions().timeZone`; also mapped from `state` via `TIMEZONE_MAP` in `intake-transform.ts`

**Step 4 — Knowledge & FAQ** (`steps/step4.tsx`)
- `faqPairs[]`: array of `{question: string, answer: string}` pairs — injected into `FAQ_PAIRS` template variable
- `knowledgeDocs[]`: uploaded file metadata — linked to `client_knowledge_docs` Supabase table by `intake_id`
- `nicheAnswers`: object of niche-specific key/value pairs — keys prefixed as `niche_*` in `toIntakePayload()`
- `servicesOffered`: free-text services description — fills `SERVICES_OFFERED` template variable

**Step 5 — Call Handling** (`steps/step5-handling.tsx`)
- `callHandlingMode`: (currently informational)
- `primaryGoal`: (injected into prompt context)
- `pricingPolicy`: `"quote_range" | "no_quote_callback" | "website_pricing" | "collect_first"` — mapped via `PRICING_POLICY_MAP` to an instructions string
- `unknownAnswerBehavior`: `"take_message" | "transfer" | "find_out_callback"` — mapped via `UNKNOWN_ANSWER_MAP`
- `commonObjections[]`: array of objection strings — injected as OBJECTIONS block in prompt
- `notificationMethod`: `"telegram" | "sms" | "both"`
- `notificationPhone`: owner's mobile for SMS alerts
- `callerAutoText`: boolean — whether to auto-send SMS to caller after call
- `callerAutoTextMessage`: the SMS text content

**Step 6 — Review & Activate** (`steps/step6-review.tsx`)
- Read-only summary + two CTA buttons: "Start Free Trial" and "Activate (Paid)"
- Invokes `handleActivate(mode, tier?)` in `page.tsx`
- Trial → `POST /api/provision/trial` with full `OnboardingData`
- Paid → `POST /api/provision` with full `OnboardingData` → redirects to Stripe checkout

### Validation Gate (`canAdvance()` in `page.tsx`)
- Step 1: `!!data.niche`
- Step 3: `businessName` + `callbackPhone` (10+ digits) + `contactEmail` (valid format) + niche-specific conditionals (real_estate requires `ownerName` + `businessHoursText`)
- Steps 2, 4, 5, 6: always true (all optional or have defaults)

### Data Transformation
File: `agent-app/src/lib/intake-transform.ts`
Function: `toIntakePayload(data: OnboardingData) → Record<string, unknown>`

Key transforms:
- `callbackPhone` → `callback_phone` AND `area_code` (first 3 digits)
- `hours` object → `hours_weekday` (string like "Mon–Fri 9am–5pm") and `hours_weekend`
- `state` → `timezone` via `TIMEZONE_MAP` (e.g. `"SK"` → `"America/Regina"`)
- `state` → `country` via `detectCountry()` (CA provinces list → "CA", else "US")
- `nicheAnswers.key` → `niche_key` (prefix `niche_` applied to all nicheAnswer keys)
- `slugify(businessName)` → `client_slug` (lowercase, spaces→hyphens, non-alphanum stripped)

---

## 4. Settings Flow

**Dashboard entry:** `agent-app/src/app/dashboard/[slug]/settings/page.tsx` (assumed)
**Settings component:** `agent-app/src/components/settings/SettingsView.tsx`
**Tab types:** `'general' | 'sms' | 'voice' | 'notifications' | 'billing'`

| Tab | What it controls | Supabase columns updated |
|-----|-----------------|--------------------------|
| Agent | Business name, hours, prompt text, after-hours | `clients.business_name`, `business_hours_weekday`, `business_hours_weekend`, `system_prompt` |
| SMS | Auto-SMS to caller on/off, SMS text | `clients.sms_followup_enabled`, `sms_followup_message` |
| Voice | Voice selection with inline audio preview | `clients.voice_id` via Ultravox PATCH |
| Alerts | Telegram + notification config | `clients.telegram_chat_id`, `notification_method` |
| Billing | Plan, upgrade, cancel | Stripe portal redirect |

**Saving a prompt via settings:**
1. UI calls `PATCH /api/dashboard/settings/{slug}` or similar
2. `system_prompt` written to `clients` Supabase row
3. `updateAgent(agentId, { systemPrompt })` called to push to Ultravox
4. A `prompt_versions` row is inserted for audit trail

**CRITICAL:** Saving via settings UI calls `updateAgent()`, which sends all 10 Ultravox agent fields (not just systemPrompt). Partial PATCH wipes `callTemplate` silently — always send full object. See `memory/patterns.md` Gotcha #34.

**Calendar integration (bookable niches):**
- `clients.booking_enabled` boolean
- When true, `bookAppointment` and `getAvailableSlots` tools injected at call time
- Google OAuth: `/api/auth/google` → `/api/auth/google/callback` → stores tokens in `client_google_tokens` table
- `clients.google_calendar_id` stores the target calendar

---

## 5. Enrichment Flow

Enrichment happens **admin-side only**, triggered from `POST /api/dashboard/generate-prompt`.
It does NOT happen during user onboarding. Users never see this step.

### Step 1 — Website Scraping (Firecrawl)
```typescript
// agent-app/src/app/api/dashboard/generate-prompt/route.ts
const websiteContent = await scrapeAndExtract(intake.website_url)
// → calls Firecrawl API → extracts text → extractBusinessContent() normalizes it
```
- `scrapeAndExtract(url)` calls Firecrawl
- `extractBusinessContent(rawText)` strips nav/footer/boilerplate, returns cleaned paragraph text
- Output is prepended to `caller_faq` / used in prompt FAQ section
- If scraping fails, prompt generation continues without it (non-blocking)

### Step 2 — Sonar Pro Enrichment (Optional)
```typescript
const enriched = await enrichWithSonar(intake)
// → calls OpenRouter with model: perplexity/sonar-pro
// → returns business context: common questions, services, hours, policies
```
- Controlled by admin toggle in the generate-prompt UI
- Output is merged into `intake.caller_faq` alongside scraped content
- Non-blocking if Sonar fails

### Step 3 — Knowledge Docs
```typescript
const knowledgeDocs = await supabase
  .from('client_knowledge_docs')
  .select('content')
  .eq('intake_id', intakeId)
```
- Uploaded during onboarding Step 4 (`knowledgeDocs[]`)
- Stored as `client_knowledge_docs` rows keyed by `intake_id`
- Content injected as `## KNOWLEDGE BASE DOCUMENTS` section in prompt at the end

### Step 4 — Prompt Build + Ultravox Agent Creation
```typescript
const prompt = buildPromptFromIntake(intakeData, websiteContent, knowledgeDocs)
validatePrompt(prompt)  // checks required patterns, char count
const agent = await createAgent({ systemPrompt: prompt, name: slug })
// → stores agentId in clients.ultravox_agent_id
```

### What Is NOT Enrichment
- **Google Places data** (Business Hours from Google) is display-only in the dashboard. It is NOT injected into prompts.
- **Corpus/RAG** (`queryCorpus` tool) is a separate opt-in feature per client, not part of standard enrichment. Controlled by `clients.corpus_enabled`. One global shared corpus across all clients: `ULTRAVOX_CORPUS_ID=62bcd2b8-5a68-4f69-82d5-9280179b146a`.

---

## 6. Storage Model — Supabase Schema

**Project ID:** `qwhvblomlgeapzhnuwlb`

### `clients` (primary client record)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `slug` | text | URL-safe unique identifier (`businessName → slugified`) |
| `business_name` | text | Display name |
| `status` | text | `setup \| active \| paused \| churned` — NOT 'pending' |
| `niche` | text | Niche key string |
| `system_prompt` | text | Active system prompt (Supabase is source of truth) |
| `ultravox_agent_id` | text | Ultravox persistent agent UUID |
| `twilio_number` | text | E.164 Twilio number (e.g. `+13061234567`) |
| `twilio_number_sid` | text | Twilio number SID for programmatic control |
| `callback_phone` | text | Owner's callback number (spoken by agent) |
| `contact_email` | text | Owner's email |
| `voice_id` | text | Ultravox voice UUID |
| `telegram_chat_id` | text | Owner's Telegram chat ID (set after bot registration) |
| `telegram_registration_token` | uuid | One-time token redeemed by `/start {token}` in Telegram bot |
| `timezone` | text | IANA timezone string (e.g. `America/Regina`) |
| `business_hours_weekday` | text | e.g. `"Mon–Fri 9am–5pm"` |
| `business_hours_weekend` | text | e.g. `"Closed"` or `"Sat 10am–2pm"` |
| `forwarding_number` | text | Number to transfer calls to (optional) |
| `booking_enabled` | boolean | Whether calendar booking tools are injected at call time |
| `google_calendar_id` | text | Target Google Calendar for bookings |
| `corpus_enabled` | boolean | Whether `queryCorpus` tool is injected |
| `corpus_id` | text | Reserved for future per-client corpus (DO NOT populate now) |
| `sms_followup_enabled` | boolean | Auto-SMS to caller after call |
| `sms_followup_message` | text | SMS body text |
| `classification_rules` | text | Custom rules for call classification (optional) |
| `created_at` | timestamptz | |

### `intake_submissions` (raw onboarding data)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `client_slug` | text | Matches `clients.slug` |
| `client_id` | uuid | FK to `clients.id` (nullable during early steps) |
| `contact_email` | text | |
| `business_name` | text | |
| `niche` | text | |
| `website_url` | text | Used for Firecrawl scraping |
| `callback_phone` | text | |
| `area_code` | text | First 3 digits of callback_phone |
| `city` | text | |
| `state` | text | Province/state code |
| `country` | text | `"CA"` or `"US"` |
| `timezone` | text | |
| `hours_weekday` | text | |
| `hours_weekend` | text | |
| `services_offered` | text | |
| `caller_faq` | text | Combined FAQ from user + Firecrawl + Sonar |
| `faq_pairs` | jsonb | Structured `[{question, answer}]` array |
| `agent_name` | text | |
| `owner_name` | text | |
| `insurance_preset` | text | |
| `pricing_policy` | text | |
| `unknown_answer_behavior` | text | |
| `after_hours_behavior` | text | |
| `emergency_phone` | text | |
| `niche_*` columns | text | All `nicheAnswers` entries, prefixed `niche_` |
| `progress_status` | text | `pending \| provisioned \| activated` |
| `status` | text | Admin workflow status |
| `created_at` | timestamptz | |

### `call_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `client_id` | uuid | FK to `clients.id` |
| `ultravox_call_id` | text | Ultravox call UUID |
| `caller_phone` | text | E.164 caller number |
| `call_status` | text | `live \| processing \| HOT \| WARM \| COLD \| JUNK \| MISSED \| UNKNOWN` |
| `transcript` | text | Full call transcript |
| `summary` | text | AI-generated summary |
| `duration_seconds` | int | |
| `classification` | text | HOT/WARM/COLD/JUNK/MISSED/UNKNOWN |
| `classification_reason` | text | |
| `telegram_sent` | boolean | |
| `created_at` | timestamptz | |

### `prompt_versions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `client_id` | uuid | FK to `clients.id` |
| `prompt_text` | text | Full prompt snapshot |
| `version_number` | int | Incrementing version |
| `created_by` | text | `admin \| dashboard \| api` |
| `created_at` | timestamptz | |

### `client_knowledge_docs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `client_id` | uuid | |
| `intake_id` | uuid | FK to `intake_submissions.id` |
| `filename` | text | |
| `content` | text | Extracted text content |
| `created_at` | timestamptz | |

### `client_users` (auth mapping)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `client_id` | uuid | FK to `clients.id` |
| `supabase_user_id` | uuid | FK to Supabase Auth users.id |
| `role` | text | `owner \| admin` |

### `activation_log`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | |
| `client_id` | uuid | |
| `mode` | text | `stripe \| trial \| trial_convert` |
| `twilio_number` | text | Number purchased |
| `email_sent` | boolean | |
| `sms_sent` | boolean | |
| `created_at` | timestamptz | |

---

## 7. Prompt Assembly Model

### Architecture

The prompt system uses **template-fill architecture**. One master template (`INBOUND_TEMPLATE_BODY`, embedded as a string constant in `prompt-builder.ts`) contains 22+ `{{VARIABLE}}` placeholders. At prompt generation time, variables are resolved from three layers (last layer wins):

```
Layer 1: NICHE_DEFAULTS._common  (cross-niche base values)
Layer 2: NICHE_DEFAULTS[niche]   (per-niche overrides)
Layer 3: intake answers          (per-client overrides)
```

### Files
- **Template source (canonical):** `BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md`
- **TypeScript runtime:** `agent-app/src/lib/prompt-builder.ts` — `INBOUND_TEMPLATE_BODY` string + `buildPromptFromIntake()`
- **Python CLI:** `PROVISIONING/app/prompt_builder.py` — must stay in sync with `.ts` for any new niches

### Bespoke Builders (bypass template entirely)

Two niches do NOT use `INBOUND_TEMPLATE_BODY`:

| Niche | Builder Function | Why bespoke |
|-------|-----------------|-------------|
| `voicemail` | `buildVoicemailPrompt(intake)` | Radically simpler prompt — no triage, no service info, just name-and-reason message taking |
| `real_estate` | `buildRealEstatePrompt(intake)` | Specialized ISA flow — buyer/seller qualification, showings, OREA obligations |

### Template Structure (all sections in order)

```
[THIS IS A LIVE VOICE PHONE CALL header]
# LIFE SAFETY EMERGENCY OVERRIDE
## ABSOLUTE FORBIDDEN ACTIONS (rules 1–9, + niche FORBIDDEN_EXTRA injected as 10+)
# VOICE NATURALNESS
# GRAMMAR AND SPEECH
# IDENTITY
# TONE AND STYLE ({{TONE_STYLE_BLOCK}})
# GOAL ({{COMPLETION_FIELDS}}, {{CLOSE_PERSON}}, {{CLOSE_ACTION}})
## 1. GREETING ({{GREETING_LINE}})
## 2. THE FILTER (spam/wrong number/hours/location detection)
## 3. TRIAGE ({{TRIAGE_SCRIPT}}, replaced with TRIAGE_DEEP if defined for niche)
## 4. INFO COLLECTION ({{FIRST_INFO_QUESTION}}, {{INFO_TO_COLLECT}}, {{INFO_LABEL}})
## 5. BOOKING FLOW ({{SERVICE_APPOINTMENT_TYPE}}, calendar tools if booking_enabled)
## 6. MESSAGE FLOW + COMPLETION CHECK ({{COMPLETION_FIELDS}})
## 7. AFTER-HOURS ({{AFTER_HOURS_BLOCK}})
## 8. TRANSFER HANDLING ({{TRANSFER_ENABLED}}, {{OWNER_PHONE}})
# PRODUCT KNOWLEDGE BASE ({{FAQ_PAIRS}})
# QUICK RESPONSES (niche NICHE_EXAMPLES if defined)
# ANYTHING ELSE fallback (FILTER_EXTRA injected before this if defined)
## KNOWLEDGE BASE DOCUMENTS (knowledgeDocs appended at end)
```

### Variable Source-of-Truth Table

| Variable | Source | Notes |
|----------|--------|-------|
| `BUSINESS_NAME` | `intake.business_name` | Required |
| `AGENT_NAME` | `intake.agent_name` or `intake.db_agent_name` | Fallback: `"Alex"` |
| `INDUSTRY` | `NICHE_DEFAULTS[niche].INDUSTRY` | Not overridable by intake |
| `CITY` | `intake.city` | |
| `LOCATION_STRING` | Computed: `" in {city}"` or `""` if real_estate | |
| `CLOSE_PERSON` | `NICHE_DEFAULTS[niche].CLOSE_PERSON` | e.g. `"the boss"`, `"our plumber"`, `"our front desk"` |
| `CLOSE_ACTION` | `NICHE_DEFAULTS[niche].CLOSE_ACTION` | e.g. `"call ya back with a quote"` |
| `COMPLETION_FIELDS` | `NICHE_DEFAULTS[niche].COMPLETION_FIELDS` | What must be collected before hangUp |
| `PRIMARY_CALL_REASON` | `NICHE_DEFAULTS[niche].PRIMARY_CALL_REASON` | |
| `TRIAGE_SCRIPT` | `NICHE_DEFAULTS[niche].TRIAGE_SCRIPT` | Array joined to string |
| `FIRST_INFO_QUESTION` | `NICHE_DEFAULTS[niche].FIRST_INFO_QUESTION` | |
| `INFO_TO_COLLECT` | `NICHE_DEFAULTS[niche].INFO_TO_COLLECT` | |
| `INFO_LABEL` | `NICHE_DEFAULTS[niche].INFO_LABEL` | |
| `SERVICE_TIMING_PHRASE` | `NICHE_DEFAULTS[niche].SERVICE_TIMING_PHRASE` | |
| `INSURANCE_STATUS` | `INSURANCE_PRESETS[intake.insurance_preset].status` OR `intake.insurance_status` | |
| `INSURANCE_DETAIL` | `INSURANCE_PRESETS[intake.insurance_preset].detail` OR `intake.insurance_detail` | |
| `MOBILE_POLICY` | `NICHE_DEFAULTS[niche].MOBILE_POLICY`, overridable by `intake.niche_mobileService` | |
| `HOURS_WEEKDAY` | `intake.hours_weekday` | |
| `WEEKEND_POLICY` | `intake.weekend_policy` OR `NICHE_DEFAULTS[niche].WEEKEND_POLICY` | |
| `CALLBACK_PHONE` | `intake.callback_phone` | |
| `OWNER_PHONE` | `intake.owner_phone` (also enables `TRANSFER_ENABLED=true`) | |
| `TRANSFER_ENABLED` | `"false"` by default; `"true"` if `owner_phone` provided | Regex post-processing cleans up literal leaks |
| `EMERGENCY_PHONE` | `intake.emergency_phone` | |
| `AFTER_HOURS_BLOCK` | `buildAfterHoursBlock(intake.after_hours_behavior, emergencyPhone)` | |
| `SERVICES_OFFERED` | `intake.services_offered` → fallback `intake.niche_services` → fallback niche default | |
| `SERVICES_NOT_OFFERED` | `intake.services_not_offered` | Defaults to `""` |
| `FAQ_PAIRS` | Merged: `intake.faq_pairs` (structured JSON) + `intake.caller_faq` (legacy text) | |
| `TONE_STYLE_BLOCK` | Niche default (hardcoded per niche) | |
| `GREETING_LINE` | Niche default | |
| `FILLER_STYLE` | Niche default | |
| `FORBIDDEN_EXTRA` | `NICHE_DEFAULTS[niche].FORBIDDEN_EXTRA` injected as rules 10+ | |
| `URGENCY_KEYWORDS` | Fallback: `'"emergency", "flooding", "no heat"...'` | |
| `SERVICE_APPOINTMENT_TYPE` | `NICHE_DEFAULTS[niche].SERVICE_APPOINTMENT_TYPE` | |

### Post-Fill Injections (after template fill)

In order of application in `buildPromptFromIntake()`:

1. **FORBIDDEN_EXTRA + agent_restrictions** injected as numbered rules 10+ after rule 9
2. **print_shop PRICE QUOTING EXCEPTION** — prepended to restrictions for print_shop only
3. **FILTER_EXTRA** — injected before "ANYTHING ELSE" filter case (niche-specific filter routing)
4. **TRIAGE_DEEP** — replaces `## 3. TRIAGE` section with deep niche-specific routing tree (if defined)
5. **INFO_FLOW_OVERRIDE** — replaces `## 4. INFO COLLECTION` (if defined)
6. **NICHE_EXAMPLES** — appended as `# QUICK RESPONSES` section (if defined)
7. **Knowledge docs** — appended as `## KNOWLEDGE BASE DOCUMENTS` (from `client_knowledge_docs`)
8. **TRANSFER_ENABLED regex cleanup** — replaces `"unless false is true"` etc. with human-readable text

### GLM-4.6 Constraints (Mandatory for All Prompts)

Ultravox v0.7 model = GLM-4.6 (NOT GPT, NOT Claude). Known bugs require mandatory mitigations:
- **Repetition loop:** Sentence-level repeat ban must be explicit in prompt
- **Double-speak:** `"never say"` negative rules must be phrased as positive alternatives
- **Thinking leakage:** Anti-reasoning bleed rules (Rules 12–14) must be present
- **Prompt length hard max:** 8,000 characters. Longer = token budget exceeded = model ignores later rules.
- **Reference:** `memory/glm46-prompting-rules.md`

---

## 8. Runtime Call Assembly

### Inbound Webhook
File: `agent-app/src/app/api/webhook/[slug]/inbound/route.ts`
Triggered by: Twilio `VoiceUrl` on every inbound call

### Processing Steps

```typescript
// 1. Validate Twilio HMAC signature
verifyTwilioRequest(req)  // rejects if invalid

// 2. Look up client
const client = await supabase
  .from('clients')
  .select('id, slug, status, system_prompt, ultravox_agent_id, timezone, business_hours_weekday, ...')
  .eq('slug', slug)
  .single()

// 3. Build callerContext (injected as systemPromptSuffix)
const callerContext = `
CALLER PHONE: ${callerPhone}
Current date: ${formattedDate}
Current time: ${formattedTime} (${client.timezone})
${isAfterHours ? 'AFTER HOURS: yes' : 'AFTER HOURS: no'}
${returningCallerHistory}  // last 3 calls if returning caller
`

// 4. Build businessFacts, extraQa, contextData from client DB columns
const businessFactsStr = buildBusinessFacts(client)
const extraQaStr = buildExtraQa(client.faq_pairs)
const contextDataStr = ...

// 5. Try Agents API path first
const joinUrl = await callViaAgent(client.ultravox_agent_id, {
  systemPromptSuffix: callerContext + businessFactsStr + extraQaStr + contextDataStr,
  selectedTools: [hangUpTool, ...conditionalTools]
})

// 6. Fall back to per-call path if agent call fails
if (!joinUrl) {
  joinUrl = await createCall({
    systemPrompt: client.system_prompt + callerContext + ...,
    selectedTools: [...]
  })
}

// 7. Insert call_logs row
await supabase.from('call_logs').insert({
  client_id: client.id,
  caller_phone: callerPhone,
  call_status: 'live'
})

// 8. Return TwiML
return twiml(<Stream url={joinUrl} />)
```

### Conditional Tool Injection
Tools are added to `selectedTools` at call time based on client state:

| Tool | Condition |
|------|-----------|
| `hangUp` | Always present |
| `sendSms` | Always present (sends to caller's phone) |
| `transferCall` | Only if `client.forwarding_number` is set |
| `bookAppointment` | Only if `client.booking_enabled === true` |
| `getAvailableSlots` | Only if `client.booking_enabled === true` |
| `queryCorpus` | Only if `client.corpus_enabled === true` |

**Tool format (critical):** All inline HTTP tools must use `{"temporaryTool": {...}}` wrapper in `selectedTools`. NOT `modelToolName` at top level — that returns 400. See `memory/patterns.md`.

### After-Hours Detection
Computed server-side at call time, NOT baked into prompt:
```typescript
const isAfterHours = checkIfAfterHours(
  client.business_hours_weekday,
  client.business_hours_weekend,
  client.timezone
)
```
Result is injected into `callerContext` as `AFTER HOURS: yes/no`. The prompt's `AFTER_HOURS_BLOCK` section handles the logic.

### Completed Webhook
File: `agent-app/src/app/api/webhook/[slug]/completed/route.ts`

1. Validates Ultravox HMAC callback signature (`verifyCallbackSig`)
2. Fetches full transcript from Ultravox API
3. Sends transcript to OpenRouter (`anthropic/claude-haiku-4.5`) for classification
4. Returns `HOT | WARM | COLD | JUNK | MISSED | UNKNOWN` + reason
5. Updates `call_logs` row with transcript, classification, duration
6. Sends Telegram message to `clients.telegram_chat_id`
7. If `sms_followup_enabled`: sends Twilio SMS to caller

---

## 9. Provisioning / Deploy Chain

### Path A — Trial (`POST /api/provision/trial`)
File: `agent-app/src/app/api/provision/trial/route.ts`

```
Validate intake → check email uniqueness
INSERT intake_submissions (progress_status=pending)
INSERT clients (status=setup)
→ activateClient({mode:'trial', clientId, intakeId})
  ├─ [SKIP] Twilio number purchase (trial = no number)
  ├─ createUser(email) → Supabase Auth → supabase_user_id
  ├─ INSERT client_users (client_id, supabase_user_id, role=owner)
  ├─ UPDATE clients (supabase_user_id, telegram_registration_token=randomUUID())
  ├─ UPDATE intake_submissions (progress_status=activated)
  ├─ sendWelcomeEmail(contactEmail) → Resend API
  ├─ sendOnboardingSms(callbackPhone) → Twilio SMS API
  └─ INSERT activation_log
→ Return {clientId, trialExpiresAt, setupUrl, telegramLink}
```

**Failure points:**
- Auth user creation fails → `clients` row exists with no auth user (orphan)
- Resend fails → silent (non-blocking), client never gets welcome email
- SMS fails → silent (non-blocking)
- No rollback exists — partial activations leave stale rows

**Rate limits:** 3 trials/hr/IP, 1 per email address

### Path B — Paid (`POST /api/provision` → Stripe webhook)
File: `agent-app/src/app/api/provision/route.ts` + Stripe webhook handler

```
Validate intake
INSERT intake_submissions (progress_status=pending)
Return {jobId}
→ [user redirected to Stripe checkout]
→ [Stripe webhook fires on payment success]
  → activateClient({mode:'stripe', intakeId})
    ├─ Search Twilio for available number in client's area_code
    │    └─ detectCountry(state) determines CA vs US search
    │    └─ Fallback: any available number if area_code unavailable
    ├─ Purchase Twilio number → update VoiceUrl + StatusCallbackUrl
    ├─ UPDATE clients (twilio_number, twilio_number_sid, status=active)
    ├─ createUser(email) → Supabase Auth
    ├─ INSERT client_users
    ├─ UPDATE clients (supabase_user_id, telegram_registration_token=randomUUID())
    ├─ UPDATE intake_submissions (progress_status=activated)
    ├─ sendWelcomeEmail() → Resend
    ├─ sendActivationSms() → Twilio SMS
    └─ INSERT activation_log
```

**Failure points:**
- Twilio number purchase fails (no numbers available in area code) → fallback search, but if that also fails: `clients.twilio_number` = null, client stuck in `setup` status with no phone number
- Stripe webhook fires twice (idempotency gap) → `status=active` guard prevents double-purchase
- Auth user already exists (email collision from a prior trial) → `listUsers` fallback + upsert `client_users`
- Resend sandbox mode → email only delivers to verified addresses (not real clients)

### Prompt Deployment Chain

After `activateClient()` completes, the client has **no system prompt**. Prompt generation is a separate admin step:

```
Admin: POST /api/dashboard/generate-prompt
  → (optional) Firecrawl scrape websiteUrl
  → (optional) Sonar Pro enrichment
  → Load client_knowledge_docs
  → buildPromptFromIntake() → validated prompt string
  → createAgent({systemPrompt, name: slug}) → Ultravox API → agentId
  → UPDATE clients SET system_prompt=..., ultravox_agent_id=...
  → INSERT prompt_versions
  → UPDATE intake_submissions SET status=provisioned
```

**If `generate-prompt` fails after Ultravox agent creation but before Supabase write:**
- Ultravox has an agent that Supabase doesn't know about (orphan agent)
- Client will use `createCall()` fallback (per-call path) which works but is less efficient

**Production deploy via CLI (`/prompt-deploy` skill):**
```
PROVISIONING/app/deploy_prompt.py {client_slug}
1. Read clients/{slug}/SYSTEM_PROMPT.txt
2. UPDATE Supabase clients SET system_prompt=...
3. PATCH Ultravox agent (full 10-field object, read-before-write to preserve callTemplate)
4. Read back Ultravox agent to verify (no silent wipe)
5. INSERT prompt_versions row
```

**CRITICAL:** Ultravox `PATCH /api/agents/{agentId}` creates a new revision that REPLACES the entire `callTemplate`. Always send all fields. `deploy_prompt.py` does a GET before PATCH to preserve existing values.

---

## 10. Niche Delta Matrix

### Shared Template Niches (use `INBOUND_TEMPLATE_BODY`)

| Niche | INDUSTRY | CLOSE_PERSON | CLOSE_ACTION | COMPLETION_FIELDS | Key differentiator |
|-------|----------|-------------|--------------|-------------------|--------------------|
| `auto_glass` | auto glass shop | the boss | call ya back with a quote | year, make, model, timing | ADAS sensor detection in triage |
| `hvac` | heating and cooling company | our technician | call ya back to schedule | system type, issue, timing | Winter no-heat = auto [URGENT] |
| `plumbing` | plumbing company | our plumber | call ya back to book | plumbing issue, location, timing | Active flooding = auto [URGENT] + shut-off valve instruction |
| `dental` | dental office | our front desk | call ya back to book appointment | new/existing, need, timing | New vs existing patient split |
| `legal` | law firm | our legal team | call ya back to discuss | reason for call, contact info | Strict no-advice rule |
| `salon` | salon | the team | call ya back to book | service, preferred timing | Walk-in vs appointment policy |
| `property_management` | property management company | our property manager | call ya back | issue type, unit/address, timing | Emergency triage (flooding/fire) |
| `outbound_isa_realtor` | real estate team | the agent | call ya back | buyer/seller status, timeframe | ISA qualification flow |
| `restaurant` | restaurant | the team | call ya back | order/reservation details | Reservation vs order split |
| `print_shop` | print shop | the team | call ya back | product type, quantity, timing | Price quoting EXCEPTION enabled (unlike all other niches) |
| `barbershop` | barbershop | {owner_first_name} | call ya back to book | service, timing | `PRICE_RANGE` + `WALK_IN_POLICY` niche-specific vars |
| `other` | business | the team | call ya back | caller name, reason | Generic fallback |

### Bespoke Niches (bypass template)

**`voicemail`** — `buildVoicemailPrompt(intake)`
- Minimal prompt (~600 chars)
- No triage, no service knowledge, no completion fields beyond name + reason
- Template: greeting → get name → get reason → close
- No `NICHE_DEFAULTS` used
- Wizard: steps [1, 2, 3, 6] only (skips Knowledge and Call Handling)

**`real_estate`** — `buildRealEstatePrompt(intake)`
- Full ISA (Inside Sales Agent) qualification flow
- Variables: `ownerName` (required, maps to CLOSE_PERSON), area/markets served
- Qualification questions: buyer or seller, timeframe, pre-approval status, price range
- After qualification: routes to agent callback
- Wizard: step 3 requires `ownerName` AND `businessHoursText`

### Niche-Specific Intake Fields (`nicheAnswers` → `niche_*` columns)

| Niche | `nicheAnswers` keys | Mapped column | Effect |
|-------|--------------------|--------------|-|
| `auto_glass` | `mobileService` | `niche_mobileService` | Sets `MOBILE_POLICY` |
| `hvac` | `mobileService` | `niche_mobileService` | Sets `MOBILE_POLICY` |
| `plumbing` | `mobileService` | `niche_mobileService` | Sets `MOBILE_POLICY` |
| `salon` | `bookingType` | `niche_bookingType` | `appointment_only` → `SERVICE_TIMING_PHRASE="book an appointment"` |
| `print_shop` | `pickupOnly`, `websiteUrl`, `emailAddress` | `niche_*` | Sets `MOBILE_POLICY` + SMS template |
| `barbershop` | `priceRange`, `walkInPolicy` | `niche_*` | Sets `PRICE_RANGE`, `WALK_IN_POLICY` |

### `SERVICE_APPOINTMENT_TYPE` Values

Used to gate calendar booking tool injection and prompt phrasing:

| Niche | `SERVICE_APPOINTMENT_TYPE` |
|-------|--------------------------|
| `auto_glass` | `service appointment` |
| `hvac` | `service call` |
| `plumbing` | `service call` |
| `dental` | `appointment` |
| `salon` | `appointment` |
| `barbershop` | `appointment` |
| `legal` | `consultation` |
| `property_management` | `service visit` |
| `restaurant` | `reservation` |

---

## 11. Risks, Duplication, and Coupling Problems

### R1 — Prompt Template Lives in Two Places (High Risk)
`INBOUND_TEMPLATE_BODY` is duplicated between:
- `agent-app/src/lib/prompt-builder.ts` (TypeScript, Railway runtime)
- `PROVISIONING/app/prompt_builder.py` (Python, CLI deploy)

Every niche addition, template change, or new variable must be made in both files manually. No sync check exists. **Risk:** Silent drift between production prompt builder and CLI tool.

### R2 — TRANSFER_ENABLED Literal Leak (Active Bug, Fragile Fix)
The template uses `{{TRANSFER_ENABLED}}` inline in rule text: `"unless {{TRANSFER_ENABLED}} is true"`. When filled, this produces `"unless false is true"` — grammatically broken. The current fix is a post-fill regex that replaces known broken patterns. This is brittle; any new rule phrasing that uses `{{TRANSFER_ENABLED}}` differently will leak through undetected.

### R3 — No Rollback in Activation Chain (High Risk)
`activateClient()` has no transactional rollback. If step 3 (Twilio number purchase) succeeds but step 4 (Supabase write) fails, the number is purchased but the client record isn't updated. The number is orphaned. No retry mechanism, no dead-letter queue.

### R4 — Prompt Generation Is Admin-Only, Not Automated (UX Gap)
After activation, the client has no system prompt until an admin manually triggers `POST /api/dashboard/generate-prompt`. This is a hidden manual step. Clients who activate (especially trial) end up with a null `system_prompt` and the fallback `createCall()` path uses an empty/null prompt. The agent is broken until admin intervenes.

### R5 — Prompt Length Bloat (GLM-4.6 Hard Limit)
The full inbound template with all sections, TRIAGE_DEEP, NICHE_EXAMPLES, FAQ_PAIRS, and knowledge docs can easily exceed the 8,000 character hard max for GLM-4.6. The validator (`validatePrompt()`) checks this but there's no automatic trimming — the admin must manually shorten the prompt. For knowledge-heavy clients (law firms, dental offices with long FAQ), this is a recurring problem.

### R6 — Single Global Corpus (Scalability Risk)
All clients share one Ultravox corpus (`ULTRAVOX_CORPUS_ID`). Ultravox account limit: 2 corpora × 20 documents. If 20 clients each upload 1 document, the corpus is full. The per-client `clients.corpus_id` column is reserved for a future premium tier but is unpopulated — it's dead code today.

### R7 — Voice ID Drift via `deploy_prompt.py`
`deploy_prompt.py` reads `CLIENT_CONFIG[slug].voice_id` to set the voice on every deployment. This silently overwrites any voice the client selected from the dashboard. The client's dashboard choice is not the source of truth — the Python config file is. **Risk:** Client changes voice in dashboard, admin runs deploy, voice reverts.

### R8 — NICHE_DEFAULTS Has No Type Safety
`NICHE_DEFAULTS` is typed as `Record<string, Record<string, string>>`. There's no compile-time enforcement that all required template variables are present for a given niche. Missing variables produce literal `{{VARIABLE}}` strings in the final prompt that Ultravox will speak aloud.

### R9 — OpenRouter Timeout Causes UNKNOWN Classification
The completed webhook calls OpenRouter for call classification with a 30-second timeout. If OpenRouter is slow or down, calls are classified as `UNKNOWN`. `UNKNOWN` calls don't generate Telegram alerts. Owner never knows a call came in. **Mitigation:** 30s timeout added (was missing, causing many UNKNOWN in early 2026). A retry or fallback classifier would eliminate this.

### R10 — callerContext Built Every Call, Not Cached
The `callerContext` block (date, time, timezone, history) is rebuilt from scratch on every inbound webhook. The `returningCallerHistory` lookup queries `call_logs` on every call. At scale, this is an unbounded latency source with no caching.

---

## 12. Redesign Recommendations

### REC-1: Separate Prompt Template from Code
**Current:** `INBOUND_TEMPLATE_BODY` is a string constant inside `prompt-builder.ts`.
**Recommended:** Move to `BUILD_PACKAGES/INBOUND_VOICE_AGENT/TEMPLATE.txt` (single source of truth). Both `.ts` and `.py` builders read it at runtime. Add a hash check in CI to flag drift.

### REC-2: Replace TRANSFER_ENABLED Template Literal with Structured Config
**Current:** `{{TRANSFER_ENABLED}}` fills into rule text, producing broken English, fixed by regex.
**Recommended:** Remove `TRANSFER_ENABLED` from template body. Instead, conditionally include/exclude the Transfer Handling section based on whether `forwarding_number` is set. Zero leakage possible.

### REC-3: Structured Prompt Config vs Monolithic String
**Current:** One giant string with 22+ variables. Long, hard to audit, hard to version.
**Recommended:** Split into named sections stored separately in Supabase (`prompt_sections` table with `client_id`, `section_name`, `content`). Assemble at call time. Allows per-section editing in the dashboard without touching unrelated sections.

### REC-4: Auto-Prompt Generation at Activation
**Current:** Admin must manually trigger prompt generation after activation.
**Recommended:** Queue a background job in the Stripe webhook / trial activation handler that auto-generates the prompt with defaults (no Firecrawl, no Sonar). The admin enrichment step becomes an optional improvement, not a required setup step.

### REC-5: Transactional Activation (or Compensating Actions)
**Current:** No rollback if `activateClient()` fails mid-way.
**Recommended:** Either wrap in a Postgres transaction where possible, or log each completed step and build a `repair-client` script that can re-run from any failed step using the `activation_log` table.

### REC-6: Type-Safe Niche Variable Validation
**Current:** Missing variables silently produce literal `{{VARIABLE}}` in output.
**Recommended:** After template fill, run a regex scan for remaining `{{[A-Z_]+}}` patterns. If any found, throw before creating the Ultravox agent. This is a 3-line addition to `validatePrompt()`.

### REC-7: Voice ID Source of Truth in Supabase
**Current:** `deploy_prompt.py` CLIENT_CONFIG voice_id overwrites dashboard selection.
**Recommended:** `deploy_prompt.py` should read `clients.voice_id` from Supabase as source of truth, not a local config dict. Remove `voice_id` from `CLIENT_CONFIG` entirely.

### REC-8: Per-Client Corpus Tier (When Ready)
**Current:** One global corpus, 20-doc limit, all clients share it.
**Recommended:** When Ultravox raises corpus limits (or on a paid tier), provision per-client corpora. `clients.corpus_id` column already exists — populate it at activation. Move corpus document management to the client dashboard under Knowledge Base tab.

### REC-9: Prompt Bloat Guard
**Current:** Admin must manually shorten prompts that exceed 8K chars.
**Recommended:** Add a trim-and-warn pipeline in `buildPromptFromIntake()`:
- If `NICHE_EXAMPLES` + `FAQ_PAIRS` + `KNOWLEDGE_DOCS` > budget, truncate in that priority order
- Log a warning with section sizes so admin knows what was trimmed

### REC-10: Runtime Context as Tool Response, Not Suffix
**Current:** `callerContext` injected as `systemPromptSuffix` which extends the prompt every call.
**Recommended:** Move to Ultravox Pattern A (Tool Response Instructions) — pre-call context delivered via a tool return value. Cleaner separation, no prompt bloat, allows different context per call stage.

---

## 13. File Map

| Asset | Path | Role |
|-------|------|------|
| Onboarding wizard | `agent-app/src/app/onboard/page.tsx` | Main wizard orchestrator |
| Onboarding data types | `agent-app/src/types/onboarding.ts` | `OnboardingData`, `NICHE_CONFIG`, `defaultAgentNames` |
| Intake transform | `agent-app/src/lib/intake-transform.ts` | `toIntakePayload()`, `slugify()`, `detectCountry()` |
| Trial provision API | `agent-app/src/app/api/provision/trial/route.ts` | Trial activation endpoint |
| Paid provision API | `agent-app/src/app/api/provision/route.ts` | Paid path, intake-only |
| Activation core | `agent-app/src/lib/activate-client.ts` | `activateClient()` — Twilio + Auth + email + SMS + Telegram |
| Prompt generation API | `agent-app/src/app/api/dashboard/generate-prompt/route.ts` | Admin prompt build + Ultravox agent creation |
| Prompt builder (TS) | `agent-app/src/lib/prompt-builder.ts` | `buildPromptFromIntake()`, `NICHE_DEFAULTS`, `INBOUND_TEMPLATE_BODY` |
| Prompt builder (Py) | `PROVISIONING/app/prompt_builder.py` | CLI equivalent — must stay in sync with .ts |
| Deploy script | `PROVISIONING/app/deploy_prompt.py` | CLI: Supabase update + Ultravox PATCH |
| Inbound webhook | `agent-app/src/app/api/webhook/[slug]/inbound/route.ts` | Twilio call entry, Ultravox call creation |
| Completed webhook | `agent-app/src/app/api/webhook/[slug]/completed/route.ts` | Post-call: transcript, classification, Telegram |
| Ultravox client | `agent-app/src/lib/ultravox.ts` | `createAgent()`, `updateAgent()`, `callViaAgent()`, `createCall()` |
| Calendar booking | `agent-app/src/app/api/calendar/[slug]/book/route.ts` | `bookAppointment` tool handler |
| Calendar slots | `agent-app/src/app/api/calendar/[slug]/slots/route.ts` | `getAvailableSlots` tool handler |
| Settings component | `agent-app/src/components/settings/SettingsView.tsx` | Dashboard settings UI |
| Prompt template (canonical) | `BUILD_PACKAGES/INBOUND_VOICE_AGENT/PROMPT_TEMPLATE_INBOUND.md` | Source of truth for template structure |
| Client configs | `clients/{slug}/config.json` | Per-client static config (voice_id, etc.) |
| Client prompts | `clients/{slug}/SYSTEM_PROMPT.txt` | Local prompt files (for CLI deploy) |
| Architecture state | `ARCHITECTURE_STATE.md` | System-level schema/state reference |
| GLM-4.6 rules | `memory/glm46-prompting-rules.md` | **Read before every prompt edit** |
| System architecture | `memory/system-architecture.md` | Definitive reference for call lifecycle |
| Patterns learned | `memory/patterns.md` | Debug patterns + critical gotchas |

---

*Generated: March 2026 | Project: unmissed.ai | See MEMORY.md for session state and open issues.*
