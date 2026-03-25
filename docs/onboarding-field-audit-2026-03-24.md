# Onboarding Field Audit — unmissed.ai
**Date:** 2026-03-24 | **Author:** Claude Code (session 42619e3d)

Source of truth audit of every OnboardingData field: UI display → submission → storage → prompt/agent impact.

---

## 1. ONBOARDING FIELD INVENTORY

| step | step_name | ui_label | internal_field_name | input_type | required | where_shown_in_UI | where_submitted | where_stored | used_after_submit | where_used | affects_agent | affects_prompt | affects_display | notes |
|------|-----------|----------|---------------------|------------|----------|-------------------|-----------------|--------------|-------------------|------------|---------------|----------------|-----------------|-------|
| 1 | Your business | (GBP search) | businessName | autocomplete / text | YES (canAdvance) | step1-gbp | /api/provision/trial body | clients.business_name + intake_submissions.business_name | YES | prompt BUSINESS_NAME, Telegram alert, email subject | YES | YES | YES | Also re-shown editable in step 7 |
| 1 | Your business | (GBP auto) | niche | hidden / auto-detected | YES | step1-gbp (inferred from GBP types) | /api/provision/trial | clients.niche + intake_submissions.niche | YES | NICHE_DEFAULTS selection, niche classification rules | YES | YES | YES | User never explicitly picks niche — inferred from GBP. Manual fallback defaults to "other" |
| 1 | Your business | (GBP auto) | city | hidden / auto | NO | step1-gbp (filled from GBP) | via data blob | clients.city + intake_json.city | YES | Telegram alert, LOCATION_STRING in prompt | YES | YES | NO | Only populated for GBP path. Manual users get "" |
| 1 | Your business | (GBP auto) | state | hidden / auto | NO | step1-gbp (filled from GBP) | via data blob | clients.state + intake_json.province | YES | timezone derivation, area code extraction | YES | NO | NO | |
| 1 | Your business | (GBP auto) | streetAddress | hidden / auto | NO | step1-gbp (NICHE_CONFIG.hasPhysicalAddress only) | via data blob | intake_json only | NO | Not stored to clients table, not used in prompt | NO | NO | NO | Dead field for most niches |
| 1 | Your business | (GBP auto) | callbackPhone | hidden / auto | NO (step 1), re-shown step 7 | step1-gbp (GBP auto) → step7 editable | via data blob | clients.callback_phone + intake_json.callback_phone | YES | area code extraction for Twilio, onboarding SMS target | NO | NO | NO | No validation at step 1. Collected late at step 7. |
| 1 | Your business | (GBP auto) | businessHoursText | hidden / auto | NO | step1-gbp fills from GBP hours array | via data blob | clients.business_hours_weekday (via intakePayload) | YES | {{HOURS_WEEKDAY}} in prompt | YES | YES | YES | Overrides the structured hours object entirely |
| 1 | Your business | Agent name | agentName | text | NO | step1-gbp (after business confirmed) | via data blob | clients.agent_name | YES | {{AGENT_NAME}} in prompt, email, Telegram | YES | YES | YES | Default from niche if user doesn't change |
| 1 | Your business | Agent voice | voiceId | toggle (F/M) | YES (canAdvance) | step1-gbp gender toggle | via data blob | clients.agent_voice_id (via resolveVoiceId) | YES | Ultravox voice selection at createAgent() | YES | NO | NO | Step 3 overrides this with a specific voice ID. Step 1 sets the default gender only. |
| 1 | Your business | (GBP auto) | voiceName | hidden | NO | Not shown | via data blob | nowhere in clients table | NO | Not stored independently | NO | NO | NO | Dead field — only used in wizard display |
| 1 | Your business | (GBP meta) | placeId | hidden | NO | Not shown | via data blob | intake_json only | NO | Nothing reads placeId after submission | NO | NO | NO | Dead field post-submit |
| 1 | Your business | (GBP meta) | placesPhotoUrl | hidden | NO | Shown in GBP confirm card | Not stored | nowhere | NO | | NO | NO | NO | Display-only, never persisted |
| 1 | Your business | (GBP meta) | placesRating | hidden | NO | Shown in GBP confirm card | Not stored | nowhere | NO | | NO | NO | NO | Display-only, never persisted |
| 1 | Your business | (GBP meta) | placesReviewCount | hidden | NO | Shown in GBP confirm card | Not stored | nowhere | NO | | NO | NO | NO | Display-only, never persisted |
| 2 | Agent's job | (card selection) | agentJob | radio card | YES (canAdvance) | step2-job | via data blob | intake_json only | PARTIAL | Maps to callHandlingMode. agentJob itself never read after submission | NO | NO | NO | Thin wrapper over callHandlingMode. The actual used field is callHandlingMode. agentJob is redundant. |
| 2 | Agent's job | (implied) | callHandlingMode | hidden (set by agentJob) | NO | Not directly shown | via data blob | intake_json only (call_handling_mode) | YES | Prompt {{CALL_HANDLING_MODE_INSTRUCTIONS}}, booking_enabled in intakePayload | YES | YES | NO | Set twice: by step2 (job) and step5 (capabilities). Step 5 can override step 2 value. |
| 3 | Voice | (voice picker) | voiceId | voice card selector | YES (canAdvance) | step2-voice-preview | via data blob | clients.agent_voice_id | YES | createAgent() voice param, resolveVoiceId() | YES | NO | YES | This overrides the gender toggle from step 1 |
| 4 | Your plan | (plan card) | selectedPlan | radio card | YES (canAdvance) | step-plan | via data blob | clients.selected_plan | YES | plan entitlements, getEffectiveMinuteLimit(), capability gating in step 5 | YES | NO | YES | Default to 'core' in provision/trial if null |
| 5 | Capabilities | Book appointments | callHandlingMode | checkbox | NO | step3-capabilities (gated: Pro only) | via data blob | intake_json.call_handling_mode | YES | {{CALL_HANDLING_MODE_INSTRUCTIONS}}, booking_enabled flag | YES | YES | NO | Disabled for non-Pro. Can conflict with step 2 selection. |
| 5 | Capabilities | Call forwarding | callForwardingEnabled | checkbox | NO | step3-capabilities (gated: Pro only) | via data blob | intake_json.owner_phone | YES | {{TRANSFER_ENABLED}} in prompt, owner_phone in activate | YES | YES | NO | Only meaningful if Pro plan selected |
| 5 | Capabilities | Forwarding number | emergencyPhone | tel | NO | step3-capabilities (when callForwardingEnabled) | via data blob | clients.after_hours_emergency_phone + intake_json.emergency_phone | YES | {{OWNER_PHONE}}/TRANSFER_ENABLED in prompt builder | YES | YES | NO | Semantic collision: used for both emergency routing AND call forwarding. Two concepts, one field. |
| 6 | Schedule | (mode selection) | scheduleMode | radio card | NO | step4-schedule | via data blob | intake_json only | PARTIAL | Maps to businessHoursText. scheduleMode itself never read downstream. | NO | NO | NO | Thin wrapper over businessHoursText. Redundant field. |
| 6 | Schedule | Your hours | businessHoursText | text | NO | step4-schedule (when not 24/7) | via data blob | clients.business_hours_weekday (via intakePayload) | YES | {{HOURS_WEEKDAY}} in prompt | YES | YES | YES | GBP hours (step 1) can be overridden here. Conflict possible. |
| 7 | Launch | Business name | businessName | text | YES | step6-activate | /api/provision/trial | clients.business_name | YES | Prompt, email, Telegram | YES | YES | YES | Third place user can edit this (GBP, step1 manual, step7) |
| 7 | Launch | Business phone | callbackPhone | tel | NO (not in canAdvance) | step6-activate | via data blob | clients.callback_phone | YES | Area code, onboarding SMS, activate-client | NO | NO | NO | Populated from GBP at step 1; user may not notice it here |
| 7 | Launch | Email address | contactEmail | email | YES | step6-activate | /api/provision/trial validated | intake_submissions.contact_email + clients.contact_email | YES | Auth user creation, welcome email, dashboard login | NO | NO | NO | **First time this is collected — placed at step 7 of 7** |
| 7 | Launch | Website | websiteUrl | url | NO | step6-activate | via data blob | clients.website_url | YES | Website scrape → knowledge base | YES | YES | YES | Silent scrape happens at provision time if this is set |
| 7 | Launch | Notification method | notificationMethod | select | NO | step6-activate | via data blob | intake_json.notification_method | NO | **Never acted on — not read in activate-client.ts or stored to clients** | NO | NO | NO | **Dead field. User chooses but nothing uses it.** |
| — | (hidden) | — | ownerName | prefill from demo visitor | NO | NOT shown in any step | via data blob | clients.owner_name + intake_json.owner_name | YES | Telegram alert, real_estate slug/displayName logic | NO | NO | NO | Ghost field — only set if user previously did the demo. Silent. |
| — | (hidden) | — | timezone | auto-detected on mount | NO | NOT shown | via data blob | clients.timezone | YES | Agent timezone for call handling | YES | NO | NO | Auto-detected via Intl.DateTimeFormat(). Reliable but invisible. |
| — | (hidden) | — | hours (structured) | default object | NO | NOT shown in current wizard | via data blob | clients.business_hours_weekday/_weekend via toIntakePayload | PARTIAL | Fallback if businessHoursText empty (never happens) | NO | NO | NO | Effectively dead — always overridden by businessHoursText |
| — | (hidden) | — | afterHoursBehavior | default: "standard" | NO | NOT shown in current wizard | via data blob | clients.after_hours_behavior | YES | {{AFTER_HOURS_INSTRUCTIONS}} and {{AFTER_HOURS_BLOCK}} in prompt | YES | YES | NO | **Always "standard" for every trial signup. Never collected.** |
| — | (hidden) | — | agentTone | default: "casual" | NO | NOT shown in current wizard | via data blob | intake_json.agent_tone | YES | voice preset → {{TONE_STYLE_BLOCK}}, {{FILLER_STYLE}}, {{GREETING_LINE}}, {{CLOSING_LINE}} | YES | YES | NO | **Always "casual" → casual_friendly preset for every trial signup. Never collected.** |
| — | (hidden) | — | pricingPolicy | default: "" | NO | NOT shown | via data blob | intake_json.pricing_policy | YES | {{PRICING_POLICY_BLOCK}} in prompt (if non-empty) | YES | YES | NO | Empty = no pricing instruction in prompt. Never collected. |
| — | (hidden) | — | unknownAnswerBehavior | default: "" | NO | NOT shown | via data blob | intake_json.unknown_answer_behavior | YES | {{FALLBACK_BEHAVIOR}} in prompt (if non-empty) | YES | YES | NO | Empty = no fallback instruction. Never collected. |
| — | (hidden) | — | primaryGoal | default: "" | NO | NOT shown | via data blob | intake_json.primary_goal | PARTIAL | completion_fields derivation | NO | NO | NO | Empty for all new signups |
| — | (hidden) | — | nicheAnswers | default: {} | NO | NOT shown (niche step removed) | via data blob | intake_json as niche_* prefixed keys | PARTIAL | insurance, services, MOBILE_POLICY — now all from NICHE_DEFAULTS | PARTIAL | PARTIAL | NO | Entire niche Q&A layer is now dead. NICHE_DEFAULTS handles all. |
| — | (hidden) | — | callerFAQ | default: "" | NO | "Moved to Settings" comment | via data blob | intake_json.caller_faq | PARTIAL | {{FAQ_PAIRS}} in prompt if non-empty | YES | YES | NO | Deprecated in wizard. Kept for backwards compat in type. |
| — | (hidden) | — | agentRestrictions | default: "" | NO | "Moved to Settings" comment | via data blob | intake_json.agent_restrictions | NO | {{FORBIDDEN_EXTRA}} only if non-empty | NO | NO | NO | Deprecated in wizard. Dead for all new signups. |
| — | (hidden) | — | completionFields | default: "" | NO | "Moved to Settings" comment | via data blob | intake_json.completion_fields | NO | Empty for all new signups | NO | NO | NO | Deprecated in wizard. |
| — | (hidden) | — | commonObjections | default: [] | NO | NOT shown | via data blob | intake_json.common_objections | NO | Only if non-empty | NO | NO | NO | Dead — always empty |
| — | (hidden) | — | callerAutoText | default: false | NO | NOT shown | via data blob | clients.sms_enabled | YES | Whether sms_enabled is true after activation | YES | NO | NO | **Default mismatch: OnboardingData default=false, activate-client reads !== false = default true if absent.** |
| — | (hidden) | — | callerAutoTextMessage | default: "" | NO | NOT shown | via data blob | clients.sms_template (if non-empty) | NO | sms_template column | NO | NO | NO | Dead — always empty for new signups |
| — | (hidden) | — | notificationPhone | default: "" | NO | NOT shown even when notificationMethod="sms" | via data blob | intake_json.notification_phone | NO | Nothing reads it | NO | NO | NO | Dead field |
| — | (hidden) | — | notificationEmail | default: "" | NO | NOT shown | via data blob | intake_json.notification_email | NO | Nothing reads it | NO | NO | NO | Dead field |
| — | (hidden) | — | faqPairs | default: [] | NO | NOT shown in any wizard step | via data blob | clients.extra_qa (appended to scrape QA) | YES | queryKnowledge tool, knowledge summary | YES | YES | NO | Populated nowhere in wizard but handled correctly at provision |
| — | (hidden) | — | websiteScrapeResult | default: null | NO | Shown conditionally (SCRAPE1 preview if triggered) | via data blob | clients.business_facts + clients.extra_qa + knowledge chunks | YES | Knowledge base, queryKnowledge | YES | YES | YES | The most impactful knowledge field. Populated silently at provision if websiteUrl is set. |
| — | (hidden) | — | ivrEnabled | default: false | NO | NOT shown in current 7-step wizard | via data blob | clients.ivr_enabled | YES | Inbound webhook IVR gate | YES | NO | NO | Silently false for all new signups via wizard |
| — | (hidden) | — | ivrPrompt | default: "" | NO | NOT shown | via data blob | clients.ivr_prompt | NO | | NO | NO | NO | Dead — ivrEnabled always false |
| — | (hidden) | — | servicesOffered | default: "" | NO | NOT shown in wizard | via data blob | clients.services_offered | PARTIAL | {{SERVICES_OFFERED}} in prompt knowledge base | YES | YES | NO | Only populated if GBP or nicheAnswers.services set. Usually empty. |
| — | (hidden) | — | knowledgeDocs | default: [] | NO | NOT shown in wizard | via data blob | client_knowledge_docs (via intake_id) | YES | Knowledge chunks in pgvector | YES | YES | NO | Populated only if user uploaded docs elsewhere |

