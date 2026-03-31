---
type: research
status: done
tags: [phase2, ui, ownership-model, audit]
created: 2026-03-31
---

# UI Alignment Audit — Phase 2

> Maps every dashboard settings card and onboarding step to sandwich-spec slots.
> Documents gaps where the UI doesn't match the bread/filling ownership model.

## Ownership Model Reference
```
BREAD (us, non-negotiable): Safety + Forbidden + Voice + Grammar + Returning Caller
FILLING (them, their data): Identity + Tone + Goal + Flow + Triage + FAQ + Knowledge + Features
```

---

## Settings Cards → Slot Mapping

| Settings Card | Slot(s) Affected | Ownership | Gap? |
|---|---|---|---|
| AgentIdentityHeader | IDENTITY (5) | FILLING | OK — edits agent_name, business_name |
| VoiceStyleCard | TONE_AND_STYLE (6), VOICE_NATURALNESS (3), IDENTITY personality | BREAD + FILLING | GAP: preset changes TONE (filling) but also FILLER_STYLE (bread) — user shouldn't control bread |
| VoicePicker / AgentCurrentVoiceCard | agent_voice_id (not in prompt) | N/A | OK — voice is separate from prompt |
| CallHandlingModeCard | CALL_HANDLING_MODE (13), GOAL (7), CONVERSATION_FLOW (8) | FILLING | GAP: mode change affects 3 slots but user sees only 1 dropdown |
| AgentModeCard | Same as above | FILLING | Same gap as CallHandlingModeCard |
| HoursCard | PER_CALL_CONTEXT (not in prompt) | N/A | OK — hours are runtime injected |
| BookingCard | CALENDAR_BOOKING (17), CONVERSATION_FLOW booking trigger | FILLING | OK — toggle adds/removes slot |
| SmsTab | SMS_FOLLOWUP (18) | FILLING | OK — toggle adds/removes slot |
| CallRoutingCard | ESCALATION_TRANSFER (10) | FILLING | GAP: transfer_conditions edits tool description, NOT prompt slot |
| VoicemailGreetingCard | N/A (separate voicemail TwiML) | N/A | OK — not in prompt |
| IvrMenuCard | N/A (Twilio Gather, not in prompt) | N/A | OK |
| ContextDataCard | PER_CALL_CONTEXT (not in prompt) | N/A | OK |
| QuickInject | PER_CALL_CONTEXT (injected_note) | N/A | OK |
| WebsiteKnowledgeCard | KNOWLEDGE_BASE (16) via pgvector | FILLING | OK — triggers knowledge pipeline |
| AgentKnowledgeCard | KNOWLEDGE_BASE (16) via extra_qa | FILLING | OK |
| KnowledgeEngineCard | KNOWLEDGE_BASE (16) | FILLING | OK |
| ServicesOfferedCard | KNOWLEDGE_BASE (16) services line | FILLING | GAP: edits only KB, doesn't patch IDENTITY industry |
| ServiceCatalogCard | CONVERSATION_FLOW (8) triage + CALENDAR_BOOKING (17) | FILLING | OK |
| SectionEditorCard | Any slot (identity, knowledge, after_hours) | FILLING | OK — marker-based editing |
| PromptEditorCard / PromptEditorModal | ALL SLOTS (raw prompt) | BOTH | GAP: raw editor lets owners edit BREAD — violates ownership model |
| StaffRosterCard | N/A (not in prompt yet) | N/A | GAP: D260 — staff/services don't flow to agent |
| VIPContactsCard | VIP_PROTOCOL (19) | FILLING | OK |
| AdvancedContextCard | PER_CALL_CONTEXT | N/A | OK |
| TestCallCard | N/A (triggers test) | N/A | OK |
| GodModeCard | Various admin fields | ADMIN | OK |

## Onboarding Steps → Slot Mapping

