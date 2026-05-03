---
id: D-NEW-returning-caller-self-id
title: Returning-caller greeting must include agent self-identity
status: code-shipped-needs-live-push
priority: HIGH
opened: 2026-05-02
related: [[00-Inbox/contact-hub-plan]]
---

# Bug: Returning-caller AI loses its own identity in the greeting

## Symptom

Calgary Edmonton Property Leasing (Brian, slug `calgary-property-leasing`, persona Eric) — May 1 2026, ultravox call `acc97314-250f-4032-ae0e-0485de82da58`:

```
Agent: "hey George, good to hear from you again. how can I help you with your 49th Street property today?"
User:  "Hey, George, can you tell me who you work for?"
Agent: "gotcha... i work for Calgary Edmonton Property Leasing. what can I help you with today?"
```

Caller "George" assumed the AI's name was George because the AI greeted him without identifying itself. The AI is named "Eric" — but the returning-caller greeting only used the caller's name, no self-introduction.

## Root cause

[src/lib/prompt-slots.ts](src/lib/prompt-slots.ts) `buildReturningCaller()` template said:
```
1. Greet by name if available: "hey [name], good to hear from you again"
```

The AI correctly substituted `[name]` with the caller's name from `CALLER NAME: George` in callerContext. **Mechanically correct, behaviorally wrong** — the caller has no anchor for who is speaking. They naturally assume the only name they hear is their interlocutor's.

This is a **template wording bug**, not a variable interpolation bug. The variable system worked. The instruction itself was incomplete.

## Fix shipped (2026-05-02)

Updated [src/lib/prompt-slots.ts](src/lib/prompt-slots.ts) `buildReturningCaller()` to:

```
1. Greet them by their name AND identify yourself in the same sentence so the caller knows who is speaking. Pattern: "hey [their name], it's [your name] from [business name] again — good to hear from you."
   - Never say only "hey [their name]" without identifying yourself. Without your name, callers will assume YOUR name is the one you just said.
```

Updated 5 golden test snapshots:
- [src/lib/__tests__/snapshots/auto-glass-baseline.txt](src/lib/__tests__/snapshots/auto-glass-baseline.txt)
- [src/lib/__tests__/snapshots/auto-glass-voicemail-replacement.txt](src/lib/__tests__/snapshots/auto-glass-voicemail-replacement.txt)
- [src/lib/__tests__/snapshots/real-estate-baseline.txt](src/lib/__tests__/snapshots/real-estate-baseline.txt)
- [src/lib/__tests__/snapshots/hvac-baseline.txt](src/lib/__tests__/snapshots/hvac-baseline.txt)
- [src/lib/__tests__/snapshots/plumbing-appointment-booking.txt](src/lib/__tests__/snapshots/plumbing-appointment-booking.txt)

Test results: 108/108 golden tests pass · 162/162 shadow + agent-context tests pass.

## Live client status

| Client | Slug | Status | Action |
|---|---|---|---|
| Brian's | `calgary-property-leasing` | NEEDS PUSH | Run `/prompt-deploy calgary-property-leasing` after regenerating prompt with new slot |
| Velly | `velly-remodeling` | NEEDS PUSH | Same |
| Hasan | `hasan-sharif` | NO-REDEPLOY rule | Defer to D445 migration |
| Omar (Fatema) | `exp-realty` | NO-REDEPLOY rule | Defer to D445 migration |
| Windshield Hub | `windshield-hub` | NO-REDEPLOY rule | Defer to D445 migration |
| Urban Vibe | `urban-vibe` | NO-REDEPLOY rule | Defer to D445 migration (PR #67) |

Each non-locked client gets the fix on their NEXT regeneration (any settings change that triggers `recomposePrompt()`).

## Verification

Re-test with a returning caller after deploy:
1. Call `calgary-property-leasing` line from a number that has a prior call log
2. Confirm agent says "hey [name], it's Eric from Calgary Edmonton Property Leasing again..."
3. Confirm caller does not need to ask "who do you work for"

## Out of scope here (covered by Contact Hub plan)

- Cross-client spam blocklist (DROPPED — privacy)
- Contact UI / CSV upload (Phase A of Contact Hub)
- Personal-vs-business routing (Phase B of Contact Hub)
- Known-IVR routing for ShowingTime (Phase D of Contact Hub)

See [[00-Inbox/contact-hub-plan]] for the full follow-on plan.
