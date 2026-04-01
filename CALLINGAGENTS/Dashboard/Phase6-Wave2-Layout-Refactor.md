---
type: dashboard
tags: [dashboard, frontend, layout, phase6-wave2]
related: [Dashboard/Dashboard Architecture, Dashboard/Settings Cards, Architecture/Phase6-Wave2-Dashboard-Matrix, Architecture/Phase6-Wave2-Knowledge-Page]
updated: 2026-04-01
status: done
---

# Phase 6 Wave 2 — Dashboard Layout Refactor (2026-03-31 → 2026-04-01)

> Two-session output: full layout restructure across Overview, Knowledge, Calls & Leads, and Settings pages. Primarily frontend — one small API addition (`callerReasons` in home route).

## Design Principles

### 1. CONFIG strip first
QuickConfigStrip is the **control surface** — sits above the hero on Overview. Users see feature status at a glance before anything else.

### 2. Orb everywhere
TestCallCard orb on every main page:
- **Overview** — hero center column
- **Knowledge** — TIER 1 center column
- **Calls & Leads** — right column next to AgentConfigCard
- **Settings** — right column of overview section (above tab bar)

### 3. 3-column consistency
All main pages use `md:grid-cols-3` for primary content grids. Mobile stacks to single-column.

### 4. Full-width edge-to-edge
Removed `max-w-5xl` from Knowledge page. All pages stretch to fill available width.

---

## Changes by Page

### Overview (UnifiedHomeSection.tsx)

**Layout order:**
```
Banners → QuickConfigStrip (8 pills) → Setup Progress → Hero 3-col → Sync badge → Call Log + Bookings (2-col) → Knowledge + Unanswered (2-col) → Billing
```

Key moves:
- QuickConfigStrip moved above hero (was below)
- Setup Progress directly below config strip
- VoicePickerDropdown moved into hero right column
- Call Log + BookingCalendarTile side by side (was separate rows)
- BillingTile standalone full-width (was paired with Bookings)

### Knowledge (KnowledgePageView.tsx)

**Layout:** Full-width, 3-col grids throughout.
```
Health Score | TestCallCard orb | Quick Add (3-col)
Facts | FAQs | Unanswered + Bulk AI (3-col)
Sources | Suggestions | Caller Searches (3-col)
Ask Your Agent (full-width)
```

### Calls & Leads (calls/page.tsx)

**Layout:**
```
Header → AgentConfigCard (2-col) + TestCallCard orb (1-col) → CallsList → Lead Queue + Learning Loop + Contacts (3-col)
```

### Settings (SettingsView.tsx)

**Non-admin overview section (above tab bar):**
```
Capabilities card (2-col) | TestCallCard orb + Prompt Editor + Notifications (1-col)
```

Agent tab restored for non-admin users — contains all detailed settings cards (mode, voice, services, routing, booking, IVR, voicemail, prompt editor, outbound, learning loop). Removing it would orphan settings linked from other pages.

---

## QuickConfigStrip — 8 Inline Config Pills

| Pill | Status values | Expandable | Saves via |
|------|--------------|------------|-----------|
| Telegram | Connected / Set up | No (opens sheet) | — |
| Email | On / Off | No (toggles directly) | `email_notifications_enabled` |
| IVR | On / Off | Yes (prompt editor + toggle) | `ivr_enabled`, `ivr_prompt` |
| Voicemail | Custom / Default | Yes (greeting editor) | `voicemail_greeting_text` |
| Auto-text | On / Off / Upgrade | Yes (template editor + toggle) | `sms_enabled`, `sms_template` |
| Booking | Off / Set up / Connected | Yes (toggle + calendar link) | `booking_enabled` |
| Transfer | Set up / Active | Yes (number + conditions editor) | `forwarding_number`, `transfer_conditions` |
| Routing | Set up / Active | Yes (3 caller reasons + generate) | `niche_custom_variables` + `section_id: 'triage'` |

All saves go through `usePatchSettings` → `PATCH /api/dashboard/settings` → `needsAgentSync` → Ultravox.

**Routing pill** calls `/api/onboard/infer-niche` to generate TRIAGE_DEEP from caller reasons, then patches both `niche_custom_variables` and the live `triage` prompt section — identical to CallRoutingCard in Settings.

---

## API Change

**`GET /api/dashboard/home/route.ts`** — added `callerReasons` field to response:
```ts
callerReasons: JSON.parse(niche_custom_variables._caller_reasons) ?? []
```
Feeds the Routing pill in QuickConfigStrip so it can show existing caller reasons without a separate fetch.

---

## Files Changed

| File | What |
|------|------|
| `src/components/dashboard/home/UnifiedHomeSection.tsx` | Layout reorder, new props to QuickConfigStrip |
| `src/components/dashboard/home/QuickConfigStrip.tsx` | +3 pills (Booking, Transfer, Routing), +3 expanded panels, +3 icons |
| `src/app/dashboard/knowledge/KnowledgePageView.tsx` | 3-col layout, TestCallCard added, removed max-w |
| `src/app/dashboard/calls/page.tsx` | 3-col grid with TestCallCard, import added |
| `src/app/dashboard/settings/SettingsView.tsx` | Capabilities overview + orb above tab bar, TestCallCard import |
| `src/app/api/dashboard/home/route.ts` | Added `callerReasons` to response |
| `src/components/dashboard/ClientHome.tsx` | Added `callerReasons` to HomeData type |

---

## Connections
- → [[Dashboard/Dashboard Architecture]] — updated with current layout order
- → [[Architecture/Phase6-Wave2-Dashboard-Matrix]] — overview layout spec
- → [[Architecture/Phase6-Wave2-Knowledge-Page]] — knowledge page spec
- → [[Dashboard/Settings Cards]] — QuickConfigStrip is inline version of settings cards
- → [[Tracker/D278]] — overview redesign ✅ (layout shipped)
- → [[Tracker/D309]] — knowledge redesign ✅ (3-col + orb shipped)
- → [[Tracker/D310]] — health score ✅ (already done, now in 3-col)
- → [[Tracker/D308]] — tab naming (still open — "Overview" kept, not renamed)
- → [[Tracker/D306]] — empty states (still open)
- → [[Tracker/D288]] — capability preview (partially addressed — CapabilitiesCard on Settings overview)
- → [[Tracker/D290]] — "What Your Agent Knows" (partially addressed — KnowledgeInlineTile on Overview)
