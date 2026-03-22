# Settings Card Extraction Tracker

> Created: 2026-03-22
> Parent tracker: `docs/settings-card-tracker.md` (bugs SET-1 to SET-6)
> Main refactor tracker: `.claude/rules/refactor-phase-tracker.md` (D14 item)
> Architecture ref: `memory/settings-card-architecture.md`

---

## Goal

Extract every inline section from AgentTab.tsx (~1,774 lines) into self-contained card components. Each card owns its fields, save logic, sync behavior, and visibility rules. AgentTab becomes a layout shell that passes `client` + `isAdmin` + `previewMode` to children.

---

## Data Flow Overview

```
Onboarding Intake
  -> POST /api/onboard -> Supabase `clients` row (agent_name, business_name, niche, city, etc.)
  -> prompt-builder.ts generates system_prompt from template + intake
  -> updateAgent() pushes prompt + tools to Ultravox

Settings Page Load
  -> GET /api/dashboard/settings -> SELECT * FROM clients WHERE id = ...
  -> All fields hydrated into AgentTab props
  -> Each card gets initialX props from this single fetch

Any Card Save
  -> PATCH /api/dashboard/settings (single endpoint, per-field logic)
  -> Supabase update -> optional Ultravox sync -> optional prompt version insert

Sync Triggers (settings/route.ts lines 293-300):
  system_prompt, forwarding_number, transfer_conditions, booking_enabled,
  agent_voice_id, knowledge_backend, sms_enabled
  (voice_style_preset patches system_prompt indirectly -> triggers sync)
```

---

## Component Map

### Already Extracted (13 components)

