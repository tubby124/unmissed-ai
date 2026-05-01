---
type: tracker-item
id: D-NEW-transfer-toggle-overview-ux
status: not-started
priority: P1
tags: [tracker, feature-request, overview, transfer, slot-pipeline]
affects-clients: [urban-vibe, all-pro-plan]
related: [[Tracker/D445]], [[Architecture/Control-Plane-Mutation-Contract]]
date-added: 2026-04-30
last-updated: 2026-04-30
spawned-by: D445 urban-vibe migration — Ray's question 3
---

# D-NEW — Transfer Toggle on Overview (pick number + auto-update prompt)

## Source

Ray Kassam's request during D445 Urban Vibe migration kickoff (2026-04-30 PM):

> "I don't think he has it set up to do the live call, but we need the option where if he does click the on the overview where he clicks live transfer or transfer, then it should allow him to choose the number and it should automatically update the system prompt."

## Problem

Current UX for enabling transfer:

1. Owner navigates to Settings (buried, multi-step).
2. Owner finds Transfer card.
3. Owner enters `forwarding_number` and `transfer_conditions` manually.
4. PATCH `/api/dashboard/settings` triggers `needsAgentSync` → `updateAgent()` → re-syncs prompt + tools.

Friction points:
- Transfer is one of Ray's high-leverage capabilities (P1 emergency callbacks live to him), but it's hidden.
- Number entry is freeform — easy to typo or forget E.164 format.
- Owners don't know that toggling transfer requires the prompt to recompose to register `transferCall` tool.

## Goal

One-click transfer toggle on the Overview page that:

1. Shows a number-picker (their owner phone, business cell, etc.) when enabling.
2. Writes `forwarding_number` (and optional `transfer_conditions`) to DB.
3. Re-runs `recomposePrompt()` automatically so the prompt registers `transferCall`.
4. Confirms back to the owner: "Transfer enabled — Ray will get the call when an emergency comes in."

## Affected systems

- Overview page (currently: `CapabilitiesCard` shows transfer status pill only; no edit affordance).
- Settings PATCH route — already supports `forwarding_number` writes.
- Slot regenerator — needs `recomposePrompt()` triggered post-write.
- Plan entitlement check — `transferEnabled` requires Pro plan AND active subscription_status.

## Open questions

1. **Subscription_status gate:** for clients in concierge state (`subscription_status='none'` + `selected_plan='pro'` like Urban Vibe), should the toggle work? Or require flip to `subscription_status='active'` first? Ask Hasan.
2. **Number picker source:** owner-supplied freeform vs picker from `client_users` phone numbers vs Twilio account-level number list?
3. **Validation:** E.164 format? Country gating (Canada-only? US+CA?)?
4. **Condition presets:** "P1 emergencies only" vs "Always" vs custom? Property-management default would be "P1 only" matching niche FORBIDDEN_EXTRA.
5. **Regression risk:** does enabling transfer mid-call (during a live call) confuse the agent? Likely no since `clients.tools` is read at call creation, not mid-call — but verify.

## Recommended implementation order

1. Add `transfer_conditions` preset dropdown to settings card (P1-only / always / custom). DB-only.
2. Add Overview pill: clickable, opens dialog with number-picker + preset.
3. Wire dialog submit to PATCH `/api/dashboard/settings` with both fields.
4. Verify `needsAgentSync` triggers `updateAgent()` (already does for `forwarding_number` + `transfer_conditions`).
5. Surface success/error in toast.
6. Test on urban-vibe (only after main D445 deploy is stable).

## Non-goals

- Multi-number transfer (round-robin, time-of-day routing). Single forwarding_number per client.
- Live transfer (already exists for Pro plan via `transferCall` tool).
- IVR-driven transfer routing (covered by D-DEFERRED IVR multi-route).

## Status

**not-started.** File first; address after D445 urban-vibe deploys cleanly. Don't bundle into the migration PR — separate scope.
