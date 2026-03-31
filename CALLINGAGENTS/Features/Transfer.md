---
type: feature
status: live
tags: [feature, transfer, twilio]
mutation-class: DB_PLUS_TOOLS
plan-gate: pro
related: [Clients/windshield-hub]
updated: 2026-03-31
---

# Feature: Call Transfer

## DB Fields
- `clients.forwarding_number` — phone number to transfer to
- `clients.transfer_conditions` — used as tool description text

## How It Works
1. Agent calls `transferCall` HTTP tool
2. `/api/webhook/[slug]/transfer` → Twilio redirectCall()
3. PSTN call redirected to forwarding_number via `<Dial>`
4. If dial fails → `/api/webhook/[slug]/transfer-status` reconnects to AI

## PSTN Only
Transfer requires a Twilio Call SID. WebRTC browser calls have no SID → transfer impossible.

## Recovery Pattern
`actionUrl` on `<Dial>` → `/transfer-status` → creates new Ultravox call if forwarding fails.

## Key Files
- `src/app/api/webhook/[slug]/transfer/route.ts`
- `src/app/api/webhook/[slug]/transfer-status/route.ts`
- `src/lib/ultravox.ts` → buildTransferTools()

## Connections
- → [[Architecture/Call Path Matrix]] (PSTN only)
- → [[Clients/windshield-hub]] (forwarding to Sabbir)
