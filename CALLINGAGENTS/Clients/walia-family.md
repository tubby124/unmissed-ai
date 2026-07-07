---
type: client
status: paused
slug: walia-family
ultravox_agent_id:
voice_id:
twilio_number: +15878728187
plan:
tags: [client, paused]
related: []
updated: 2026-07-07
---

# Walia Family

## Live truth 2026-07-07

- **Paused 2026-07-07** — stale account: **2 all-time calls**.
- Twilio DID `+15878728187` **retained** (not released) in case of reactivation.
- Pause is DB-only (same pattern as [[calgary-property-leasing]] cron pause — Twilio number + Ultravox agent untouched).

## Open Issues
- Decide: reactivate, or release the DID and set `status='cancelled'`.