---

## 2. STEP-BY-STEP FORM BREAKDOWN

### Step 1 — "Your business" (step1-gbp.tsx)

**Purpose:** Identify the business and auto-fill profile from Google Places.

**Fields shown:** GBP search autocomplete, agent name text input (post-confirm), voice gender toggle.

**What the user thinks:** "I'm telling you who I am and picking a voice."

**What the code actually does:**
- Calls a Google Places API endpoint to fetch name, address, phone, hours, photo, rating, types
- Auto-detects niche from `types[]` via `PLACES_TYPE_TO_NICHE` — user never sees or confirms this
- Sets `businessName`, `city`, `state`, `streetAddress`, `callbackPhone`, `businessHoursText`, `placesPhotoUrl/rating/reviewCount`, `placeId`, `niche`
- Auto-assigns `agentName` from `defaultAgentNames[detectedNiche]` if user hasn't customized
- Sets `voiceId` to a gender default (Jacqueline or Mark) — step 3 will override this
- `canAdvance` requires `businessName && voiceId` — voice is required to proceed

**Problems:**
- `contactEmail` and `ownerName` are NOT collected here (placed at step 7 — after plan selection)
- `niche` is silently inferred; if detection fails, defaults to `"other"` — no user correction
- GBP phone (`callbackPhone`) is set here, then shown again at step 7 — most users won't notice
- Manual fallback path only collects `businessName` — city, state, niche all absent/default
- `placesPhotoUrl`, `rating`, `reviewCount` are shown in the confirm card but never stored to DB

