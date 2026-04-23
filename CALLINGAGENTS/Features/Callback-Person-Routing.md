---
type: feature
status: planned
tags: [feature, onboarding, prompt-quality, routing, team-members]
related: [Tracker/D381, Tracker/D394, Architecture/control-plane-mutation-contract]
updated: 2026-04-15
---

# Callback Person + Team Member Routing

## The Problem
Every auto-generated system prompt hardcodes "Hasan" as the callback person:
> "NEVER quote specific prices... Always say: 'i'll get **Hasan** to call ya back with the exact numbers.'"

This is in FORBIDDEN_ACTIONS slot template. Every new client gets this. The Vine barbershop owner is not Hasan. ValleySoft's owner is not Hasan. This is a trust-break that fires on every pricing question.

Deeper: callers often want to reach a SPECIFIC PERSON — their favorite barber, the tech who came last time, the specific agent they spoke to. The system currently has no concept of named staff.

## The Solution: Two New Fields

### 1. `callback_person_name` (text)
- Collected at onboarding: "Who should the agent say will call back? (e.g. 'Mike', 'the owner', 'our team')"
- Defaults to first word of owner name if not set
- Replaces hardcoded "Hasan" everywhere in prompt templates
- Used in: FORBIDDEN_ACTIONS rule 3, CLOSING section, TRIAGE routing lines
- **Mutation class:** DB_PLUS_PROMPT — triggers prompt repatch when changed

### 2. `team_members` (JSONB array)
- Collected at onboarding (optional): named staff the callers might ask for
- Schema: `[{"name": "Johnny", "role": "barber"}, {"name": "Jess", "role": "barber", "note": "does not do skin fades"}]`
- Used in: IDENTITY slot (agent knows who works there), TRIAGE slot (handles "can I speak to X?")
- When caller asks for a specific team member: "Yeah, let me have Johnny give you a call back — can I grab your name?"
- **Mutation class:** DB_PLUS_PROMPT — triggers slot regeneration when changed

## DB Changes
```sql
ALTER TABLE clients ADD COLUMN callback_person_name TEXT;
ALTER TABLE clients ADD COLUMN team_members JSONB DEFAULT '[]'::jsonb;
```

## Prompt Template Changes
- `src/lib/prompt-slots.ts` — `buildForbiddenActions()` slot: replace "Hasan" with `{{CALLBACK_PERSON}}`
- `src/lib/prompt-slots.ts` — `buildIdentity()` slot: append team member names if present
- `src/lib/prompt-slots.ts` — `buildConversationFlow()`: add "SPECIFIC PERSON REQUEST" branch
- `src/lib/slot-regenerator.ts` — add `callback_person_name` and `team_members` to `clientRowToIntake()`
- `src/lib/settings-schema.ts` — register both fields as PROMPT_AFFECTING

## Concierge SOP Update
Add to concierge onboarding checklist:
1. "Who should the agent say will call you back?" → sets `callback_person_name`
2. "Are there specific team members callers might ask for by name?" → sets `team_members`

## Why This Matters
- Every barber shop, salon, dental office, and service business has named staff
- Callers with favorites feel heard when the agent acknowledges "yeah, I can have Johnny give you a call"
- This is the difference between a generic voicemail and a receptionist who knows your business

## Related D-items
- [[Tracker/D381]] — Fix hardcoded Hasan (critical fix)
- [[Tracker/D394]] — Full team member routing (enhancement)

[[Project/Index]]
