---
type: tracker
status: deferred
priority: low
tags: [hours, after-hours, runtime-routing, deferred]
related: [[Project/Go-Live-Tab]] [[Architecture/per-call-context-contract]] [[Architecture/control-plane-mutation-contract]]
updated: 2026-04-27
---

# After-hours emergency forward — runtime routing unverified

## Status

**Deferred.** UI surface removed from Go Live on 2026-04-27. DB column + per-call injection logic remain.

## What it is

`clients.after_hours_emergency_phone` + `clients.after_hours_behavior='route_emergency'`. Per [[Architecture/per-call-context-contract]] section 2.1, this is `PER_CALL_CONTEXT_ONLY` — injected via `callerContextBlock` at call creation time when the caller is outside business hours.

## Why deferred

The user has never tested whether the runtime actually **routes** to this number, or just **mentions** it in the prompt context. Two possible failure modes:

1. The agent says "I'll connect you to our emergency line" but no Twilio redirect fires.
2. The runtime correctly redirects but the path is brittle (no fallback, no retry, no opt-out for the caller).

Until that's been tested with a real after-hours inbound call, surfacing this as an editable Go Live row would be a fake control.

## Resume hints

- Look at `src/lib/agent-context.ts` → `buildAfterHoursBehaviorNote()` for what's actually injected.
- Check whether `after_hours_emergency_phone` ever participates in a Twilio `redirectCall` or just shows up in the prompt block.
- If it's prompt-only today, the runtime fix is to wire it to `transferCall` tool with conditional gating on `isAfterHours`.
- Test client: pick one with hours set and place a call outside that window.

## Where the field can still be edited

Settings → Hours card (`HoursFields`). Removed from Go Live only.