### Step 2 — "Agent's job" (step2-job.tsx)

**Purpose:** Define what the agent primarily does.

**Fields shown:** 3 radio cards — `message_taker`, `receptionist`, `booking_agent`.

**What the code actually does:**
- Sets both `agentJob` (display label) and `callHandlingMode` (triage or full_service)
- `booking_agent` sets `callHandlingMode='full_service'` — but step 5 immediately gates this behind Pro plan
- If user picks `booking_agent` on Lite or Core plan, step 5 disables booking and sets `callHandlingMode` back to `'triage'` — silently contradicting step 2's choice

**Problems:**
- `agentJob` itself is never read after submission — only `callHandlingMode` matters
- The booking promise in step 2 is immediately taken away in step 5 for non-Pro users — broken expectation
- No explanation of what "triage" vs "full_service" means technically

### Step 3 — "Voice" (step2-voice-preview.tsx)

Sets `voiceId` to a specific Ultravox voice UUID. Overrides gender default from step 1. Voice tone/style (`agentTone`) is NOT set here — hardcoded to "casual" default and never shown to the user.

### Step 4 — "Your plan" (step-plan.tsx)

Sets `selectedPlan` ('lite' | 'core' | 'pro'). Gates step 5 capabilities. Written to `clients.selected_plan`. No Stripe checkout happens at trial signup — plan is aspirational metadata only.

