# Prompt Sandwich Specification

> **D285** — Strict top-to-bottom section order for all voice agent system prompts.
> **Created:** 2026-03-31 | **Phase:** 1 (Foundation)
> **Source:** Derived from `src/lib/prompt-config/template-body.ts` + `src/lib/prompt-builder.ts`

---

## Architecture

```
BREAD (top)     = Safety + Forbidden Actions          (~1,200 chars, static, us-controlled)
VOICE LAYER     = Naturalness + Grammar               (~800 chars, static)
IDENTITY        = Who the agent is                     (~200 chars, dynamic from DB)
STYLE           = Tone + communication rules           (~400 chars, dynamic from voice preset)
GOAL            = Primary goal + completion fields      (~200 chars, dynamic from mode)
FILLING         = Conversation flow + triage + examples (~1,500-3,000 chars, dynamic from niche+mode+intake)
CONDITIONAL     = After hours, transfer, calendar, SMS  (0-1,500 chars, present only when enabled)
BREAD (bottom)  = Returning caller + call handling mode (~300 chars, static framework)
```

**Target:** 4,000-5,000 chars base (safety + identity + voice + flow skeleton)
**Max with all conditionals:** 8,000 chars (GLM-4.6 optimal per `memory/glm46-prompting-rules.md`)
**Hard ceiling:** 12,000 chars (enforced by `validatePrompt()`)

---

## Slot Definitions

### Slot 1: SAFETY_PREAMBLE
| Property | Value |
|----------|-------|
| **Slot ID** | `SAFETY_PREAMBLE` |
| **Type** | Static |
| **Position** | 1 (absolute top — executes before all other rules) |
| **Source DB fields** | None |
| **Current location** | `template-body.ts` lines 4-20 |
| **Current patcher** | None |
| **Missing data behavior** | Always present — never omitted |
| **Char budget** | ~600 chars |

**Content:** The `[THIS IS A LIVE VOICE PHONE CALL]` preamble + `LIFE SAFETY EMERGENCY OVERRIDE` block. Directs to 911 for medical, fire, suicidal, active crime emergencies. Cannot be overridden by any other section.

---

### Slot 2: FORBIDDEN_ACTIONS
| Property | Value |
|----------|-------|
| **Slot ID** | `FORBIDDEN_ACTIONS` |
| **Type** | Static base + conditional niche/mode appendages |
| **Position** | 2 |
| **Source DB fields** | `niche` (for niche-specific FORBIDDEN_EXTRA), `agent_restrictions` (intake), mode (for mode FORBIDDEN_EXTRA) |
| **Current location** | `template-body.ts` lines 22-42 (16 base rules); builder lines 568-596 (injection after rule 9) |
| **Current patcher** | None |
| **Missing data behavior** | Base 16 rules always present. Extra rules appended only when niche/mode/intake provides them. |
| **Char budget** | ~1,200 chars base + 0-400 chars extras |

**Content:** 16 numbered rules (no formatting, no prices, no stacking questions, no repeating, etc.). Niche-specific extras injected after rule 9 as rules 10+. Mode extras (e.g. voicemail_replacement: "Do not triage or diagnose") also injected here.

**Injection pipeline:** `nicheRestriction` (print_shop price exception) → `nicheDefaults.FORBIDDEN_EXTRA` → `modeForbiddenExtra` → `intake.agent_restrictions` → numbered and inserted after rule 9.

---

### Slot 3: VOICE_NATURALNESS
| Property | Value |
|----------|-------|
| **Slot ID** | `VOICE_NATURALNESS` |
| **Type** | Static base + 1 dynamic variable |
| **Position** | 3 |
| **Source DB fields** | `voice_style_preset` (resolves `{{FILLER_STYLE}}` from preset) |
| **Current location** | `template-body.ts` lines 45-54 |
| **Current patcher** | `patchVoiceStyleSection()` in `prompt-patcher.ts` (patches TONE but not this section) |
| **Missing data behavior** | Always present. `{{FILLER_STYLE}}` defaults to casual preset if not set. |
| **Char budget** | ~400 chars |

**Content:** Instructions for natural phone speech patterns — short responses, micro-turns, handling interruptions, confirming names. `{{FILLER_STYLE}}` injects preset-specific filler words (e.g. "like, uh, y'know" for casual vs none for professional).

---

