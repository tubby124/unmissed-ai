---
type: tracker
status: open
priority: P1
phase: TBD-policy-decision
related:
  - Features/Trial-Lifecycle
  - Clients/calgary-property-leasing
opened: 2026-04-30
---

# D-NEW — Trial auto-disable policy (no code path disables expired trials)

## Status
**OPEN — owner-gated** — needs Hasan's policy call before any code is written.

## Problem
There is no code path that disables a trialing client at `trial_expires_at` without a Stripe conversion. Surfaced 2026-04-27 in MEMORY.md, re-flagged 2026-04-30 PM after Brian's calgary-property-leasing has been live without paying since 2026-04-25.

Today the trial relies entirely on Hasan's manual oversight. There is no:
- Cron / scheduled function that flips `subscription_status` to `expired` after `trial_expires_at`
- Telegram nudge to the client mid-trial or post-expiry
- Hard cutoff that returns voicemail TwiML once trial expires

Result: trialing clients can run indefinitely without paying. Brian has been live ~6 days past trial start with no automatic action.

## Decision required (P1, owner-gated)
Three policy options for Hasan:
1. **Founding-grace (no auto-disable)** — current de-facto state, made explicit. Document that founding clients are manually managed; auto-disable only for non-founding cohort once domain (GATE-1) ships.
2. **Hard cutoff at `trial_expires_at`** — trial ends, agent serves voicemail-only TwiML, dashboard shows upgrade CTA, no calls land. Aggressive; risks killing engaged users on day-7.
3. **Telegram nudge then deactivate** — Day 5 nudge ("trial ends in 2 days"), Day 7 nudge + 24h grace, Day 8 hard disable. Industry standard. Most code surface area but best conversion outcome.

## Why this is a separate D-item (not bundled into Phase A)
Phase A is read-only DB additions + skill. This is a write-side lifecycle gap. Different code surface, different risk profile, requires owner policy call before implementation.

## Acceptance criteria (option 3 only — others trivial)
- [ ] Cron / Vercel-cron-style function fires daily at 9am client-tz checking `trial_expires_at` against now
- [ ] Day-5 / day-7 / day-8 actions match the chosen policy
- [ ] Notification emitted via existing Telegram alert chain (no new infra)
- [ ] `subscription_status` transitions tracked in audit log
- [ ] Smoke test: provision a trial with `trial_expires_at = now + 1 minute`, wait, verify state transition

## Connections
- → [[Features/Trial-Lifecycle]]
- → [[Clients/calgary-property-leasing]] (Brian — the example currently sitting on this gap)
- → [[Architecture/Webhook-Security-and-Idempotency]] (cron auth pattern if option 3)