### Step 5 — "Capabilities" (step3-capabilities.tsx)

- Booking toggle: sets `callHandlingMode` back to 'full_service' or 'triage'
- Forwarding toggle: sets `callForwardingEnabled`, shows `emergencyPhone` input
- `emergencyPhone` serves double duty: emergency routing AND call forwarding. Two concepts, one field.

### Step 6 — "Schedule" (step4-schedule.tsx)

- Sets `scheduleMode` and `businessHoursText`
- `scheduleMode` is never read downstream — only `businessHoursText` matters (redundant state)
- "24/7, always available" is set as a literal string → produces awkward spoken output
- `afterHoursBehavior` (what happens when closed) is never collected — always defaults to "standard"

### Step 7 — "Launch" (step6-activate.tsx)

- Submits the entire `OnboardingData` blob to `/api/provision/trial`
- `contactEmail` appears for the **first time** at step 7 of 7 — if someone drops out here, no account is created and there's no way to recover the session
- `notificationMethod` is captured but never acted on

---

## 3. PROVISIONING MAPPING

### Business Profile
| Source field | Transform | Destination |
|---|---|---|
| businessName | displayName logic (real_estate → ownerName) | clients.business_name, intake_submissions.business_name |
| niche | as-is | clients.niche, intake_submissions.niche |
| city, state | as-is | clients.city, clients.state |
| callbackPhone | digit-strip → area code extraction | clients.callback_phone, intake_json.callback_phone, intake_json.area_code |
| websiteUrl | as-is | clients.website_url |
| ownerName | as-is | clients.owner_name, intake_json.owner_name |
| timezone | Intl.DateTimeFormat auto or TIMEZONE_MAP[state] | clients.timezone |

