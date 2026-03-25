# Capability Sync Framework

**Created:** 2026-03-25 | **Phase:** Gate 20 Audit
**Purpose:** Single reference for how each agent capability flows through onboarding, settings, UI, and runtime.

---

## How to Use This Doc

- Adding a new capability toggle → follow the Column Guide section
- Moving a field from onboarding to settings (or vice versa) → check the Field Map table
- Debugging "setting saved but agent didn't change" → check the Sync Path column

---

## Column Guide

| Column | Meaning |
|--------|---------|
| DB field | Column in `clients` table |
| Onboarding writes? | Does `provision/trial/route.ts` write this via `toIntakePayload()`? |
| Settings PATCH triggers sync? | Does this field appear in `needsAgentSync` in `dashboard/settings/route.ts`? |
| Ultravox sync path | How the change reaches the live agent |
| UI truth | Logic in `buildCapabilityFlags()` (`lib/capability-flags.ts`) |
| Agent truth | Logic in `buildAgentTools()` (via `lib/ultravox.ts`) |
| Divergence risk | Known or suspected difference between UI truth and agent truth |

---

## Capability Field Map

### booking_enabled
| Item | Value |
|------|-------|
| DB field | `clients.booking_enabled` |
| Onboarding writes? | YES — via `callHandlingMode` → `activateClient()` |
| Settings PATCH triggers sync? | YES — `'booking_enabled' in updates` → `needsAgentSync` |
| Ultravox sync path | Settings PATCH → `updateAgent()` inline → live agent PATCH |
| Plan gate | `getPlanEntitlements().bookingEnabled` (Pro only) |
| UI truth | `booking_enabled && calendar_auth_status === 'connected'` |
| Agent truth | `booking_enabled` (no calendar connection check at tool-registration time) |
| Divergence risk | **INTENTIONAL**: UI shows whether it will *work* (calendar connected). Agent registers the tool regardless — the tool itself fails gracefully if calendar unconnected. |
| Prompt auto-patch | YES — `patchCalendarBlock()` adds/removes CALENDAR BOOKING FLOW block |

### sms_enabled
| Item | Value |
|------|-------|
| DB field | `clients.sms_enabled` |
| Onboarding writes? | YES — entitlement-gated in `provision/trial` |
| Settings PATCH triggers sync? | YES — `'sms_enabled' in updates` → `needsAgentSync` |
| Ultravox sync path | Settings PATCH → `updateAgent()` inline |
| Missing from agentFlags | `twilio_number` — NOT fetched or passed when building agentFlags in settings PATCH |
| UI truth | `sms_enabled && twilio_number` (both required) |
| Agent truth | `sms_enabled` only — `twilio_number` passed separately via `syncClientTools()` but NOT via inline settings PATCH path |
| Divergence risk | **GAP**: When `sms_enabled=true` and settings PATCH syncs, `buildAgentTools(agentFlags)` doesn't know the Twilio number. If `buildAgentTools` uses `twilio_number` as a guard, the tool may be incorrectly included/excluded vs UI badge. |

### forwarding_number (transfer)
| Item | Value |
|------|-------|
| DB field | `clients.forwarding_number` |
| Onboarding writes? | YES — for Pro plan users |
| Settings PATCH triggers sync? | YES — `'forwarding_number' in updates` → `needsAgentSync` |
| Ultravox sync path | Settings PATCH → `updateAgent()` inline |
| UI truth | `!!forwarding_number` |
| Agent truth | `forwarding_number` as tool parameter |
| Divergence risk | NONE apparent |

### knowledge_backend
| Item | Value |
|------|-------|
| DB field | `clients.knowledge_backend` (`'pgvector'` or `null`) |
| Onboarding writes? | Set during activation by admin |
| Settings PATCH triggers sync? | YES — `'knowledge_backend' in updates` → `needsAgentSync` |
| Ultravox sync path | Settings PATCH → `updateAgent()` inline + chunk count check |
| Admin only | YES — `cu.role === 'admin'` gate in settings PATCH |
| UI truth | `knowledge_backend === 'pgvector'` |
| Agent truth | `knowledge_backend === 'pgvector' && knowledge_chunk_count > 0` |
| Divergence risk | **INTENTIONAL**: UI shows backend is enabled; agent only registers tool if chunks exist (avoids empty knowledge queries). |

### twilio_number
| Item | Value |
|------|-------|
| DB field | `clients.twilio_number` |
| Onboarding writes? | NO — provisioned by `ensureTwilioProvisioned()` after checkout or upgrade |
| Settings PATCH triggers sync? | YES — added to `needsAgentSync` 2026-03-25 |
| Ultravox sync path | Settings PATCH → `updateAgent()` inline (twilio_number now in agentFlags) |
| Admin only | YES — God Mode field |
| Agent truth | `buildAgentTools` requires `sms_enabled && twilio_number` — both now passed correctly |
| Divergence risk | NONE — closed 2026-03-25 |

