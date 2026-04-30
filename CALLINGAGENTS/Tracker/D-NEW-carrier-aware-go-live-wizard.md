---
type: tracker
status: open
priority: P2
phase: Phase-7-Onboarding
related:
  - Tracker/D292
  - Features/Go-Live
  - Architecture/Control-Plane-Mutation-Contract
opened: 2026-04-30
---

# D-NEW — Carrier-aware Go Live wizard (extends D292)

## Status
**OPEN** — Phase 7 territory, low priority until D292 (guided forwarding wizard) ships base flow.

## Problem
D292 (guided call forwarding wizard) is currently scoped to ask the user to self-select their carrier from a dropdown. Now that `clients.carrier` exists (Phase A, 2026-04-30) and is populated either at provision time or via the future `/concierge-onboard` flow, the wizard can skip the self-select step and render the right dial code directly.

## Surface area
- Page: `src/app/dashboard/go-live/page.tsx`
- Component: `src/components/dashboard/go-live/CallForwardingCard.tsx`
- Helper (already shipped Phase A): `src/lib/forwarding-codes.ts` exposes `buildForwardingCodes(twilio_number, carrier)` returning combo + conditional + unconditional codes + carrier voicemail support number

## Required behavior
1. Read `clients.carrier` at page render
2. If `carrier IS NOT NULL` → call `buildForwardingCodes()` and render the carrier-specific dial sequence + voicemail-removal callout with the right support phone number, no dropdown
3. If `carrier IS NULL` → fall back to current dropdown UX
4. Pair with the voicemail-removal step (per ADR `2026-04-29-voicemail-removal-required-for-cf`) — surface support phone number prominently

## Why this is a separate D-item
Phase A ships the data + helper. UX integration is its own concern; depends on D292 base flow shipping first to avoid two parallel wizards.

## Acceptance criteria
- [ ] Client with `carrier='rogers'` lands on Go Live and sees Rogers-specific code + Rogers Consumer support phone (`1-800-764-3771`) without picking from a list
- [ ] Client with `carrier=null` sees the dropdown fallback (existing D292 behavior)
- [ ] Voicemail-removal step is non-skippable (matches `unmissed-carrier-voicemail-removal.md` rule)
- [ ] Status check codes (`*#004#`, `*#21#`) visible after the user dials enable code

## Connections
- → [[Tracker/D292]] (parent — guided forwarding wizard)
- → [[Features/Go-Live]]
- → [[Architecture/Control-Plane-Mutation-Contract]] (`carrier` column classification)