### Slot 4: GRAMMAR
| Property | Value |
|----------|-------|
| **Slot ID** | `GRAMMAR` |
| **Type** | Static |
| **Position** | 4 |
| **Source DB fields** | None |
| **Current location** | `template-body.ts` lines 56-66 |
| **Current patcher** | None |
| **Missing data behavior** | Always present |
| **Char budget** | ~400 chars |

**Content:** Human speech patterns — start with "And/But/So", use contractions ("gonna", "kinda"), fragment responses, trail off naturally. Makes agent sound human, not scripted.

---

### Slot 5: IDENTITY
| Property | Value |
|----------|-------|
| **Slot ID** | `IDENTITY` |
| **Type** | Dynamic |
| **Position** | 5 |
| **Source DB fields** | `agent_name`, `business_name`, `city`/`province` (→ LOCATION_STRING), `niche` (→ INDUSTRY), `voice_style_preset` (→ PERSONALITY_LINE) |
| **Current location** | `template-body.ts` lines 68-71 |
| **Current patcher** | `patchAgentName()` in `prompt-patcher.ts` (word-boundary replace of old name with new) |
| **Section marker** | `<!-- unmissed:identity -->` (client-editable) |
| **Missing data behavior** | `AGENT_NAME` defaults to "Alex". `LOCATION_STRING` omitted if city is missing/N/A. |
| **Char budget** | ~150-250 chars |

**Content:** "You are {{AGENT_NAME}}, the front desk person at '{{BUSINESS_NAME}}'{{LOCATION_STRING}}. You work at a {{INDUSTRY}}. {{PERSONALITY_LINE}}"

---

### Slot 6: TONE_AND_STYLE
| Property | Value |
|----------|-------|
| **Slot ID** | `TONE_AND_STYLE` |
| **Type** | Dynamic |
| **Position** | 6 |
| **Source DB fields** | `voice_style_preset` (resolves TONE_STYLE_BLOCK, GREETING_LINE, CLOSING_LINE from preset) |
| **Current location** | `template-body.ts` lines 73-83 |
| **Current patcher** | `patchVoiceStyleSection()` in `prompt-patcher.ts` (replaces TONE AND STYLE section content) |
| **Missing data behavior** | Defaults to `casual_friendly` preset |
| **Char budget** | ~400 chars |

**Content:** Preset-driven tone block + phone number pronunciation rules + date formatting + frustration handling + interruption handling + backchannel acknowledgments. Includes `{{TONE_STYLE_BLOCK}}` from the selected voice preset.

---

### Slot 7: GOAL
| Property | Value |
|----------|-------|
| **Slot ID** | `GOAL` |
| **Type** | Dynamic |
| **Position** | 7 |
| **Source DB fields** | `call_handling_mode` / `agent_mode` (→ PRIMARY_GOAL), `completion_fields`, `owner_name` (→ CLOSE_PERSON), mode (→ CLOSE_ACTION) |
| **Current location** | `template-body.ts` lines 84-89; builder lines 537-551 (PRIMARY_GOAL injection) |
| **Current patcher** | None |
| **Missing data behavior** | PRIMARY_GOAL defaults to "Understand what the caller needs, collect their info, and route to callback." |
| **Char budget** | ~200-300 chars |

**Content:** "YOUR PRIMARY GOAL: {mode-specific goal}" + "Primary: Collect {{COMPLETION_FIELDS}} so {{CLOSE_PERSON}} can {{CLOSE_ACTION}}." + secondary routing instruction.

---

### Slot 8: CONVERSATION_FLOW
| Property | Value |
|----------|-------|
| **Slot ID** | `CONVERSATION_FLOW` |
| **Type** | Dynamic (heavy — most complex slot) |
| **Position** | 8 |
| **Source DB fields** | `voice_style_preset` (→ GREETING_LINE), `niche` (→ TRIAGE_DEEP, filter cases, info flow, closing), `call_handling_mode`/`agent_mode` (→ mode triage), `booking_enabled` (→ stage transition trigger), `niche_custom_variables` (→ TRIAGE_DEEP from Haiku D247), `service_catalog` (→ appointment booking flow), many niche-specific intake fields |
| **Current location** | `template-body.ts` lines 91-178; builder lines 598-698 (FILTER_EXTRA, triageDeep, infoFlowOverride, closingOverride, nicheExamples injection) |
| **Current patcher** | None for conversation flow as a whole |
| **Missing data behavior** | Greeting defaults to preset. Triage defaults to mode fallback. Info collection defaults to generic. |
| **Char budget** | ~1,500-3,000 chars (largest slot, varies heavily by niche) |

