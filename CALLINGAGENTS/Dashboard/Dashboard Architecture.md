---
type: dashboard
tags: [dashboard, frontend, architecture]
related: [Dashboard/Settings Cards, Product/Onboarding Flow, Dashboard/Phase6-Wave2-Layout-Refactor]
updated: 2026-05-03
---

# Dashboard Architecture

## Pages
```
/dashboard                → UnifiedHomeSection (home / overview)
/dashboard/calls          → call log, lead status, agent config, callback tracking
/dashboard/knowledge      → knowledge base, scrape, AI compiler, health score
/dashboard/settings       → capabilities overview + AgentTab (19 settings cards) + SMS + Alerts + Billing
/dashboard/billing        → plan, usage, upgrade
/admin                    → God Mode (admin only)
```

## Overview Page (UnifiedHomeSection) — Layout Order
```
1. Banners (conditional: trial, expiry, minutes, booking mode, sync error, HOT leads, forwarding)
2. QuickConfigStrip (8 pills: Telegram, Email, IVR, Voicemail, Auto-text, Booking, Transfer, Routing)
3. Setup Progress bar (when < 100%, shows X of 6 ready)
4. Hero 3-col grid:
   - Left: Call stats (total, HOT leads, today, last call, AgentReadinessRow)
   - Center: TestCallCard orb
   - Right: VoicePickerDropdown + TrialModeSwitcher + TodayUpdateCard + StatsHeroCard
5. Agent sync badge
6. Call Log + BookingCalendarTile (2-col grid)
7. Knowledge + Unanswered (2-col grid)
8. BillingTile (full-width)
9. Trial upgrade CTA (trial only)
```

## Calls & Leads Page — Layout Order
```
1. Header (Calls & Leads)
2. AgentConfigCard (2-col) + TestCallCard orb (1-col) — 3-col grid
3. CallsList (full-width: stats grid, outcome charts, minute usage, call table)
4. Lead Queue + LearningLoopCard + Contacts (3-col grid)
```

## Knowledge Page — Layout Order
```
1. Conflict banner (when conflicts exist)
2. Header (Knowledge + Preview/Export/Talk to Agent buttons)
3. Health Score | TestCallCard orb | Quick Add (3-col grid)
4. Facts | FAQs | Unanswered Questions + Bulk AI (3-col grid)
5. Sources | Suggestions | Caller Searches (3-col grid)
6. Ask Your Agent (full-width)
7. Drawers: upload, scrape, compile, browse, context-preview, bulk-ai
```

## Settings Page — Layout Order
```
NON-ADMIN:
1. Quick Setup strip (when incomplete)
2. Capabilities overview (2-col) + TestCallCard orb + Prompt Editor + Notifications (1-col) — 3-col grid
3. Tab bar: Agent | SMS | Alerts | Billing
4. Tab content (Agent tab = 19 settings cards with all detailed config)

ADMIN:
1. Client selector + info strip
2. Tab bar: Agent | SMS | Voice | Alerts | Billing | Knowledge
3. Tab content
```

## QuickConfigStrip — 8 Inline Config Pills
Each pill shows status and optionally expands to an inline editor.

As of 2026-05-03, SMS / Booking / Transfer capability status on Overview prefers runtime tool truth from `/api/dashboard/agent/runtime-state` when available. If runtime state is unavailable or `syncStatus='unknown'`, it falls back to the DB/home API state. If DB says a capability is configured but runtime tools do not include it, the pill shows `Not live` instead of an active-looking false state.

| Pill | Status values | Expandable | Saves via |
|------|--------------|------------|-----------|
| Telegram | Connected / Set up | No (opens sheet) | — |
| Email | On / Off | No (toggles directly) | `email_notifications_enabled` |
| IVR | On / Off | Yes (prompt editor + toggle) | `ivr_enabled`, `ivr_prompt` |
| Voicemail | Custom / Default | Yes (greeting editor) | `voicemail_greeting_text` |
| Auto-text | On / Off / Upgrade | Yes (template editor + toggle) | `sms_enabled`, `sms_template` |
| Booking | Off / Set up / Connected | Yes (toggle + calendar link) | `booking_enabled` |
| Transfer | Set up / Active | Yes (number + conditions editor) | `forwarding_number`, `transfer_conditions` |
| Routing | Set up / Active | Yes (3 caller reasons + AI generate) | `niche_custom_variables`, `section_id: 'triage'` |

All saves go through `usePatchSettings` → `PATCH /api/dashboard/settings` → `needsAgentSync` → Ultravox.

## Capability Truth Surfaces

`CapabilitiesCard` and the capability subset of `QuickConfigStrip` now share runtime/tool truth logic through `src/lib/runtime-tool-truth.ts`.

Truth order:
1. Runtime deployed tools when `/api/dashboard/agent/runtime-state` returns known state.
2. DB/home API state when runtime state is unavailable or unknown.

Runtime tool mapping:
- `queryKnowledge` → Knowledge
- `transitionToBookingStage`, `checkCalendarAvailability`, or `bookAppointment` → Booking
- `sendTextMessage` → SMS
- `transferCall` → Transfer

Not-live behavior:
- DB configured + runtime missing = `Not live` / `Saved, but not live yet`
- CTA should deep-link to the relevant settings/config surface and say `Review`, not `Upgrade`, unless the issue is truly plan-gated.

## TestCallCard (Orb) — Present on 4 Pages
- **Overview** — hero center column
- **Knowledge** — TIER 1 center column
- **Calls & Leads** — alongside AgentConfigCard
- **Settings** — overview section right column (above tab bar)

Uses PiP architecture (CallContext + FloatingCallOrb) — call persists across page navigation.

## Open Gaps
- D308 — tab naming decision (Overview vs Agent Brain)
- D306 — empty states for every card
- D229 — "Call back now" button on HOT/WARM call rows
- D175 — empty state CTA (no calls yet → forwarding guide)
- D220 — Lead queue / callback tracking view
- D224 — CSV export
- D227 — knowledge/conflicts, docs, preview-question routes not connected to UI
- D189 — Unify trial/paid dashboard (locked features show preview, not blank)
- D286 — Dashboard settings reorganization
- D447 — route-level runtime-state cache test + rollout/default-on plan remain
- D449 — SyncStatusChip still needs wiring across remaining settings cards
- D446 — drift-detector tool extractor still needs hardening before future audits

## Connections
- → [[Dashboard/Settings Cards]] (settings tab)
- → [[Dashboard/Phase6-Wave2-Layout-Refactor]] (2026-03-31/04-01 layout changes)
- → [[Tracker/D278]] (overview page redesign — done)
- → [[Tracker/D309]] (knowledge page redesign — done)
- → [[Tracker/D189]] (trial/paid split)
