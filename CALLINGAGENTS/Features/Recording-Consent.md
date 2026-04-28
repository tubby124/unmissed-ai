---
type: feature
status: shipped
shipped: 2026-04-28
tags: [compliance, consent, recording, legal, outbound-gate]
related: [[Tracker/S16a]], [[Architecture/webhook-security-and-idempotency]], [[Features/Outbound-Realtor-ISA-Market-RAG]]
---

# Recording Consent — Universal Acknowledgment

## Why this exists

Every inbound call has `recordingEnabled: true` in Ultravox (verified per [[Architecture/webhook-security-and-idempotency]] §1). Without an explicit operator acknowledgment that they have authority to record callers in their jurisdiction, liability for caller consent in two-party consent regions sits ambiguously between unmissed.ai and the operator.

The fix: a one-time legal acknowledgment captured at onboarding (new clients) or on first dashboard login (4 grandfathered clients). The acknowledgment ALSO unlocks outbound calling features — outbound endpoints fail-closed if `recording_consent_acknowledged_at IS NULL`.

## DB schema

Migration: `supabase/migrations/20260428010953_add_recording_consent.sql`

| Column | Type | Notes |
|--------|------|-------|
| `recording_consent_acknowledged_at` | timestamptz | NULL until operator clicks the box |
| `recording_consent_version` | int (default 1) | Bump if legal text changes — forces re-acknowledgment |

## Flow A — New onboardings

1. Operator reaches `step4-activate.tsx` (the final step before agent provisioning)
2. A required checkbox renders above the Launch button:
   > **I confirm I have authorization to record incoming calls** on behalf of this business and accept responsibility for caller-consent compliance in my jurisdiction.
3. Launch button stays disabled until checked. `OnboardingData.recordingConsentAcknowledged = true` is sent to `/api/provision/trial`.
4. The trial provision route fails fast (HTTP 400) if the field is missing.
5. On success, the route writes `recording_consent_acknowledged_at = now()` AND merges `RECORDING_DISCLOSURE` into `niche_custom_variables` so the agent's greeting includes the spoken disclosure.

## Flow B — Grandfathered clients (4 active live clients)

1. Dashboard layout queries `recording_consent_acknowledged_at` per session
2. If NULL, mounts `RecordingConsentGate` (overlays the dashboard with `RecordingConsentModal`)
3. Modal cannot be dismissed without checking the box AND clicking acknowledge
4. POST `/api/dashboard/recording-consent` writes the timestamp
5. Modal calls `router.refresh()` so the server-rendered layout re-reads the (now non-null) timestamp and unblocks
6. **Important — does NOT auto-set `RECORDING_DISCLOSURE` for these clients.** Their live prompts stay untouched (standing rule: no redeploy to the 4 active clients without explicit confirmation). They can opt-in to the in-call disclosure separately via Settings later.

## Flow C — Outbound gate

`/api/dashboard/leads/dial-out` checks `recording_consent_acknowledged_at IS NOT NULL` BEFORE creating any Ultravox or Twilio calls. Returns 403 with: "Recording authorization is required before placing outbound calls."

This pattern extends to any future outbound campaign API — fail-closed always.

## Voicemail pipeline parity

`src/lib/prompt-niches/voicemail-prompt.ts` reads `niche_custom_variables.RECORDING_DISCLOSURE` and renders it after the OPENING block. Mirrors the slot pipeline. Closed the gap flagged in [[Tracker/S16a]] §"What is NOT done".

## Files

- Migration: `supabase/migrations/20260428010953_add_recording_consent.sql`
- Onboarding checkbox: `src/app/onboard/steps/step4-activate.tsx`
- Trial provision: `src/app/api/provision/trial/route.ts`
- Backfill API: `src/app/api/dashboard/recording-consent/route.ts`
- Backfill modal: `src/components/dashboard/RecordingConsentModal.tsx` + `RecordingConsentGate.tsx`
- Layout mount: `src/app/dashboard/layout.tsx`
- Outbound gate: `src/app/api/dashboard/leads/dial-out/route.ts`
- Voicemail pipeline mirror: `src/lib/prompt-niches/voicemail-prompt.ts`

## Jurisdictional notes

- One-party consent (most of Canada + many US states): the spoken disclosure satisfies notice requirements
- Two-party consent (CA, FL, IL, MD, MA, MT, NH, PA, WA): disclosure ALONE does not substitute for explicit yes/no consent. For those clients, prompt should ASK: "Are you okay with this call being recorded?" and accept/reject explicitly. Out of scope for the current implementation — flag as follow-up if a client serves a two-party state.

## Open follow-ups

- Settings card surfacing the acknowledgment timestamp + downloadable PDF of what they agreed to
- Two-party consent variant of `RECORDING_DISCLOSURE` for clients in CA/FL/etc. (ask, don't just notify)
- Email backstop: if grandfathered client doesn't log in within 7 days, send a one-line email asking them to acknowledge (BLOCKED on domain — GATE-1)
