---
type: feature
status: live
tags: [feature, booking, calendar]
mutation-class: DB_PLUS_PROMPT_PLUS_TOOLS
plan-gate: pro
related: [Clients/hasan-sharif]
updated: 2026-03-31
---

# Feature: Calendar Booking

## DB Fields
- `clients.booking_enabled` — toggle
- `clients.calendar_auth_status` — 'connected' | null

## What Happens When Enabled
1. `patchCalendarBlock()` appends `# CALENDAR BOOKING FLOW` block to system_prompt
2. `buildAgentTools()` adds `checkCalendarAvailability` + `bookAppointment` tools
3. `updateAgent()` syncs both to Ultravox

## UI vs Agent Truth Gap (intentional)
- UI badge: requires `booking_enabled=true` AND `calendar_auth_status='connected'`
- Agent tools: added when `booking_enabled=true` only (ignores calendar_auth_status)
- Tool fails gracefully if calendar not connected

## Active Clients
- [[Clients/hasan-sharif]] — calendar connected ✅

## Key Files
- `src/lib/prompt-patcher.ts` → `patchCalendarBlock()`
- `src/lib/ultravox.ts` → `buildAgentTools()` booking section
- `src/app/api/dashboard/settings/route.ts` → needsAgentSync trigger

## Connections
- → [[Architecture/Control Plane Mutation]] (DB_PLUS_PROMPT_PLUS_TOOLS class)
