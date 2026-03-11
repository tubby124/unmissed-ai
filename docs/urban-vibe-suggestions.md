# Urban Vibe Properties — Jade Prompt Suggestions for Ray

**Date:** 2026-03-11
**Source:** Call data analysis — 67 Urban Vibe calls reviewed
**Status:** Suggestions only — Ray applies at his discretion. Nothing has been changed in Supabase.

---

These four additions were identified from patterns in the Urban Vibe call logs. Each one is optional. The current prompt is working well — these are targeted improvements, not rewrites.

The live prompt structure referenced below is `JADE_SYSTEM_PROMPT_v2.0.txt`.

---

## Suggestion 1 — Ask Why They're Calling (Info Collection)

**Finding:** 20 of 67 calls logged no reason for the call. Callers would give name + number but Jade never asked what it was about, leaving Ray with no context before calling back.

**Where to add it:** `## 4. INFO COLLECTION` — insert after collecting caller name, before asking for callback number. Apply to all call types except emergencies and rental prospects.

**Text to add:**

```
After collecting caller name:
"and what should I let Ray know this is about?"
If they're vague ("just a general question", "I'll tell him when he calls") or refuse: accept it and move on. Do NOT ask twice.
```

**Current flow:** name → callback number
**New flow:** name → reason → callback number

---

## Suggestion 2 — Owner/Family Fast-Path

**Finding:** Ray (+14036057142), Nisha, Ayana, and Sayfaan ran through the full triage flow on multiple calls. They had to answer "are you a tenant or looking to rent?" and go through maintenance/inquiry routing before Jade would take a message. This wastes time for people who just need to log a note.

**Where to add it:** Insert a new block immediately after `## 1. GREETING` and before `## 2. THE FILTER`.

**Text to add:**

```
OWNER / FAMILY CALLER:
If the caller identifies as Ray, Nisha, Ayana, or Sayfaan — or their number matches a known family/owner number (+1 403 605 7142):
"hey [name]! what do you need me to log?"
→ collect brief note
→ "got it, logged that for you. talk soon." → use hangUp
Do NOT run triage. Do NOT ask for callback number. Do NOT collect unit or issue type.
```

**Note:** Phone-number matching works if Ultravox passes caller ID through. Name-based identification ("if they say they're Ray") works without any caller ID setup. Both methods can coexist in the instruction.

---

## Suggestion 3 — Extended Silence Safeguard

**Finding:** One call remained open for 415 seconds (nearly 7 minutes) with no meaningful engagement. The caller either muted, set the phone down, or the call connected without a live person. Jade waited the entire time.

**Where to add it:** Bottom of `## 2. THE FILTER` section, after the last existing filter entry (the `ANYTHING ELSE` handler), before `## 3. TRIAGE`.

**Text to add:**

```
EXTENDED SILENCE (>60 seconds cumulative with no meaningful caller input):
"looks like we may have gotten disconnected. feel free to call back anytime or text this number. take care." → use hangUp
```

---

## Suggestion 4 — Language Barrier Handler

**Finding:** Turkish-speaking and French/Spanish-speaking callers were detected in the call logs. The current prompt has no handler for this — Jade runs the standard greeting and triage flow, which is confusing for callers who can't follow it.

**Where to add it:** `## 2. THE FILTER` section, after the EXTENDED SILENCE entry (Suggestion 3 above).

**Text to add:**

```
CALLER SPEAKS ANOTHER LANGUAGE:
"i'm sorry, i can only help in english right now... but i'll let Ray know you called and that you might prefer another language. he'll call you back!"
Note the language in the message if identifiable. → use hangUp
```

---

## Combined Insertion Map

For reference, here is where all four suggestions land in the prompt structure:

| # | Suggestion | Section | Position |
|---|-----------|---------|----------|
| 1 | Reason for call | INFO COLLECTION (Step 4) | After name, before callback number |
| 2 | Owner/family fast-path | New block | After GREETING, before THE FILTER |
| 3 | Extended silence safeguard | THE FILTER | After last filter entry, before TRIAGE |
| 4 | Language barrier handler | THE FILTER | After extended silence entry |