### agent_voice_id
| Item | Value |
|------|-------|
| DB field | `clients.agent_voice_id` |
| Onboarding writes? | YES — voice picker in step 1 |
| Settings PATCH triggers sync? | YES — `'agent_voice_id' in updates` → `needsAgentSync` |
| Ultravox sync path | Settings PATCH → `updateAgent({ voice: voiceToSync })` |
| Divergence risk | NONE — direct pass-through |

---

## Activation Route Map

| Route | Activation method | Writes onboarding fields? | Syncs tools? |
|-------|------------------|--------------------------|--------------|
| `POST /api/provision/trial` | `activateClient()` | YES — full `OnboardingData` via `toIntakePayload()` | YES — via `activateClient()` → `syncClientTools()` |
| `POST /api/webhook/stripe` (new paid, no trial) | `activateClient()` | YES — reads from `intake_submissions` intake_json | YES — via `activateClient()` → `syncClientTools()` |
| `POST /api/webhook/stripe` (upgrade from trial) | Direct DB write + `syncClientTools()` | NO — fields already written during trial | YES — `syncClientTools()` called explicitly |
| `POST /api/provision` | None — intake queue only | NO — creates `intake_submissions` row, admin reviews | NO |
| `PATCH /api/dashboard/settings` | Not an activation route | NO | YES (inline via `updateAgent()`) for fields in `needsAgentSync` |

---

## Adding a New Capability

When you add a new capability (e.g., `email_enabled`), touch these files in order:

1. **DB** — add column to `clients` table via migration
2. **Types** — add to `ClientCapabilityInput` in `lib/capability-flags.ts`
3. **UI truth** — add flag to `buildCapabilityFlags()` return value
4. **Agent truth** — add to `buildAgentTools()` in `lib/ultravox.ts`
5. **Onboarding** — add to `toIntakePayload()` in `lib/intake-transform.ts` if collected during onboarding
6. **Settings PATCH** — add to the `updates` accumulator block AND to `needsAgentSync` check AND to the `select()` in the `needsAgentSync` block
7. **Plan entitlements** — add to `getPlanEntitlements()` in `lib/plan-entitlements.ts` if plan-gated
8. **Stripe webhook upgrade** — confirm `syncClientTools()` call covers it (it reads fresh DB, so it will if you added to `buildAgentTools()`)

---

## Moving a Field: Onboarding → Settings (or vice versa)

If you move a field that's currently written during onboarding to be settings-only:

1. Remove from `toIntakePayload()` in `lib/intake-transform.ts`
2. Ensure it's in the `updates` accumulator in `dashboard/settings/route.ts`
3. Ensure it's in `needsAgentSync` if it affects agent behavior
4. Update `OnboardingData` type if it's no longer an onboarding field
5. Verify the field has a sensible default in the DB so existing clients aren't broken

---

## Known Architectural Risks (Sonar Pro confirmed 2026-03-25)

1. **Separate builders** — `buildCapabilityFlags()` (UI) and `buildAgentTools()` (agent) are separate code paths. If they apply different logic to the same DB field, you get "fake-control" bugs. Sonar recommendation: extract a single `buildTools()` that both call. Currently NOT done — mitigation is to audit both functions when adding any capability.

2. **twilio_number gap** — CLOSED 2026-03-25. Added to `needsAgentSync`, select, and `agentFlags` in settings PATCH. `buildAgentTools` now receives both `sms_enabled` and `twilio_number` on every sync path.

3. **In-memory rate limiter** — `rateLimitMap` in `provision/trial/route.ts` is per-Railway-instance, not global. High traffic could bypass limits across replicas. Fix: move to Supabase-backed counter. Low priority.

---

## Key Files

| File | Role |
|------|------|
| `src/lib/capability-flags.ts` | UI truth — what badges show on dashboard |
| `src/lib/sync-client-tools.ts` | DB tools sync — lightweight, no Ultravox API call |
| `src/lib/ultravox.ts` | `buildAgentTools()` + `updateAgent()` — Ultravox sync |
| `src/lib/activate-client.ts` | Shared activation chain — called by trial + Stripe |
| `src/lib/plan-entitlements.ts` | Plan capability gates |
| `src/lib/intake-transform.ts` | Onboarding → DB field mapping |
| `src/app/api/provision/trial/route.ts` | Trial activation |
| `src/app/api/provision/route.ts` | Intake queue (NOT activation) |
| `src/app/api/dashboard/settings/route.ts` | Settings PATCH — inline Ultravox sync |
| `src/app/api/webhook/stripe/route.ts` | Stripe events — upgrade + new activation |