### Agent Identity / Persona
| Source field | Transform | Destination |
|---|---|---|
| agentName | or defaultAgentNames[niche] | clients.agent_name, prompt {{AGENT_NAME}} |
| voiceId | resolveVoiceId(data.voiceId, null, niche) → final voiceId | clients.agent_voice_id, createAgent() voice param |
| agentTone | always "casual" → casual_friendly preset | prompt {{TONE_STYLE_BLOCK}}, {{FILLER_STYLE}}, {{GREETING_LINE}}, {{CLOSING_LINE}} |

**Canonical issue:** `agentTone` is never user-collected. Every trial agent ships with identical defaults.

### Hours / Availability
| Source field | Transform | Destination |
|---|---|---|
| businessHoursText | if empty: computed from hours object | clients.business_hours_weekday, prompt {{HOURS_WEEKDAY}} |
| hours.saturday/sunday | weekendPolicy string computation | clients.business_hours_weekend, prompt {{WEEKEND_POLICY}} |
| scheduleMode | no downstream use — dead | nowhere |
| afterHoursBehavior | always "standard" | clients.after_hours_behavior, prompt {{AFTER_HOURS_INSTRUCTIONS}} |

**Fragile:** GBP hours come in as raw strings (e.g., "Monday: 9 AM – 5 PM"). The prompt speaks this verbatim. Never normalized for spoken output.

### FAQs / Knowledge
| Source field | Transform | Destination |
|---|---|---|
| websiteScrapeResult | approvedFacts filtered + extraQa filtered | clients.business_facts + clients.extra_qa |
| websiteUrl (fallback) | fresh scrape at provision time | same |
| faqPairs | merged with scrapedQa into allQa | clients.extra_qa (combined) |
| callerFAQ | as string in intakePayload | prompt {{FAQ_PAIRS}} (only if non-empty) |

**Canonical issue:** `extra_qa` is written TWICE — once in route.ts (scrapedFacts + manual faqPairs) and once in activate-client.ts (niche_faq_pairs from intakeJson). The activate-client write overwrites if niche_faq_pairs is present.

### Email / Auth / Invite Flow
1. `createUser({ email: contactEmail, email_confirm: false })`
2. `generateLink({ type: 'invite', redirectTo: /auth/set-password })`
3. Returns `setupUrl = inviteData.properties.action_link`
4. Route handler: if `setupUrl` present → `window.location.href = setupUrl` (skips status page entirely)
5. Otherwise: redirect to `/onboard/status?trial=true&...`

**Critical:** The `setupUrl` redirect is the primary path. The status page (`/onboard/status`) is the fallback.

---

## 4. PROMPT / AGENT IMPACT CLASSIFICATION