**Sub-sections (all within this slot):**
1. **GREETING** (step 1): `{{GREETING_LINE}}` — from niche wow-greeting or voice preset
2. **FILTER** (step 2): Static routing table (wrong number, spam, hours, AI question, hiring, insurance, services not offered, caller ends call, silence) + `FILTER_EXTRA` from niche defaults + `{{PRIMARY_CALL_REASON}}` goto triage
3. **TRIAGE** (step 3): Replaced by `TRIAGE_DEEP` — niche-specific or mode-specific or Haiku-generated (D247 `niche_custom_variables.TRIAGE_DEEP`)
4. **INFO_COLLECTION** (step 4): Generic or `INFO_FLOW_OVERRIDE` from niche defaults
5. **SCHEDULING** (step 5): Mostly static with {{SERVICE_TIMING_PHRASE}} and {{WEEKEND_POLICY}}
6. **CLOSING** (step 6): Completion check + `{{CLOSING_LINE}}` from preset or `CLOSING_OVERRIDE` from niche

**Note:** This is the slot most likely to be decomposed into sub-slots in Phase 2 (D274). For now, it remains a single monolithic slot because the sub-sections are tightly coupled (e.g., triage references info collection variables, closing references completion fields).

---

### Slot 9: AFTER_HOURS
| Property | Value |
|----------|-------|
| **Slot ID** | `AFTER_HOURS` |
| **Type** | Conditional |
| **Position** | 9 |
| **Source DB fields** | `after_hours_behavior`, `after_hours_emergency_phone` |
| **Current location** | `template-body.ts` lines 176-178 (`{{AFTER_HOURS_BLOCK}}`); builder line 371 (`buildAfterHoursBlock()`); also `AFTER_HOURS_INSTRUCTIONS` in filter section |
| **Current patcher** | None (content is per-call context injected, but the prompt block is built at generation) |
| **Section marker** | `<!-- unmissed:after_hours -->` (client-editable) |
| **Missing data behavior** | Omit section entirely if `after_hours_behavior` is `take_message` (default) |
| **Char budget** | 0-300 chars |

**Content:** Behavior instructions for after-hours calls. Three variants: `standard` (inform hours, take message), `route_emergency` (offer transfer to emergency phone), `take_message` (no special behavior — section omitted).

**Runtime note:** After-hours *detection* is per-call context (`detectAfterHours()` in `agent-context.ts`), injected via `{{callerContext}}` at call time. This slot defines the *instructions*, not the detection logic.

---

### Slot 10: ESCALATION_TRANSFER
| Property | Value |
|----------|-------|
| **Slot ID** | `ESCALATION_TRANSFER` |
| **Type** | Conditional (two branches: enabled/disabled) |
| **Position** | 10 |
| **Source DB fields** | `forwarding_number` (→ TRANSFER_ENABLED), `transfer_conditions`, `urgency_keywords` |
| **Current location** | `template-body.ts` lines 179-197 |
| **Current patcher** | None |
| **Missing data behavior** | Always present (both enabled and disabled branches are in the prompt). Transfer behavior depends on `{{TRANSFER_ENABLED}}` runtime value. |
| **Char budget** | ~500 chars |

**Content:** Transfer triggers (explicit ask, urgency keywords, confidence fallback) + enabled path (collect info first, then transferCall tool) + disabled path (promise callback, collect info, never pretend to transfer).

**Known issue:** `TRANSFER_ENABLED` is resolved as literal "true"/"false" string, then builder lines 553-566 clean up nonsensical phrases like "unless false is true". Both branches remain in the prompt.

---

### Slot 11: RETURNING_CALLER
| Property | Value |
|----------|-------|
| **Slot ID** | `RETURNING_CALLER` |
| **Type** | Static |
| **Position** | 11 |
| **Source DB fields** | None (behavior triggered by `callerContext` at call time) |
| **Current location** | `template-body.ts` lines 198-205 |
| **Current patcher** | None |
| **Missing data behavior** | Always present |
| **Char budget** | ~200 chars |

**Content:** Instructions for when `callerContext` includes returning caller data — greet by name, reference last topic, don't re-ask collected info, skip small talk.

