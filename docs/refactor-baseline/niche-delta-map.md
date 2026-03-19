# Niche Delta Map
_Phase 5 — Created 2026-03-18_

Source of truth: `agent-app/src/lib/prompt-builder.ts` (NICHE_DEFAULTS + bespoke builders)
Capability source: `agent-app/src/lib/niche-capabilities.ts`
Test coverage: `agent-app/src/lib/__tests__/niche-delta.test.ts`

---

## Builder Path Classification

Every niche falls into one of three builder paths:

| Path | Description | Niches |
|------|-------------|--------|
| **Bespoke** | Entirely separate prompt function; does NOT use the shared inbound template | `voicemail`, `real_estate` |
| **Shared + Heavy Override** | Uses shared `buildPrompt()` template but has 3+ niche-specific override blocks (TRIAGE_DEEP, INFO_FLOW_OVERRIDE, CLOSING_OVERRIDE, NICHE_EXAMPLES, FILTER_EXTRA, custom FAQ builder) | `auto_glass`, `property_management`, `barbershop`, `print_shop` |
| **Shared + Standard** | Uses shared template with niche defaults only (TRIAGE_SCRIPT, FORBIDDEN_EXTRA, TRIAGE_DEEP, NICHE_EXAMPLES, default FAQ) | `hvac`, `plumbing`, `dental`, `legal`, `salon`, `restaurant`, `outbound_isa_realtor`, `other` |

---

## Bespoke Builders (bypass shared template entirely)

### voicemail
- **Builder:** `buildVoicemailPrompt()` (line ~1366)
- **Why bespoke:** No city, no triage script, no info collection flow, no scheduling, no escalation section. Completely different prompt structure: message-taking-only with optional FAQ.
- **Unique features:**
  - `niche_messageRecipient` / `niche_customRecipient` — configurable message target
  - `niche_voicemailBehavior` — `message_only` vs `message_and_faq`
  - `niche_voicemailContext` — freeform special notes section
  - Voicemail-to-email transcription in completed webhook
  - Custom SMS body ("We got your message...")
- **Capabilities:** takeMessages only (all others false)
- **Runtime behavior (completed webhook):**
  - Sends email transcription to `client.contact_email` for non-JUNK calls
  - Custom default SMS body (differs from standard)
- **Overlap with shared:** Life Safety Emergency Override, FORBIDDEN ACTIONS (rules 1-11), Voice Naturalness, Grammar, Edge Cases (wrong number, spam, AI question, caller ends call)