| Field | Bucket | Notes |
|---|---|---|
| businessName | B — Structured agent config | {{BUSINESS_NAME}} |
| niche | B — Structured agent config | **Selects entire NICHE_DEFAULTS block — highest single-field impact** |
| agentName | B — Structured agent config | {{AGENT_NAME}} |
| city, state | B — Structured agent config | {{LOCATION_STRING}} |
| agentTone | A — Base prompt behavior rule | Drives {{TONE_STYLE_BLOCK}}, {{FILLER_STYLE}}, {{GREETING_LINE}}, {{CLOSING_LINE}} — **never user-collected** |
| afterHoursBehavior | A — Base prompt behavior rule | {{AFTER_HOURS_INSTRUCTIONS}} — **never user-collected** |
| callHandlingMode | A — Base prompt behavior rule | {{CALL_HANDLING_MODE_INSTRUCTIONS}} |
| callForwardingEnabled + emergencyPhone | E — Runtime-only operational setting | {{TRANSFER_ENABLED}}, syncClientTools() |
| businessHoursText | B — Structured agent config | {{HOURS_WEEKDAY}} |
| hours.saturday/sunday | B — Structured agent config | {{WEEKEND_POLICY}} |
| pricingPolicy | A — Base prompt behavior rule | {{PRICING_POLICY_BLOCK}} — **never user-collected, always empty** |
| unknownAnswerBehavior | A — Base prompt behavior rule | {{FALLBACK_BEHAVIOR}} — **never user-collected** |
| websiteScrapeResult | D — Retrieval/source content | Knowledge chunks → queryKnowledge tool |
| faqPairs | C — Knowledge summary | Merged into extra_qa |
| callerFAQ | G — Dead / unused / ambiguous | Deprecated, never populated in current wizard |
| agentRestrictions | G — Dead / unused / ambiguous | Deprecated |
| completionFields | G — Dead / unused / ambiguous | Deprecated |
| nicheAnswers | G — Dead / unused / ambiguous | Entire layer removed from wizard |
| servicesOffered | C — Knowledge summary | {{SERVICES_OFFERED}} — rarely populated |
| selectedPlan | E — Runtime-only operational setting | Entitlements, minute limits, tool gating |
| contactEmail | F — Display-only field | Auth only, not in prompt |
| callbackPhone | E — Runtime-only operational setting | Area code, SMS target — not in prompt |
| notificationMethod | G — Dead / unused / ambiguous | **Never acted on** |
| agentJob | G — Dead / unused / ambiguous | Redundant wrapper over callHandlingMode |
| scheduleMode | G — Dead / unused / ambiguous | Redundant wrapper over businessHoursText |
| placesPhotoUrl/Rating/ReviewCount | F — Display-only field | Never stored |
| placeId | G — Dead / unused / ambiguous | Never used post-submit |
| voiceId | B — Structured agent config | Ultravox voice selection |
| voiceName | G — Dead / unused / ambiguous | Display only, not stored |
| timezone | E — Runtime-only operational setting | Stored to clients, not in prompt |
| ivrEnabled/ivrPrompt | E — Runtime-only operational setting | Always false for new signups |
| commonObjections | G — Dead / unused / ambiguous | Never populated |
| callerAutoText | E — Runtime-only operational setting | clients.sms_enabled |
| callerAutoTextMessage | G — Dead / unused / ambiguous | Always empty |
| knowledgeDocs | D — Retrieval/source content | Only if docs uploaded elsewhere |
| ownerName | F — Display-only field | Telegram/email display, real_estate slug edge case |

---

## 5. SOURCE-OF-TRUTH AUDIT

### Duplicated / Multi-stored Fields
| Field | Stored locations | Canonical? |
|---|---|---|
| businessHoursText → hours_weekday | clients.business_hours_weekday AND intake_json.hours_weekday | clients table is canonical |
| extra_qa | Written in route.ts (scrapedQa + manualQa) AND in activate-client.ts (niche_faq_pairs) | **Second write overwrites first** |
| contact_email | intake_submissions.contact_email AND clients.contact_email | Both written; clients table wins |
| business_name | intake_submissions.business_name AND clients.business_name | Both written; clients table wins |
| callback_phone | intake_json.callback_phone AND clients.callback_phone | clients table wins |
| system_prompt | clients.system_prompt AND prompt_versions | prompt_versions is audit trail; clients is live |