---

### Slot 12: INLINE_EXAMPLES
| Property | Value |
|----------|-------|
| **Slot ID** | `INLINE_EXAMPLES` |
| **Type** | Static base or niche override |
| **Position** | 12 |
| **Source DB fields** | `niche` (for niche-specific examples via `NICHE_EXAMPLES` in niche-defaults) |
| **Current location** | `template-body.ts` lines 206-238; builder lines 700-711 (niche example injection) |
| **Current patcher** | None |
| **Missing data behavior** | Generic examples always present. Niche override replaces entire section when available. |
| **Char budget** | ~500-800 chars |

**Content:** 6 example dialogues (A-F) showing correct agent behavior: clear service need, price question, wants human, confused caller, demands transfer, spam robocall. Niche override replaces all 6 with niche-specific examples.

---

### Slot 13: CALL_HANDLING_MODE
| Property | Value |
|----------|-------|
| **Slot ID** | `CALL_HANDLING_MODE` |
| **Type** | Dynamic |
| **Position** | 13 |
| **Source DB fields** | `call_handling_mode`, `agent_mode` (agent_mode takes precedence) |
| **Current location** | `template-body.ts` lines 240-241 (`{{CALL_HANDLING_MODE_INSTRUCTIONS}}`); builder lines 464-472 |
| **Current patcher** | None |
| **Missing data behavior** | Defaults to `triage` mode instructions |
| **Char budget** | ~200-400 chars |

**Content:** Mode-specific behavioral override. Defined in `MODE_INSTRUCTIONS` map in `prompt-patcher.ts`. Modes: `triage`, `voicemail_replacement`, `lead_capture`, `info_hub`, `appointment_booking`, `full_service`.

---

### Slot 14: FAQ_PAIRS
| Property | Value |
|----------|-------|
| **Slot ID** | `FAQ_PAIRS` |
| **Type** | Dynamic |
| **Position** | 14 |
| **Source DB fields** | `niche_faq_pairs` (structured JSON), `caller_faq` (legacy free-text) |
| **Current location** | `template-body.ts` lines 243-244 (`{{FAQ_PAIRS}}`); builder lines 493-508 |
| **Current patcher** | None |
| **Missing data behavior** | "No FAQ pairs configured yet." when empty |
| **Char budget** | 0-800 chars |

**Content:** Structured Q&A pairs from onboarding. Format: bold question → spoken answer. Merged with legacy `caller_faq` if present.

---

### Slot 15: KNOWLEDGE_BASE
| Property | Value |
|----------|-------|
| **Slot ID** | `KNOWLEDGE_BASE` |
| **Type** | Dynamic |
| **Position** | 15 |
| **Source DB fields** | `niche` (for default FAQ), `caller_faq` (custom override), niche-specific intake fields, `pricing_policy`, `unknown_answer_behavior` |
| **Current location** | `template-body.ts` lines 246-265 (placeholder); builder lines 720-767 (replacement + pricing/unknown injection); `prompt-helpers.ts` `buildNicheFaqDefaults()` |
| **Current patcher** | None |
| **Section marker** | `<!-- unmissed:knowledge -->` (client-editable) |
| **Missing data behavior** | Niche FAQ defaults used when `caller_faq` is empty. Section always present. |
| **Char budget** | ~600-1,500 chars |

**Content:** "# PRODUCT KNOWLEDGE BASE" section. Contains niche-specific Q&A (10-13 entries per niche) or custom `caller_faq`. Pricing policy instruction and unknown-answer behavior instruction appended after the Q&A.

**D265 note:** This entire section is a candidate for removal once pgvector knowledge retrieval fully replaces hardcoded FAQ. The `queryKnowledge` tool serves the same content at runtime from `knowledge_chunks`.

---

### Slot 16: OBJECTION_HANDLING
| Property | Value |
|----------|-------|
| **Slot ID** | `OBJECTION_HANDLING` |
| **Type** | Conditional |
| **Position** | Between 14 and 15 (injected before KNOWLEDGE_BASE) |
| **Source DB fields** | `common_objections` (JSON array of {question, answer} pairs from intake) |
| **Current location** | Builder lines 384-396 (parsing), lines 769-778 (injection) |
| **Current patcher** | None |
| **Missing data behavior** | Omit entirely when `common_objections` is empty or missing |
| **Char budget** | 0-500 chars |

