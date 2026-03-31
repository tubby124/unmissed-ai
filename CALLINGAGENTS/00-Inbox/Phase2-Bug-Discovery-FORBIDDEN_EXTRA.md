---
type: bug
status: fixed
fixed: 2026-03-31
fix: D296 — changed nicheDefaults.FORBIDDEN_EXTRA to variables.FORBIDDEN_EXTRA in prompt-slots.ts
tags: [phase2, bug, prompt-builder, forbidden-extra]
target: D268
created: 2026-03-31
---

# Bug: Niche FORBIDDEN_EXTRA Modifications Are Dead Code

## Discovery
Found during Phase 2 golden test expansion (Layer 4, Category B tests).

## Root Cause
In `src/lib/prompt-builder.ts`:
- Lines 163-309 modify `variables.FORBIDDEN_EXTRA` for niche-specific inputs (restaurant delivery, dental waitlist, legal referral-only, etc.)
- Line 573 reads `nicheDefaults.FORBIDDEN_EXTRA` (the original unmodified niche defaults), NOT `variables.FORBIDDEN_EXTRA`
- The template has no `{{FORBIDDEN_EXTRA}}` placeholder — it's assembled via the injection pipeline

So all niche custom variable FORBIDDEN_EXTRA additions are **silently discarded**.

## Impact
These niche-specific rules are never injected into the prompt:
- Restaurant: "NEVER take delivery or takeout orders over the phone"
- Dental waitlist: "add to waitlist only — do NOT confirm a booking"
- Legal referral-only: "NEVER book a cold inquiry — referrals only"
- Dental no-emergency: "NEVER promise a same-day or emergency appointment"
- HVAC/plumbing no-emergency: "NEVER accept emergency calls"
- Property management no-emergency-line
- Salon deposit policy
- Legal paid consultations
- Legal no-urgent routing

The base `nicheDefaults.FORBIDDEN_EXTRA` (from niche-defaults.ts) IS injected correctly. It's only the intake-driven ADDITIONS that are lost.

## Fix
Phase 3 (D268): The slot-based `buildSlotContext()` in `prompt-slots.ts` already handles this correctly — it builds `forbiddenExtraRules` from the full `effectiveRestrictions` chain which includes both `nicheDefaults.FORBIDDEN_EXTRA` AND `variables.FORBIDDEN_EXTRA` modifications. When the old builder is retired, this bug is automatically fixed.

## Tests
3 golden tests written as "LATENT BUG" assertions documenting current (broken) behavior. They will flip when the bug is fixed.