### Fields Collected But Never Used
- `notificationMethod` — user picks email/telegram/sms but nothing routes notifications based on it
- `agentJob` — never read after submission; callHandlingMode is what matters
- `scheduleMode` — never read downstream; businessHoursText is what matters
- `placeId` — stored in intake_json only; nothing reads it
- `notificationPhone` / `notificationEmail` — in type and intake_json; nothing reads them
- `callerAutoTextMessage` — always ""; clients.sms_template only set if non-empty

### Fields Used But Never Cleanly Collected
- `agentTone` — affects greeting, closing, tone of entire prompt — never shown to user
- `afterHoursBehavior` — affects what agent says when closed — never shown to user
- `pricingPolicy` — affects how agent handles price questions — never shown
- `unknownAnswerBehavior` — affects fallback behavior — never shown
- `ownerName` — used in Telegram alerts and real_estate slug — only populated from demo visitor localStorage

---

## 6. RECOMMENDED CANONICAL AGENTCONTEXT MAPPING

```typescript
AgentContext {
  business: {
    name: string                    // clients.business_name
    niche: Niche                    // clients.niche
    city: string | null             // clients.city
    state: string | null            // clients.state
    timezone: string                // clients.timezone
    websiteUrl: string | null       // clients.website_url
    callbackPhone: string | null    // clients.callback_phone
    // ADD: source: 'gbp' | 'manual' (so dashboard can show unverified badge)
  }

  persona: {
    agentName: string               // clients.agent_name
    voiceId: string                 // clients.agent_voice_id
    voicePreset: VoicePreset        // MISSING from DB — currently always casual_friendly at provision
    // ADD: voicePresetId stored to clients table (currently derived from agentTone which is never set)
  }

  hours: {
    hoursWeekday: string            // clients.business_hours_weekday
    hoursWeekend: string | null     // clients.business_hours_weekend
    afterHoursBehavior: string      // clients.after_hours_behavior — currently always 'standard'
    // ADD: scheduleMode to clients table OR derive from hoursWeekday value
  }

  routing: {
    callForwardingEnabled: boolean  // derive from clients.after_hours_emergency_phone presence
    forwardingNumber: string | null // clients.after_hours_emergency_phone (RENAME this column)
    callHandlingMode: string        // clients.tools JSON / capabilities
    // FIX: split emergencyPhone into two columns: forwarding_number and emergency_number
  }

  capabilities: {
    smsEnabled: boolean             // clients.sms_enabled
    bookingEnabled: boolean         // clients.booking_enabled (derived from tools JSON)
    transferEnabled: boolean        // clients.forwarding_number presence
    ivrEnabled: boolean             // clients.ivr_enabled
    // ADD: knowledgeEnabled (whether websiteUrl + scrape ran successfully)
  }

  knowledgeSummary: {
    businessFacts: string[]         // parsed from clients.business_facts
    extraQa: {q: string; a: string}[]  // clients.extra_qa
    faqPairs: {question: string; answer: string; source: 'manual' | 'scraped'}[]  // ADD source tag
    servicesOffered: string         // clients.services_offered
    // ADD: knowledgeChunkCount (count from client_knowledge_chunks)
    // ADD: scrapeStatus: 'pending' | 'complete' | 'failed' | 'none'
  }

  knowledgeSources: {
    websiteScraped: boolean         // ADD: flag on clients
    websiteScrapedAt: string | null // ADD: timestamp
    gbpUsed: boolean                // ADD: derive from placeId presence in intake_json
    docsUploaded: number            // count of client_knowledge_docs
  }

  trialStatus: {
    subscriptionStatus: string      // clients.subscription_status
    trialExpiresAt: string | null   // clients.trial_expires_at
    selectedPlan: string            // clients.selected_plan
    trialConverted: boolean         // clients.trial_converted
    minutesUsed: number             // clients.minutes_used (or computed from call_logs)
    monthlyMinuteLimit: number      // clients.monthly_minute_limit
  }

  auth: {
    contactEmail: string            // clients.contact_email
    ownerName: string | null        // clients.owner_name
    setupComplete: boolean          // clients.setup_complete
    // ADD: passwordSet (check auth.users.email_confirmed_at)
    // ADD: firstDashboardVisit: boolean (for Screen 2 nav suppression)
  }
}
```

### Fields to Delete or Merge
Delete from `OnboardingData` type entirely:
- `agentJob` — merge into `callHandlingMode` display label
- `scheduleMode` — derive from `businessHoursText`
- `nicheAnswers` — replace with NICHE_DEFAULTS
- `callerFAQ` — move to settings only
- `agentRestrictions` — move to settings only
- `completionFields` — move to settings only
- `commonObjections` — move to settings or delete
- `hours` (structured object) — retire, `businessHoursText` won
- `voiceName` — display-only, redundant
- `notificationPhone` / `notificationEmail` — delete until notification routing built
- `placeId` — keep in intake_json, remove from OnboardingData

