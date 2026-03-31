---
type: architecture
status: active
tags: [architecture, webhooks, twilio, ultravox, flow]
related: [Architecture/Control Plane Mutation, Architecture/Per-Call Context, Architecture/Call Path Matrix]
updated: 2026-03-31
---

# Webhook Chain — Inbound to Post-Call

## Full Chain: One Inbound Call

```
1. CALLER DIALS
   Twilio PSTN → POST /api/webhook/{slug}/inbound
   Auth: X-Twilio-Signature HMAC
   
2. INBOUND ROUTE
   → validateSignature() — 403 if invalid
   → rate limit check (30 calls/slug/60s)
   → minute enforcement check → voicemail if over limit
   → IVR gate: if ivr_enabled → return <Gather> TwiML (caller presses digit)
     → POST /api/webhook/{slug}/ivr-gather → digit 1=voicemail, else=agent
   → buildAgentContext() → callerContextBlock + businessFacts + contextData
   → callViaAgent() [Agents API] OR createCall() [fallback]
   → fire-and-forget: INSERT call_logs (call_status='live')
   → return <Connect><Stream> TwiML → Twilio bridges call to Ultravox

3. LIVE CALL
   Twilio WebSocket ↔ Ultravox ↔ Agent (system_prompt + tools)
   Tool calls → /api/webhook/{slug}/{transfer,sms,booking,knowledge}
   Auth: x-tool-secret static shared secret

4. TRANSFER (if triggered)
   Tool: transferCall → POST /api/webhook/{slug}/transfer
   → Twilio redirectCall() → <Dial> to forwarding_number
   → If dial fails → POST /api/webhook/{slug}/transfer-status
     → Recovery: creates new Ultravox call, reconnects caller to AI

5. CALL ENDS
   Ultravox fires: POST /api/webhook/{slug}/completed
   Auth: HMAC-SHA256 over slug:nonce:ts, 30-min replay window
   
   In after():
   → CAS update: call_status live→processing (atomic, prevents double-process)
   → AI classification: BOOKING/INFO/TRANSFER/CALLBACK/COMPLAINT/JUNK
   → lead_status: HOT/WARM/COLD/JUNK
   → Update call_logs (duration, summary, classification, lead_status)
   → Telegram alert (if not already sent via notification_logs guard)
   → billing: seconds_used_this_month incremented

6. BILLING EVENT (separate)
   Ultravox native webhook → POST /api/webhook/ultravox
   Auth: HMAC-SHA256, X-Ultravox-Webhook-Signature
   Event: call.billed → update call_logs.billed_duration_seconds

7. VOICEMAIL PATH (if Ultravox creation fails OR IVR digit 1)
   → buildVoicemailTwiml() → <Record> TwiML
   → Recording ready → POST /api/webhook/{slug}/voicemail
     Auth: X-Twilio-Signature
     → download from Twilio → upload to Supabase Storage (private)
     → update call_logs.recording_url (path only, not URL)
     → Telegram alert to client
```

## Idempotency Guards

| Route | Guard |
|-------|-------|
| `/completed` | `live→processing` CAS state transition |
| `/stripe` | `stripe_events` table upsert on event_id |
| `/sms-inbound` | `sms_logs.message_sid` dedup |
| `/voicemail` | P2 gap: no RecordingSid guard (duplicate Telegram risk) |
| `/fallback` | None — P1 gap: no signature validation |

## Auth Summary

| Webhook | Method |
|---------|--------|
| Twilio routes | `X-Twilio-Signature` HMAC |
| `/completed` | Custom HMAC-SHA256 over `slug:nonce:ts` |
| `/api/webhook/ultravox` | `X-Ultravox-Webhook-Signature` |
| `/stripe` | Stripe SDK `constructEvent` |
| Tool routes (`/transfer`, `/sms`) | `x-tool-secret` static secret |
| `/telegram` | UUID token in body |
| `/fallback` | NONE (P1 gap) |

## Key Files

- `src/app/api/webhook/[slug]/inbound/route.ts`
- `src/app/api/webhook/[slug]/completed/route.ts`
- `src/app/api/webhook/[slug]/transfer/route.ts`
- `src/app/api/webhook/[slug]/voicemail/route.ts`
- `src/app/api/webhook/ultravox/route.ts`
- `src/app/api/webhook/stripe/route.ts`
- `src/lib/twilio.ts` — `validateSignature()`, `buildVoicemailTwiml()`, `buildIvrGatherTwiml()`
- `src/lib/ultravox.ts` — `callViaAgent()`, `createCall()`, `verifyCallbackSig()`