**Content:** "## OBJECTION HANDLING" — caller pushback responses. Only present when onboarding includes objection handling pairs.

**Note:** Not in the original 18-slot plan. Adding as a discovered section. Consider merging with FAQ_PAIRS or KNOWLEDGE_BASE in Phase 3.

---

### Slot 17: CALENDAR_BOOKING
| Property | Value |
|----------|-------|
| **Slot ID** | `CALENDAR_BOOKING` |
| **Type** | Conditional |
| **Position** | 17 (appended after knowledge base) |
| **Source DB fields** | `booking_enabled`, `niche` (→ capabilities.bookAppointments), `service_catalog` (→ SERVICE_APPOINTMENT_TYPE), `owner_name` (→ CLOSE_PERSON) |
| **Current location** | Builder lines 783-788 (build-time append); `prompt-patcher.ts` lines 20-39 (`calendarBlock()`), lines 48-66 (`patchCalendarBlock()` for post-provision enable) |
| **Current patcher** | `patchCalendarBlock()` — adds/removes the block when `booking_enabled` is toggled in settings |
| **Missing data behavior** | Omit entirely when `booking_enabled=false` or niche doesn't support appointments |
| **Char budget** | 0-600 chars |

**Content:** Step-by-step calendar booking flow (ask day → check availability → read slots → collect name → book → confirm). Includes fallback handling for full days and tool errors. Also injects `transitionToBookingStage` trigger in the TRIAGE section when enabled.

---

### Slot 18: SMS_FOLLOWUP
| Property | Value |
|----------|-------|
| **Slot ID** | `SMS_FOLLOWUP` |
| **Type** | Conditional |
| **Position** | 18 (appended after calendar) |
| **Source DB fields** | `sms_enabled`, `agent_mode` (mode-aware SMS instructions) |
| **Current location** | Builder lines 790-793; `prompt-patcher.ts` `getSmsBlock()` |
| **Current patcher** | `patchSmsSection()` — adds/removes when `sms_enabled` toggled |
| **Missing data behavior** | Omit entirely when `sms_enabled=false` |
| **Char budget** | 0-300 chars |

**Content:** Instructions for when to use `sendTextMessage` tool — after completing info collection, as a follow-up with business details. Mode-aware: voicemail modes skip SMS trigger.

---

### Slot 19: VIP_PROTOCOL
| Property | Value |
|----------|-------|
| **Slot ID** | `VIP_PROTOCOL` |
| **Type** | Conditional |
| **Position** | 19 (appended last) |
| **Source DB fields** | `forwarding_number` (presence triggers this slot) |
| **Current location** | Builder lines 796-801; `prompt-patcher.ts` `getVipBlock()` |
| **Current patcher** | `patchVipSection()` — adds when `forwarding_number` set post-provision |
| **Missing data behavior** | Omit entirely when `forwarding_number` is not set |
| **Char budget** | 0-200 chars |

**Content:** VIP caller detection and priority handling protocol. Only relevant when live transfer is available.

---

## Section Order (canonical)

```
 1. SAFETY_PREAMBLE        (~600)   static      always
 2. FORBIDDEN_ACTIONS       (~1200)  static+     always (base + niche/mode/intake extras)
 3. VOICE_NATURALNESS       (~400)   static+     always (+ {{FILLER_STYLE}})
 4. GRAMMAR                 (~400)   static      always
 5. IDENTITY                (~200)   dynamic     always
 6. TONE_AND_STYLE          (~400)   dynamic     always
 7. GOAL                    (~250)   dynamic     always
 8. CONVERSATION_FLOW       (~2000)  dynamic     always (greeting→filter→triage→info→sched→closing)
 9. AFTER_HOURS             (0-300)  conditional if after_hours_behavior != take_message
10. ESCALATION_TRANSFER     (~500)   conditional always (both branches present)
11. RETURNING_CALLER        (~200)   static      always
12. INLINE_EXAMPLES         (~600)   static/     always (generic or niche override)
13. CALL_HANDLING_MODE       (~300)   dynamic     always
14. FAQ_PAIRS               (0-800)  dynamic     always (may be empty placeholder)
15. OBJECTION_HANDLING       (0-500)  conditional if common_objections provided
16. KNOWLEDGE_BASE          (~1000)  dynamic     always (niche FAQ or custom)
17. CALENDAR_BOOKING        (0-600)  conditional if booking_enabled + niche supports
18. SMS_FOLLOWUP            (0-300)  conditional if sms_enabled
19. VIP_PROTOCOL            (0-200)  conditional if forwarding_number set
─────────────────────────────────────────────────────────
TOTAL (minimal):            ~4,550 chars (static + empty dynamics)
TOTAL (typical):            ~6,500 chars (with triage + niche FAQ)
TOTAL (maximal):            ~9,000 chars (all conditionals active)
HARD CEILING:               12,000 chars (validatePrompt limit)
```

