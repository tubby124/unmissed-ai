---
type: tracker
status: deferred
priority: HIGH
phase: Phase-8-Dashboard-Polish
related:
  - Clients/velly-remodeling
  - Features/Transfer
  - Architecture/Call-Path-Capability-Matrix
opened: 2026-04-28
---

# D-NEW — Manual "Transfer This Call to Me" Button on LiveCallBanner

## Status
**DEFERRED** — Hasan decided 2026-04-28 to skip during Velly Remodeling provisioning. Use agent-initiated `transferCall` via `transfer_conditions` for now.

## Problem
The Overview page LiveCallBanner shows active calls with **End** and **Open Monitor** buttons only. There is no way for an owner watching a live call to manually pull the caller off the agent and connect them to their own phone. Owners assume this exists (Hasan thought the "Live call transfer" config sheet was a real-time button — it's not).

The agent-initiated `transferCall` tool fires only when caller words match `transfer_conditions`. If the owner is listening and decides "I'll just take this one" mid-call, they have no way to do it without manually calling the caller back.

## What exists today
- `transferCall` tool — agent-decided, fires on caller language matching `transfer_conditions`
- `/api/webhook/[slug]/transfer` route — accepts tool calls, hits Twilio `redirectCall()`
- `transfer_status` column on `call_logs` — already supports `'transferring'` state with overlay in LiveCallBanner ([LiveCallBanner.tsx:129-137](src/components/dashboard/LiveCallBanner.tsx#L129-L137))
- `ForwardingSheet` config sheet — sets `forwarding_number` + the toggle to enable transfer

## What's missing
1. Owner-initiated endpoint: `POST /api/dashboard/calls/[ultravoxCallId]/transfer-now`
   - Auth: client owner / admin via `client_users`
   - Look up `twilio_call_sid` from `call_logs` by `ultravox_call_id`
   - Validate `forwarding_number` is set + plan has transfer entitlement
   - Hit Twilio `redirectCall()` with TwiML `<Dial>${forwarding_number}</Dial>`
   - Set `call_logs.transfer_status = 'transferring'`, log to `notification_logs` for audit
   - Reuse existing `/transfer-status` callback for failure recovery
2. Button on `LiveCallBanner.tsx` next to End:
   - Label: "Transfer to me"
   - Disabled if `forwarding_number` is null OR `transfer_status` already set OR caller is on WebRTC (no Twilio Call SID)
   - Confirmation modal: "This will pull the caller off the agent and ring your phone at +1XXX-XXX-XXXX. Continue?"
3. Telemetry — count manual vs agent-initiated transfers separately (intelligence signal)

## Why deferred
Velly Remodeling concierge onboarding (2026-04-28) prioritized: ship Velly with agent-initiated transfer working first. Once Velly demonstrates real demand for manual override (Kausar saying "I wanted to grab that one but couldn't"), build the button.

## Acceptance criteria
- [ ] Owner clicks "Transfer to me" on a live PSTN call → caller's phone is bridged to `forwarding_number` within 3 seconds
- [ ] Button disabled with tooltip when transfer is impossible (WebRTC / no forwarding number / already transferring)
- [ ] Audit row in `notification_logs` distinguishes `manual_transfer` from `agent_transfer`
- [ ] Test on Velly's real Twilio number with two phones — call in, click button on dashboard, confirm bridge

## Connections
- → [[Architecture/Call-Path-Capability-Matrix]] (Path A live inbound — adds new dashboard-initiated branch)
- → [[Architecture/Webhook-Security-and-Idempotency]] (auth pattern for owner-initiated server actions)
- → [[Features/Transfer]] (current state is agent-only)
- → [[Clients/velly-remodeling]] (first client where the lack will be felt)