### real_estate
- **Builder:** `buildRealEstatePrompt()` (line ~1588)
- **Why bespoke:** Persona-style prompt (owner's name woven throughout), province-aware formatting, property showing booking, service area handling, `phoneToVoice()` for phone number formatting.
- **Unique features:**
  - `niche_serviceAreas` — array of service areas
  - Province code → full name mapping (`RE_PROVINCE_NAMES`)
  - `phoneToVoice()` — formats phone as digit-by-digit for voice
  - Owner name as first-person persona ("I'm [owner]'s assistant")
  - Property showing booking flow distinct from generic calendar
- **Capabilities:** takeMessages, bookAppointments, transferCalls, useKnowledgeLookup, usePropertyLookup
- **Overlap with shared:** Life Safety Emergency Override, similar FORBIDDEN ACTIONS, Voice Naturalness

---

## Shared + Heavy Override Niches

### auto_glass
- **Override blocks:** TRIAGE_DEEP, FILTER_EXTRA, NICHE_EXAMPLES, FORBIDDEN_EXTRA, custom FAQ (via `buildNicheFaqDefaults`)
- **Unique NICHE_DEFAULTS fields:** `TRIAGE_DEEP` (multi-branch windshield/vehicle/sensor/scheduling), `FILTER_EXTRA` (insurance/billing and delivery routing), `NICHE_EXAMPLES` (5 examples: fast close, owner request refusal, chip triage, sensor unknown, spam)
- **Unique intake field handling:** none beyond standard
- **Runtime behavior (completed webhook):** Rich Telegram format (6-section: vehicle/ADAS/VIN/urgency/contact) — hard-coded `niche === 'auto_glass'` check
- **Capabilities:** takeMessages, transferCalls, useKnowledgeLookup

### property_management
- **Override blocks:** TRIAGE_DEEP, INFO_FLOW_OVERRIDE, CLOSING_OVERRIDE, FILTER_EXTRA, NICHE_EXAMPLES, FORBIDDEN_EXTRA, custom FAQ
- **Why heavy:** Only niche with INFO_FLOW_OVERRIDE (replaces generic info collection: tenant vs prospect vs message flow) and CLOSING_OVERRIDE (replaces generic closing: per-caller-type confirmation)
- **Unique features:**
  - Multi-caller-type routing (tenant maintenance, rental prospect, billing, personal message, unclear)
  - COMPLETION CHECK with tenant-specific gates
  - Emergency routing (flooding, gas, no heat → [URGENT] + 911)
  - Short/1-word answer handling (mirror brevity, don't push elaboration)
  - `FILTER_EXTRA` — commercial property rejection
- **Capabilities:** takeMessages, useKnowledgeLookup, useTenantLookup, emergencyRouting (transferCalls=false, bookAppointments=false)

### barbershop
- **Override blocks:** TRIAGE_DEEP, NICHE_EXAMPLES, FORBIDDEN_EXTRA, custom FAQ
- **Unique NICHE_DEFAULTS fields:** `PRICE_RANGE`, `WALK_IN_POLICY`, `URGENCY_KEYWORDS`
- **Unique intake field handling:** `niche_priceRange`, `niche_walkInPolicy`, `owner_name → CLOSE_PERSON` (first name extraction)
- **Calendar integration:** Yes — `checkCalendarAvailability` + `bookAppointment` with fallback messaging. Group booking (3+) routes to owner bypass.
- **Capabilities:** takeMessages, bookAppointments, transferCalls

### print_shop
- **Override blocks:** NICHE_EXAMPLES (none in NICHE_DEFAULTS — uses FAQ only), FORBIDDEN_EXTRA (none in NICHE_DEFAULTS)
- **Unique features:**
  - `buildPrintShopFaq()` — dynamic FAQ based on intake fields (`niche_rushCutoffTime`, `niche_pickupOnly`, `niche_designOffered`, `niche_websiteUrl`, `niche_emailAddress`)
  - PRICE QUOTING EXCEPTION injected in `buildPromptFromIntake` post-processing (line ~2104) — only niche where price quoting from KB is allowed
  - `URGENCY_KEYWORDS` — print deadline triggers
  - Custom `sms_template` with website URL and email address
- **Unique intake field handling:** `niche_pickupOnly`, `niche_rushCutoffTime`, `niche_designOffered`, `niche_websiteUrl`, `niche_emailAddress`
- **Capabilities:** takeMessages, transferCalls, useKnowledgeLookup

---

## Shared + Standard Niches

These niches use the shared template with defaults and standard overrides only. Key differences are documented per-niche.

### hvac
- **Override blocks:** TRIAGE_DEEP, NICHE_EXAMPLES, FORBIDDEN_EXTRA
- **Unique:** Gas smell → gas company redirect (life safety, not 911). No-heat-in-winter = always [URGENT].
- **Capabilities:** takeMessages, transferCalls, useKnowledgeLookup, emergencyRouting

### plumbing
- **Override blocks:** TRIAGE_DEEP, NICHE_EXAMPLES, FORBIDDEN_EXTRA
- **Unique:** Active flooding → shut-off valve instructions + [URGENT]. Water heater leaking = [URGENT].
- **Capabilities:** takeMessages, transferCalls, useKnowledgeLookup, emergencyRouting

### dental
- **Override blocks:** TRIAGE_DEEP, NICHE_EXAMPLES, FORBIDDEN_EXTRA
- **Unique:** New vs existing patient routing. Calendar capable. No clinical advice.
- **Capabilities:** takeMessages, bookAppointments, transferCalls, useKnowledgeLookup

### legal
- **Override blocks:** TRIAGE_DEEP, NICHE_EXAMPLES, FORBIDDEN_EXTRA
- **Unique:** Confidentiality emphasis. Court deadline = [URGENT]. Opposing party / served with papers handling.
- **Capabilities:** takeMessages, transferCalls, useKnowledgeLookup

### salon
- **Override blocks:** TRIAGE_DEEP, NICHE_EXAMPLES, FORBIDDEN_EXTRA
- **Unique:** Calendar capable. Specific stylist preference. Walk-in handling. Cancellation/reschedule.
- **Capabilities:** takeMessages, bookAppointments, transferCalls, useKnowledgeLookup

### restaurant
- **Override blocks:** TRIAGE_DEEP, NICHE_EXAMPLES, FORBIDDEN_EXTRA
- **Unique:** Menu questions answerable from KB. Phone orders conditional. Catering inquiry routing.
- **Capabilities:** takeMessages, useKnowledgeLookup (transferCalls=false, bookAppointments=false)

### outbound_isa_realtor
- **Override blocks:** none (no TRIAGE_DEEP, no NICHE_EXAMPLES, no FORBIDDEN_EXTRA, no custom FAQ)
- **Unique:** Outbound call flow (not inbound). "Not interested" / "wrong person" handling. Booking = scheduling agent callback.
- **Capabilities:** takeMessages, bookAppointments
- **Note:** Lightest shared-path niche. Relies entirely on template defaults.

### other
- **Override blocks:** none
- **Unique:** Catch-all for unregistered niches. Most conservative capability set.
- **Capabilities:** takeMessages, transferCalls
- **Note:** Fallback niche — `NICHE_DEFAULTS.other` serves as the default for unknown niches.

---

## Override Block Inventory

Which NICHE_DEFAULTS keys trigger post-processing in `buildPromptFromIntake`:

| Override Key | Effect | Used By |
|-------------|--------|---------|
| `TRIAGE_DEEP` | Replaces `## 3. TRIAGE` section in template | auto_glass, hvac, plumbing, dental, legal, salon, property_management, barbershop, restaurant |
| `INFO_FLOW_OVERRIDE` | Replaces `## 4. INFO COLLECTION` section | property_management only |
| `CLOSING_OVERRIDE` | Replaces `## 6. CLOSING` section | property_management only |
| `NICHE_EXAMPLES` | Replaces `# INLINE EXAMPLES` section | auto_glass, hvac, plumbing, dental, legal, salon, property_management, barbershop, restaurant |
| `FILTER_EXTRA` | Injected before "ANYTHING ELSE" in filter section | auto_glass, property_management |
| `FORBIDDEN_EXTRA` | Appended as numbered rules after rule 9 | auto_glass, hvac, plumbing, dental, legal, salon, property_management, barbershop, restaurant |
| `URGENCY_KEYWORDS` | Replaces default urgency trigger list | print_shop, barbershop |
| `sms_template` | Custom SMS follow-up message | print_shop, barbershop |

---

## Runtime Niche Branching (outside prompt builder)

These are niche-specific branches in runtime code (webhooks):

| File | Niche Check | Behavior |
|------|-------------|----------|
| `completed/route.ts:144` | `niche === 'auto_glass'` | Rich 6-section Telegram format with vehicle/ADAS/VIN fields |
| `completed/route.ts:249` | `niche === 'voicemail'` | Custom default SMS body for voicemail clients |
| `completed/route.ts:267` | `niche === 'voicemail'` | Email transcription to `contact_email` |

---

## Niche-Specific Intake Fields

Fields unique to certain niches (consumed in `buildPromptFromIntake`):

| Niche | Intake Fields |
|-------|--------------|
| barbershop | `niche_priceRange`, `niche_walkInPolicy` |
| print_shop | `niche_rushCutoffTime`, `niche_pickupOnly`, `niche_designOffered`, `niche_websiteUrl`, `niche_emailAddress` |
| voicemail | `niche_messageRecipient`, `niche_customRecipient`, `niche_voicemailBehavior`, `niche_voicemailContext` |
| real_estate | `niche_serviceAreas` |
| salon | `niche_bookingType` |
| all (generic) | `niche_mobileService`, `niche_services`, `niche_faq_pairs` |

---

## Post-Processing Special Cases in buildPromptFromIntake

| Line | Check | What It Does |
|------|-------|-------------|
| 1851 | `niche === 'voicemail'` | Early return → bespoke builder |
| 1854 | `niche === 'real_estate'` | Early return → bespoke builder |
| 1910-1913 | `niche === 'print_shop'` | Force `MOBILE_POLICY` to pickup-only |
| 1916-1926 | `niche === 'barbershop'` | Map `niche_priceRange`, `niche_walkInPolicy`, owner_name → CLOSE_PERSON |
| 2104-2106 | `niche === 'print_shop'` | Inject PRICE QUOTING EXCEPTION |
| 2190-2192 | `niche === 'print_shop'` | Use `buildPrintShopFaq()` instead of `buildNicheFaqDefaults()` |

---

## Niche Family Groupings (for testing)

Tests should cover at least one niche per family:

| Family | Representative | Reason |
|--------|---------------|--------|
| Bespoke | `voicemail` | Simplest bespoke — pure message-taking |
| Bespoke | `real_estate` | Complex bespoke — persona, province, booking |
| Heavy Override | `property_management` | Most overrides (INFO_FLOW, CLOSING, FILTER, TRIAGE_DEEP) |
| Heavy Override | `auto_glass` | Rich runtime branching (Telegram format) |
| Standard + Booking | `barbershop` | Calendar tools + custom fields |
| Standard + Emergency | `hvac` | emergencyRouting=true + TRIAGE_DEEP |
| Standard + Knowledge | `restaurant` | useKnowledgeLookup but no transfer/booking |
| Standard Minimal | `other` | Fallback/catch-all |
