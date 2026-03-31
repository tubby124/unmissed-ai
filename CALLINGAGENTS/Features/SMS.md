---
type: feature
status: live
tags: [feature, sms, twilio]
mutation-class: DB_PLUS_TOOLS
plan-gate: core
related: [Clients/hasan-sharif, Clients/windshield-hub]
updated: 2026-03-31
---

# Feature: SMS During Call

## DB Fields
- `clients.sms_enabled` — toggle
- `clients.twilio_number` — required for tool to register

## Gate Logic
Tool only injected when: `sms_enabled=true` AND `twilio_number` set AND plan.smsEnabled AND slug
If twilio_number is null (trial clients), tool is NOT registered even if sms_enabled=true.

## Known Gap
`twilio_number` NOT in needsAgentSync → if admin sets number via God Mode, SMS tool stays stale until sms_enabled is toggled off+on.

## Post-Call SMS (D192 — LIVE)
Short call + caller gave contact info → auto-SMS "Thanks for calling, here's your next step"
Fires from /api/webhook/[slug]/completed

## Missed Call Auto-SMS (D219 — OPEN)
Short call (<10s) + classification=JUNK → auto "We missed your call"
Rate-limited: 1/phone/24h

## Key Files
- `src/lib/ultravox.ts` → `buildSmsTools()`
- `src/app/api/webhook/[slug]/sms/route.ts`
- `src/lib/tracking.ts` → `sendSmsTracked()`

## Connections
- → [[Architecture/Control Plane Mutation]] (DB_PLUS_TOOLS)
- → [[Tracker/D219]] (missed call auto-SMS — open)
