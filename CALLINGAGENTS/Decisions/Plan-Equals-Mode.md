---
type: decision
status: proposed
tags: [decision, onboarding, pricing, strategy]
related: [Product/Onboarding Audit 2026-04-01, Decisions/Tier Differentiation — Quality Floor Not Ceiling, Tracker/D323, Tracker/D324]
date: 2026-04-01
---

# Decision: Plan = Mode (Eliminate Separate Mode Selection)

## Context
The onboarding flow currently has a 7-step wizard with a separate "Agent mode" selection step (step 3) offering 4 modes:
1. Take a message (voicemail replacement)
2. Capture caller details (lead capture)
3. Answer questions (info hub / FAQ)
4. Help callers book appointments

Separately, the plan selection step (step 6) offers 3 tiers:
- Lite ($49) = "AI Voicemail"
- Core ($119) = "Smart Receptionist"
- Pro ($229) = "Receptionist + Booking"

## Problem
The mode and the plan are redundant. The plan names already describe the agent behavior:
- Lite IS the voicemail mode
- Core IS the lead capture + info hub mode
- Pro IS the appointment booking mode

Asking users to pick a "mode" AND a "plan" is confusing. The mode selector has 4 options but only 3 plans. The mapping isn't 1:1 and creates cognitive load.

## Decision
**The plan determines the mode. Remove the separate mode selector.**

When a user picks a plan, the agent is configured accordingly:
- Lite → `call_handling_mode: 'voicemail_replacement'`, no knowledge tools, no transfer, no booking
- Core → `call_handling_mode: 'lead_capture'`, knowledge enabled, lead scoring, SMS follow-up
- Pro → `call_handling_mode: 'appointment_booking'`, everything + booking + transfer

Trial → all features unlocked (same as today)

## Implications
- Step 3 (Agent mode) is eliminated from onboarding
- `call_handling_mode` is derived from `selected_plan` at provision time, not from a user choice
- Plan upgrade/downgrade changes the agent mode automatically
- Dashboard can still let users override their mode if they want (post-onboarding)
- The "mode" concept still exists in the code, it's just not a separate onboarding step

## Extends
- [[Decisions/Tier Differentiation — Quality Floor Not Ceiling]] — every agent gets full conversation quality; tiers = minutes + features, NOT quality
- [[Decisions/User Designs Prompt]] — the user's data is authoritative; mode is a system-derived consequence of their plan choice

## Status
PROPOSED — awaiting confirmation before implementation.
