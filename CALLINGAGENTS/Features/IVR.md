---
type: feature
status: live
tags: [feature, ivr, twilio, dtmf]
mutation-class: DB_ONLY
plan-gate: core
related: [Clients/exp-realty]
updated: 2026-03-31
---

# Feature: IVR Pre-Filter

## DB Fields
- `clients.ivr_enabled` — toggle
- `clients.ivr_prompt` — text read to caller before digit prompt

## How It Works
1. inbound webhook checks ivr_enabled
2. If true: return `<Gather>` TwiML (digit menu)
3. Caller presses 1 → voicemail; anything else → /inbound?skip_ivr=1 (agent)
4. `/api/webhook/[slug]/ivr-gather` handles the digit

## Constraints
- DTMF requires Twilio PSTN — NOT available on WebRTC browser calls
- Currently 2-choice only: 1=voicemail, else=agent (no multi-level menus)
- D12 Ph2c: IVR multi-route call handling — DEFERRED

## Only Active Client
- [[Clients/exp-realty]] — IVR enabled

## Key Files
- `src/lib/twilio.ts` → buildIvrGatherTwiml()
- `src/app/api/webhook/[slug]/inbound/route.ts` → IVR gate
- `src/app/api/webhook/[slug]/ivr-gather/route.ts`
- `src/components/dashboard/settings/IvrMenuCard.tsx`

## Connections
- → [[Architecture/Call Path Matrix]] (PSTN only, DTMF constraint)