---

## 7. BUILD RISKS

**Risk 1 — Fake fields create broken "what your agent knows" moment.**
For most trial signups via manual path (no GBP, no website), `businessFacts` and `extra_qa` will be empty, `servicesOffered` will be "". The agent uses NICHE_DEFAULTS which sound generic. Trust evaporates immediately.

**Risk 2 — callerAutoText default mismatch causes silent sms_enabled=false for all trial users.**
`OnboardingData` default is `callerAutoText: false`. `activate-client` reads `intakeJson.callerAutoText !== false`. Since it's explicitly `false` in the submitted data, every trial client gets `sms_enabled=false`.

**Risk 3 — extra_qa double-write is a race condition.**
`route.ts` writes `scrapedQa + manualQa` to `clients.extra_qa`. Then `activate-client.ts` writes `niche_faq_pairs` to `clients.extra_qa`, overwriting the first write. Currently harmless (nicheAnswers always empty), but fragile.

**Risk 4 — notificationMethod is a broken promise that immediately erodes trust.**
User picks "Telegram" as notification method. No Telegram setup happens. No alert arrives.

**Risk 5 — niche auto-detection has no correction path.**
If GBP detection picks wrong niche, the entire `NICHE_DEFAULTS` block is wrong. The user has no visibility into this.

**Risk 6 — contactEmail at step 7 is an account recovery failure.**
If a user completes 6 of 7 steps and abandons at the email field, nothing is saved server-side. The session lives in localStorage only.

**Risk 7 — agentTone is a major personality decision never exposed.**
Every agent sounds the same (casual/friendly) regardless of niche. The `VOICE_PRESETS` system in `prompt-builder.ts` is fully built and unused for new signups.

**Risk 8 — businessHoursText spoken format is not validated.**
GBP returns hours like "Monday: 9 AM – 5 PM, Tuesday: 9 AM – 5 PM...". The prompt speaks this verbatim, producing terrible spoken output.

---

## 8. FINAL OUTPUTS

### A. Essential Fields for V1 Trial
```
1. businessName         (required)
2. niche                (required — auto-detect or manual pick with correction)
3. city + state         (optional but high-impact)
4. agentName            (required — default from niche, user can change)
5. voiceId              (required — with actual audio preview)
6. businessHoursText    (required — one text field)
7. contactEmail         (required — MOVE TO STEP 2)
8. callbackPhone        (optional but important)
9. websiteUrl           (optional — highest knowledge impact)
10. callHandlingMode    (required — simplified: message_only vs full_service)
```

### B. Delete / Merge List
Delete from OnboardingData type: `agentJob`, `scheduleMode`, `nicheAnswers`, `callerFAQ`, `agentRestrictions`, `completionFields`, `commonObjections`, `hours` (structured object), `voiceName`, `notificationPhone`, `notificationEmail`.

### C. Dashboard-Editable Later (not in onboarding)
| Field | Dashboard section | Impact |
|---|---|---|
| agentTone / voicePreset | Voice & Personality | HIGH |
| afterHoursBehavior | Schedule | HIGH |
| pricingPolicy | Agent Behavior | MEDIUM |
| unknownAnswerBehavior | Agent Behavior | MEDIUM |
| faqPairs (add/edit) | Knowledge | HIGH |
| servicesOffered | Knowledge | MEDIUM |
| callbackPhone (verify) | Business Info | MEDIUM |
| callerAutoText | Notifications | MEDIUM |
| notificationMethod | Notifications | LOW (currently broken) |

### D. Single Most Important Finding
> The fields that most directly affect call quality — `agentTone`, `afterHoursBehavior`, `pricingPolicy`, `unknownAnswerBehavior` — are **never collected** from the user in the current 7-step wizard. Every trial agent ships with identical defaults. The wizard collects impressive-looking config that has minimal downstream prompt impact, while silently skipping the fields that would make the agent actually sound customized for the business.

### E. Single Biggest State Drift Risk
> `extra_qa` has two competing write paths in the same request (`route.ts` vs `activate-client.ts`). The second write conditionally overwrites the first. This will cause silent knowledge loss when nicheAnswers-based FAQ collection is re-enabled.