| # | Component | File | Fields Saved | Sync Path | Visibility | Save Hook |
|---|-----------|------|-------------|-----------|------------|-----------|
| 1 | AgentOverviewCard | `AgentOverviewCard.tsx` | `agent_name`, `status`, `injected_note` | agent_name: DB-only (baked into prompt on regen). injected_note: call-time inject via `callerContextBlock` | Both | `usePatchSettings` |
| 2 | VoiceStyleCard | `VoiceStyleCard.tsx` | `voice_style_preset` | YES — patches `system_prompt` via `patchVoiceStyleSection()` -> Ultravox sync | Both | `usePatchSettings` |
| 3 | HoursCard | `HoursCard.tsx` | `business_hours_weekday`, `business_hours_weekend`, `after_hours_behavior`, `after_hours_emergency_phone` | DB-only, call-time inject via `detectAfterHours()` + `afterHoursBehaviorNote` | Both | `usePatchSettings` |
| 4 | VoicemailGreetingCard | `VoicemailGreetingCard.tsx` | `voicemail_greeting_text` | DB-only, read by `buildVoicemailTwiml()` at voicemail time | Both | `usePatchSettings` |
| 5 | AdvancedContextCard | `AdvancedContextCard.tsx` | `business_facts`, `extra_qa`, `context_data`, `context_data_label` | DB-only, call-time inject via `buildAgentContext()` blocks | Both | `usePatchSettings` |
| 6 | SectionEditorCard | `SectionEditorCard.tsx` | `system_prompt` (via marker-based section replace) | YES — prompt changed -> Ultravox sync | Admin only | Custom (section_id body) |
| 7 | CapabilitiesCard | `CapabilitiesCard.tsx` | read-only | N/A | Client only | N/A |
| 8 | RuntimeCard | `RuntimeCard.tsx` | read-only (404 — SET-5) | N/A | Both | N/A |
| 9 | KnowledgeEngineCard | `KnowledgeEngineCard.tsx` | `knowledge_backend` | YES — tools updated | Both | Custom |
| 10 | WebhooksCard | `WebhooksCard.tsx` | read-only (inbound/completed URLs, Twilio #) | N/A | Admin only | N/A |
| 11 | AgentConfigCard | `AgentConfigCard.tsx` | read-only + `syncAgent()` button | YES (force sync) | Admin only | Custom (sync-agent endpoint) |
| 12 | BookingCard | `BookingCard.tsx` | `booking_service_duration_minutes`, `booking_buffer_minutes` + Google Calendar OAuth link | DB-only (booking_enabled via calendar connect) | Both | `usePatchSettings` |
| 13 | TestCallCard | `TestCallCard.tsx` | fires POST `/api/dashboard/test-call` | N/A (creates call, doesn't save settings) | Both | Custom (test-call endpoint) |

### Still Inline — Need Extraction (6 sections)

| # | Proposed Component | AgentTab Lines | Fields Saved | Sync Path | Visibility | Complexity |
|---|-------------------|---------------|-------------|-----------|------------|------------|
| 14 | **SetupCard** | ~460-600 | `forwarding_number`, `transfer_conditions`, `setup_complete` | YES — forwarding_number + transfer_conditions trigger Ultravox tools | Client only | MEDIUM |
| 15 | **GodModeCard** | ~760-870 | `telegram_bot_token`, `telegram_chat_id`, `twilio_number`, `timezone`, `monthly_minute_limit` + test telegram | DB-only | Admin only | MEDIUM |
| 16 | **PromptEditorCard** | ~880-1120 | `system_prompt` (direct textarea edit) | YES — prompt changed -> Ultravox sync + version | Admin=editor, Client=behavior summary | HIGH |
| 17 | **LearningLoopCard** | ~1220-1290 | read-only (auto-analysis from call patterns) | N/A | Both | LOW |
| 18 | **AIImproveCard** | ~1290-1370 | applies improved prompt to editor state | N/A (writes to parent prompt state) | Admin only | MEDIUM |
| 19 | **PromptHistoryCard** | ~1370-1461 | restore version -> updates `system_prompt` | YES — restored prompt -> Ultravox sync | Admin only | MEDIUM |

---

## Shared State Dependencies

Some inline sections share state with the prompt editor. This affects extraction order:

```
PromptEditorCard (15) owns: prompt text, charCount, dirty, save/regen
  <- AIImproveCard (18) writes: applies improved prompt to editor state
  <- PromptHistoryCard (19) writes: restores version to editor state
  <- SET-3 bug: charCount stale after VoiceStyleCard/SectionEditorCard saves
```

**Strategy:** Extract 15 + 18 + 19 together as a `PromptSection` group that shares a prompt context, OR keep them in AgentTab and extract everything else first.

Everything else (10-14, 16-17) is fully independent — zero shared state.

---

## Extraction Order (recommended)

### Wave 1 — Independent, Zero Risk
| Priority | Component | Why first |
|----------|-----------|-----------|
| 1 | **BookingCard** (14) | D14 already tracked. Clean boundaries, `usePatchSettings` pattern. |
| 2 | **TestCallCard** (16) | Self-contained, no shared state, own API endpoint. |
| 3 | **WebhooksCard** (11) | Read-only, trivial. Admin only. |
| 4 | **AgentConfigCard** (12) | Read-only + sync button. Admin only. Small. |

### Wave 2 — Independent, Own Save Logic
| Priority | Component | Notes |
|----------|-----------|-------|
| 5 | **SetupCard** (10) | Client-facing, critical for onboarding flow. Has own `saveSetup()`. Needs `usePatchSettings` conversion. |
| 6 | **GodModeCard** (13) | Admin-only. Has own `saveGodConfig()` + `testTelegram()`. Two save patterns. |
| 7 | **LearningLoopCard** (17) | Read-only display + "Apply Suggestions" button (calls `generateImprovement`). |

### Wave 3 — Prompt-Coupled (extract together)
| Priority | Component | Notes |
|----------|-----------|-------|
| 8 | **PromptEditorCard** (15) | The big one. Admin=textarea+regen+save. Client=behavior summary. Shares `prompt` state. |
| 9 | **AIImproveCard** (18) | Depends on prompt state. Writes to parent. |
| 10 | **PromptHistoryCard** (19) | Depends on prompt state. Restores to parent. |

---

## Per-Field Reference: What Updates What

This is the full map of every settings field, where it's saved, where it takes effect, and which component owns it.

### Ultravox-Synced Fields (changes affect NEXT call via agent update)

| Field | Component | DB Column | What Happens on Save |
|-------|-----------|-----------|---------------------|
| `voice_style_preset` | VoiceStyleCard | `voice_style_preset` | `patchVoiceStyleSection()` rewrites TONE section in `system_prompt` -> Ultravox PATCH |
| `system_prompt` (direct) | PromptEditorCard | `system_prompt` | Direct save -> Ultravox PATCH + `insertPromptVersion()` |
| `system_prompt` (section) | SectionEditorCard | `system_prompt` | `replacePromptSection()` modifies prompt -> Ultravox PATCH + version |
| `forwarding_number` | SetupCard | `forwarding_number` | Ultravox tools updated (transferCall added/removed) |
| `transfer_conditions` | SetupCard | `transfer_conditions` | Ultravox tools updated |
| `booking_enabled` | BookingCard (implicit via calendar connect) | `booking_enabled` | Ultravox tools updated (bookAppointment added/removed) + calendar block patched into prompt |
| `agent_voice_id` | AgentConfigCard (link to /voices) | `agent_voice_id` | Ultravox PATCH (voice change) |
| `knowledge_backend` | KnowledgeEngineCard | `knowledge_backend` | Ultravox tools updated (queryKnowledge added/removed) |
| `sms_enabled` | (SmsTab, separate) | `sms_enabled` | Ultravox tools updated (sendSms added/removed) |

### Call-Time Inject Fields (changes affect NEXT call via `buildAgentContext()`)

| Field | Component | DB Column | Injected As |
|-------|-----------|-----------|------------|
| `injected_note` | AgentOverviewCard (QuickInject) | `injected_note` | `callerContextBlock` — appended to call context |
| `business_hours_weekday` | HoursCard | `business_hours_weekday` | `detectAfterHours()` -> `afterHoursBehaviorNote` |
| `business_hours_weekend` | HoursCard | `business_hours_weekend` | Same |
| `after_hours_behavior` | HoursCard | `after_hours_behavior` | `afterHoursBehaviorNote` text selection |
| `after_hours_emergency_phone` | HoursCard | `after_hours_emergency_phone` | Included in after-hours note if set |
| `business_facts` | AdvancedContextCard | `business_facts` | `businessFactsBlock` via `buildAgentContext()` |
| `extra_qa` | AdvancedContextCard | `extra_qa` | `extraQaBlock` (formatted as `"Q" -> "A"`) |
| `context_data` | AdvancedContextCard | `context_data` | `contextDataBlock` |
| `context_data_label` | AdvancedContextCard | `context_data_label` | Header for `contextDataBlock` |

### DB-Only Fields (used at specific trigger times, not on every call)

| Field | Component | When Used |
|-------|-----------|-----------|
| `voicemail_greeting_text` | VoicemailGreetingCard | `buildVoicemailTwiml()` when Ultravox unavailable |
| `agent_name` | AgentOverviewCard | Baked into prompt on regen. Displayed in client behavior summary. |
| `setup_complete` | SetupCard | Controls setup banner visibility |
| `booking_service_duration_minutes` | BookingCard | Passed to calendar API at booking time |
| `booking_buffer_minutes` | BookingCard | Passed to calendar API at booking time |
| `telegram_bot_token` | GodModeCard | Used by notification system to send Telegram messages |
| `telegram_chat_id` | GodModeCard | Target chat for Telegram notifications |
| `timezone` | GodModeCard | Used by `detectAfterHours()` and notification timestamps |
| `monthly_minute_limit` | GodModeCard | Checked by budget limiter on inbound calls |

### Read-Only (no save)

| What | Component | Source |
|------|-----------|--------|
| Webhook URLs | WebhooksCard | Computed from `appUrl` + `client.slug` |
| AI model | AgentConfigCard | Hardcoded "Ultravox v0.7" |
| Client ID | AgentConfigCard | `client.id` |
| Capabilities list | CapabilitiesCard | Derived from client feature flags |
| Runtime config | RuntimeCard | `/api/dashboard/runtime` (404 — SET-5) |
| Prompt versions | PromptHistoryCard | `/api/dashboard/settings/prompt-versions` |
| Learning analysis | LearningLoopCard | `/api/dashboard/settings/learning-status` |

---

## Onboarding -> Settings Data Flow

How intake answers become settings card initial values:

```
Intake Form Field          -> DB Column              -> Settings Card
─────────────────────────────────────────────────────────────────────
Business name              -> business_name           -> AgentOverviewCard (display)
Agent name                 -> agent_name              -> AgentOverviewCard (editable)
City                       -> city                    -> AgentOverviewCard (display)
Niche                      -> niche                   -> AgentOverviewCard (badge)
Phone (forwarding)         -> forwarding_number       -> SetupCard
Business hours             -> business_hours_weekday  -> HoursCard
                           -> business_hours_weekend  -> HoursCard
After-hours behavior       -> after_hours_behavior    -> HoursCard
Business description       -> business_facts          -> AdvancedContextCard
FAQ pairs                  -> extra_qa                -> AdvancedContextCard
Voice selection            -> agent_voice_id          -> AgentConfigCard
Twilio number (assigned)   -> twilio_number           -> SetupCard, WebhooksCard, GodModeCard
Telegram (admin setup)     -> telegram_bot_token      -> GodModeCard
                           -> telegram_chat_id        -> GodModeCard
Timezone (admin setup)     -> timezone                -> GodModeCard
```

The `system_prompt` is generated from ALL intake fields via `prompt-builder.ts`, not stored field-by-field. Changing individual fields (agent_name, business_facts) does NOT auto-update the prompt — that requires regen or manual edit.

---

## Onboarding Reuse (cross-reference)

> Tracker: `docs/s12-phase3c-tracker.md` — Trial Onboarding Experience

Trial onboarding edits the **same DB fields** as settings. Extracted cards should support both contexts:

- **Onboarding mode:** Simplified view (fewer fields, guided copy, "next step" flow)
- **Settings mode:** Full view (all fields, admin features, direct save)

Cards that map to onboarding steps: `AdvancedContextCard`, `KnowledgeEngineCard`, `HoursCard`, `VoiceStyleCard`, `SetupCard` (pending extraction). The `usePatchSettings` hook is the shared save mechanism for both contexts.

`AgentTestCard` (voice orb) is a **permanent dashboard feature** — all users can talk to their agent, not just during onboarding.

---

## Bugs (cross-reference)

Active bugs are tracked in `docs/settings-card-tracker.md`. Quick status:

| Bug | Severity | Affects | Status |
|-----|----------|---------|--------|
| SET-1 | MEDIUM-HIGH | Call quality on preset switch | NOT STARTED |
| SET-2 | LOW-MEDIUM | UX (no active preset shown) | NOT STARTED |
| SET-3 | LOW | Stale char count | NOT STARTED |
| SET-4 | LOW-MEDIUM | Duplicate prompt sections | NOT STARTED |
| SET-5 | LOW | Runtime card 404 | NOT STARTED |
| SET-6 | LOW | Hydration mismatch | NOT STARTED |
| D14 | LOW | BookingCard inline | **DONE** 2026-03-22 — extracted to BookingCard.tsx |
| D15 | MEDIUM | validatePrompt skipped | **DONE** 2026-03-22 — voice style + calendar patches now run `validatePrompt()` before saving |
| D16 | **MEDIUM-HIGH** | `usePatchSettings` swallows errors — now affects 5 cards (Hours, VoiceStyle, Voicemail, AdvancedContext, BookingCard). Add `error` state to hook. | **DONE** 2026-03-22 — hook returns `error` + `clearError`, all 6 cards display errors. AgentOverviewCard also has `footerError` state. |
| D21 | LOW | `saveUltravoxWarning` clearing lost — AgentConfigCard sync success no longer clears parent "Ultravox sync failed" banner. Pass `onSyncSuccess` callback or lift warning to context. | NOT STARTED |
| D22 | LOW | Dead parent props — `bookingDuration`/`setBookingDuration`/`bookingBuffer`/`setBookingBuffer` still in AgentTabProps after BookingCard extraction. Clean up after all waves. | DEFERRED (post-Wave 3) |
| D23 | INFO | Booking default mismatch (display 60/save 30, buffer display 15/save 0) — **FIXED** by Wave 1 extraction. BookingCard now uses consistent local state. | **FIXED** 2026-03-22 |
| D24 | LOW | `fmtDate` import in AgentTab only used by prompt version section. Dead after Wave 3 PromptHistoryCard extraction. | DEFERRED (Wave 3) |

---

## Progress

| Wave | Components | Status |
|------|-----------|--------|
| Wave 1 | BookingCard, TestCallCard, WebhooksCard, AgentConfigCard | **DONE** 2026-03-22 — all 4 extracted, tsc clean, AgentTab 1774→1461 lines |
| Unification | All 7 cards + AgentOverviewCard: `mode`/`onSave`/`error` | **DONE** 2026-03-22 — `usePatchSettings` hook upgraded, `CardMode` type, error display on all cards, mode-aware copy/visibility. D15 (validation) + D16 (error surfacing) fixed. |
| Wave 2 | SetupCard, GodModeCard, LearningLoopCard | NOT STARTED |
| Wave 3 | PromptEditorCard, AIImproveCard, PromptHistoryCard | NOT STARTED |

### Extraction Checklist Template
For each component:
- [ ] Create `src/components/dashboard/settings/[Name].tsx`
- [ ] Move JSX from AgentTab inline section
- [ ] Move related state + save function
- [ ] Use `usePatchSettings` or document why custom save needed
- [ ] Remove inline code from AgentTab
- [ ] Verify save + reload still works
- [ ] Update this tracker

---

## How to Resume

1. Read this file for the full component map and extraction order
2. Check which wave is in progress
3. For bug context, read `docs/settings-card-tracker.md`
4. For architecture details, read `memory/settings-card-architecture.md`
5. For main refactor context, read `.claude/rules/refactor-phase-tracker.md`