---

## Char Budget Analysis

### Static "bread" (slots 1-4, 11): ~1,800 chars
These never change. Safety, forbidden actions base, voice naturalness, grammar, returning caller.

### Dynamic "filling" (slots 5-8, 10, 12-16): ~3,000-5,500 chars
Varies by niche, mode, intake. The CONVERSATION_FLOW slot is the largest variable.

### Conditional appendages (slots 9, 15, 17-19): 0-1,600 chars
Only present when features are enabled. A client with booking + SMS + VIP + objections adds ~1,600 chars.

### GLM-4.6 compliance
- **Optimal target (per Cline research):** 6,000 chars = achievable with static + typical dynamics
- **Hard max:** 8,000 chars = achievable if KNOWLEDGE_BASE is trimmed (D265 removes hardcoded FAQ → saves ~1,000 chars)
- **Current ceiling:** 12,000 chars = only hit with all conditionals + verbose niche FAQ

---

## Variable Registry (all {{VARIABLES}} used in template)

| Variable | Source | Slot(s) used in |
|----------|--------|-----------------|
| `FILLER_STYLE` | voice preset | VOICE_NATURALNESS |
| `AGENT_NAME` | `clients.agent_name` / intake | IDENTITY, GREETING |
| `BUSINESS_NAME` | `clients.business_name` / intake | IDENTITY, GREETING, FILTER |
| `LOCATION_STRING` | derived from city/province | IDENTITY |
| `INDUSTRY` | niche defaults or intake | IDENTITY, FILTER |
| `PERSONALITY_LINE` | voice preset | IDENTITY |
| `TONE_STYLE_BLOCK` | voice preset | TONE_AND_STYLE |
| `GREETING_LINE` | niche wow-greeting or voice preset | CONVERSATION_FLOW (greeting) |
| `CLOSING_LINE` | voice preset | CONVERSATION_FLOW (closing) |
| `COMPLETION_FIELDS` | intake or niche default | GOAL, CLOSING |
| `CLOSE_PERSON` | `owner_name` first name or default | GOAL, FILTER, TRIAGE, CLOSING, many |
| `CLOSE_ACTION` | niche default | GOAL |
| `HOURS_WEEKDAY` | `clients.business_hours_weekday` | FILTER |
| `AFTER_HOURS_INSTRUCTIONS` | derived from after_hours_behavior | FILTER |
| `AFTER_HOURS_BLOCK` | `buildAfterHoursBlock()` | AFTER_HOURS |
| `INSURANCE_STATUS` | niche preset or intake | FILTER |
| `INSURANCE_DETAIL` | niche preset or intake | FILTER |
| `SERVICES_NOT_OFFERED` | intake or empty | FILTER |
| `PRIMARY_CALL_REASON` | niche default | FILTER |
| `TRIAGE_SCRIPT` | replaced by TRIAGE_DEEP post-build | CONVERSATION_FLOW (triage) |
| `FIRST_INFO_QUESTION` | niche default or mode override | CONVERSATION_FLOW (info collection) |
| `INFO_TO_COLLECT` | niche default | CONVERSATION_FLOW (info collection) |
| `INFO_LABEL` | niche default | FILTER |
| `SERVICE_TIMING_PHRASE` | niche default or intake | CONVERSATION_FLOW (scheduling) |
| `MOBILE_POLICY` | intake or niche default | CONVERSATION_FLOW (info collection) |
| `WEEKEND_POLICY` | niche default or intake | CONVERSATION_FLOW (scheduling) |
| `TRANSFER_ENABLED` | derived from forwarding_number + niche | ESCALATION_TRANSFER |
| `URGENCY_KEYWORDS` | niche default or fallback | ESCALATION_TRANSFER |
| `CALL_HANDLING_MODE_INSTRUCTIONS` | MODE_INSTRUCTIONS map | CALL_HANDLING_MODE |
| `FAQ_PAIRS` | niche_faq_pairs + caller_faq | FAQ_PAIRS |
| `SERVICES_OFFERED` | intake or niche default | KNOWLEDGE_BASE |
| `FORBIDDEN_EXTRA` | niche defaults | FORBIDDEN_ACTIONS (injected) |

