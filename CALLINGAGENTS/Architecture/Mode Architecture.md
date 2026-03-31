---
type: architecture
tags: [architecture, mode, prompt]
related: [Architecture/Prompt Generation, Product/Intent Classification]
updated: 2026-03-31
---

# Mode Architecture (call_handling_mode)

## Three Modes
```
message_only  →  AI Voicemail
  Goal: collect name + phone + message. Nothing else.
  Should: skip TRIAGE entirely, go straight to INFO COLLECTION
  Fails today: TRIAGE section still renders (D180 bug)

info_hub      →  Smart Receptionist
  Goal: answer FAQs, qualify lead, callback
  Should: full TRIAGE with intent routing → info collection → callback scheduling
  Needs: intent taxonomy per niche (D243)

booking       →  Receptionist + Booking
  Goal: everything above + book appointments
  Should: TRIAGE → intent → booking flow
  Needs: calendar connected + booking_enabled=true
```

## The Bug (D180)
Mode instruction (`## CALL HANDLING MODE`) is at the BOTTOM of the prompt.
GLM-4.6 with long prompts: earlier sections can override later ones.
`message_only` agents sometimes still ask TRIAGE questions because the TRIAGE section runs first.

## Fix: PRIMARY GOAL at Top
Insert PRIMARY GOAL block at position 0 (before everything):
```
PRIMARY GOAL: [mode-specific one-liner]
All other instructions serve this goal. If in doubt, return to this.
```

## DB Field
`clients.call_handling_mode` — set at onboarding, editable in settings

## UI Gap (D186)
Mode selector in onboarding/settings doesn't show live preview of what the agent will/won't do.
User selects "message_only" with no understanding it disables all triage.

## Connections
- → [[Architecture/Prompt Generation]] (mode = section at end of template)
- → [[Tracker/D185]] (mode-first onboarding redesign)
- → [[Tracker/D186]] (mode preview UI in dashboard)
