---
type: tracker
status: deferred
priority: medium
tags: [forwarding, twilio, deferred-infra]
related: [[Project/Go-Live-Tab]] [[Architecture/webhook-security-and-idempotency]]
updated: 2026-04-27
---

# Forwarding verify call — deferred until needed

## Status

**Deferred.** UI removed from Go Live on 2026-04-27. Backend infra stays on disk.

## What it is

A Twilio outbound dial that places a real call to a client's Twilio number, plays a "press 1 to confirm" TwiML, and on confirm flips `clients.forwarding_verified_at`. Built during the original Go Live wave to give an honest end-to-end test of carrier-level forwarding.

## What's still on disk

- `src/app/api/dashboard/forwarding-verify/route.ts` (POST + GET poll)
- `src/app/api/webhook/forwarding-verify-twiml/[client_id]/route.ts`
- `src/app/api/webhook/forwarding-verify-confirm/[client_id]/route.ts`
- DB columns `forwarding_verified_at`, `forwarding_self_attested` on `clients` (applied to prod 2026-04-27)

## Why deferred

Never tested end-to-end with a real carrier-forwarded call. Risk of shipping a broken verifier as the centerpiece of Go Live > value of the verification.

## What replaced it

Self-attest only. User tests by **calling their own Twilio number** from a second phone. If they hear the agent, they tap "It worked — I heard the agent" → `POST /api/dashboard/forwarding-verify/self-attest` → both `forwarding_self_attested=true` AND `forwarding_verified_at=now()` are written. Go Live banner fires off either column.

## When to re-surface

If/when:
- A real carrier-forwarded test call has been confirmed to land on the verify TwiML and trigger the confirm endpoint.
- We have reliable Twilio outbound budget for verification calls (currently no per-client cap on this path).
- Self-attest data shows people are clicking "it worked" without it actually working — i.e. we need a stronger truth signal.

## Resume hints

- The verify endpoint expects a Twilio number on `clients.twilio_number` — trial clients don't have one and would need a different code path.
- Polling timeout was 30s in the old UI. Reasonable but could be tightened.
- The TwiML route has no Twilio signature validation — uses a `?sig=&n=&t=` HMAC pattern instead. Re-check if re-enabling.
