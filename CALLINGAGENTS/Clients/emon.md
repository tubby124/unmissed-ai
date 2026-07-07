---
type: client
status: paused
slug: emon
ultravox_agent_id:
voice_id:
twilio_number: +15873275902
plan:
tags: [client, paused]
related: []
updated: 2026-07-07
---

# Emon

## Live truth 2026-07-07

- **Paused 2026-07-07** — stale account: **1 all-time call**.
- Twilio DID `+15873275902` **retained** (not released) in case of reactivation.
- Pause is DB-only (same pattern as [[calgary-property-leasing]] cron pause — Twilio number + Ultravox agent untouched).
- Onboarding trace artifacts: `CALLINGAGENTS/00-Inbox/onboard-emon-trace/`.

## Open Issues
- Decide: reactivate, or release the DID and set `status='cancelled'`.