| Onboarding Step | Fields Collected | Slot(s) Fed | Gap? |
|---|---|---|---|
| Step 1: Business Basics | business_name, city, province, niche | IDENTITY (5) | OK |
| Step 2: Mode / Goal | call_handling_mode | GOAL (7), CALL_HANDLING_MODE (13), CONVERSATION_FLOW (8) | OK |
| Step 3: Agent Identity | agent_name, voice_style_preset | IDENTITY (5), TONE_AND_STYLE (6) | OK |
| Step 4: Knowledge (REMOVED) | — | — | GAP: knowledge onboarding removed, clients start with zero knowledge |
| Step 5: Capabilities | booking_enabled, sms_enabled, forwarding_number | CALENDAR (17), SMS (18), VIP (19), ESCALATION (10) | OK |
| Step 6: Review + Activate | — | — | OK |
| Step 7: Stripe Checkout | — | — | OK |

## Top Gaps (Phase 5 + 6 input)

### GAP 1 — Raw prompt editor violates ownership model (CRITICAL)
**What:** PromptEditorCard and PromptEditorModal let owners edit the raw system_prompt, including BREAD sections (safety, forbidden, voice naturalness, grammar). The ownership model says bread is non-negotiable.
**Fix (Phase 6):** Replace raw editor with per-slot inline editors. Owners can edit FILLING slots only. BREAD slots are read-only with a "managed by unmissed" badge.
**Slot mapping:** D280 (UI-driven composition), D283 (variable visibility)

### GAP 2 — Mode change affects 3 slots but shows 1 dropdown
**What:** Changing `call_handling_mode` silently rewrites GOAL, CALL_HANDLING_MODE instructions, and CONVERSATION_FLOW (triage, info collection, closing). The user sees one dropdown and has no visibility into what changed.
**Fix (Phase 5):** Show a "what this changes" preview when switching modes. Surface affected slots as expandable sections.
**Slot mapping:** D283, D278 (Agent Brain)

### GAP 3 — Voice preset changes both bread and filling
**What:** VoiceStyleCard changes TONE_AND_STYLE (filling — user's choice) AND FILLER_STYLE in VOICE_NATURALNESS (bread — should be us-controlled). The personality line in IDENTITY also changes.
**Fix (Phase 5):** Split the preset into: (a) TONE preset (user picks), (b) naturalness settings (us-controlled, not exposed). D275 partially fixed this for personality.
**Slot mapping:** D283

### GAP 4 — No UI for FORBIDDEN_EXTRA rules
**What:** Niche-specific forbidden rules (dental waitlist, restaurant no-delivery, legal referral-only) are set at onboarding and never editable afterward. No settings card surfaces them.
**Fix (Phase 5):** Add a "Business Rules" card showing active FORBIDDEN_EXTRA rules with edit capability.
**Slot mapping:** D283

### GAP 5 — Knowledge onboarding removed (Step 4 gone)
**What:** New clients onboard with NO knowledge. Step 4 was removed. FAQ pairs and caller_faq only get populated if the owner manually adds them later.
**Fix:** Re-enable Step 4 or add a prominent "Add Knowledge" nudge on the dashboard.
**Tracker:** Already tracked as `project_knowledge_onboarding_gap.md`

### GAP 6 — Services don't flow to agent runtime (D260)
**What:** `client_services` table has structured service data, but edits there don't update the prompt or tools. StaffRosterCard is disconnected.
**Fix (Phase 4):** D260 — wire service catalog edits to prompt regeneration.

### GAP 7 — Owner name not editable post-onboarding (D281)
**What:** `owner_name` is set at onboarding → becomes CLOSE_PERSON. No settings card to change it.
**Fix (Phase 4):** D281 — add owner name field to settings.

### GAP 8 — Business name change doesn't patch prompt (D282)
**What:** `business_name` is DB_ONLY after provision. Editing it in settings doesn't update the prompt.
**Fix (Phase 4):** D282 — add patchBusinessName() to settings PATCH handler.