---

## Post-Build Injection Pipeline

After `buildPrompt()` fills `{{VARIABLES}}`, the builder runs these injections in order:

1. **PRIMARY_GOAL injection** (line 547-551) — Inserts `YOUR PRIMARY GOAL:` line after `# GOAL` heading
2. **TRANSFER_ENABLED cleanup** (lines 553-566) — Fixes "unless false/true is true" nonsense
3. **FORBIDDEN_EXTRA injection** (lines 568-596) — Appends numbered rules after rule 9
4. **FILTER_EXTRA injection** (lines 599-605) — Inserts before "ANYTHING ELSE" filter case
5. **TRIAGE_DEEP replacement** (lines 611-667) — Replaces generic triage with deep version
6. **Booking notes injection** (lines 670-678) — SERVICE NOTES block for appointment_booking + catalog
7. **INFO_FLOW_OVERRIDE** (lines 681-688) — Replaces generic info collection
8. **CLOSING_OVERRIDE** (lines 691-698) — Replaces generic closing
9. **NICHE_EXAMPLES replacement** (lines 703-711) — Replaces inline examples
10. **Second variable fill** (lines 715-718) — Resolves variables in injected content
11. **KNOWLEDGE_BASE replacement** (lines 720-737) — Replaces placeholder with actual FAQ
12. **Pricing policy injection** (lines 741-753) — Appended after KB
13. **Unknown answer instruction** (lines 756-767) — Appended after KB
14. **Objection handling injection** (lines 770-778) — Inserted before KB
15. **Calendar block append** (lines 784-788) — If booking_enabled
16. **SMS block append** (lines 791-793) — If sms_enabled
17. **VIP block append** (lines 798-801) — If forwarding_number
18. **Section marker wrapping** (lines 805-806) — identity + knowledge markers

---

## Migration Strategy (Phase 2 forward)

### Phase 2 (D274): Each slot becomes a function
```typescript
function buildSafetyPreamble(): string        // always returns same text
function buildForbiddenActions(ctx): string    // base + conditional extras
function buildIdentity(ctx): string            // from DB fields
function buildConversationFlow(ctx): string    // the complex one
// ... etc for all 19 slots
```

### Phase 3 (D265, D268, D269, D272): Shrink
- Remove KNOWLEDGE_BASE slot (D265) — pgvector serves this via `queryKnowledge` tool
- Reduce CONVERSATION_FLOW — move business-logic constraints out of hardcoded prompt (D272)
- Make FORBIDDEN_ACTIONS base shorter — only true safety rules hardcoded (D272)

### Phase 6 (D280): UI-driven composition
```typescript
function composePrompt(slots: SlotOutput[]): string {
  return slots.filter(s => s.content).map(s => s.content).join('\n\n')
}
```
Each UI field maps to a slot variable. User edits → slot rebuilds → prompt recomposes.

---

## Discovered Issues During Analysis

1. **OBJECTION_HANDLING is an undocumented 19th slot** — not in the original 18-slot plan. It was injected before KNOWLEDGE_BASE. Consider merging with FAQ_PAIRS.

2. **CONVERSATION_FLOW is too large** — 8 sub-sections with heavy niche/mode coupling. Phase 2 should consider splitting into GREETING, FILTER, TRIAGE, INFO_COLLECTION, SCHEDULING, CLOSING as separate slots.

3. **TRANSFER_ENABLED string cleanup is fragile** — The builder does string replacement on "unless false is true" patterns. Phase 2 should use conditional slot inclusion instead.

4. **Two variable fill passes** — `buildPrompt()` does one pass, then builder does another (line 715-718) for variables introduced by injected content. Phase 2 slot functions should resolve their own variables internally.

5. **KNOWLEDGE_BASE section marker only wraps from heading to end-of-prompt** — If calendar/SMS/VIP are appended after, they're inside the knowledge marker. Phase 2 should fix marker boundaries.
