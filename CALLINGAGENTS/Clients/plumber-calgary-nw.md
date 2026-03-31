---
type: client
status: test
slug: plumber-calgary-nw
ultravox_agent_id: d863d0c5-2ac8-4065-94a4-867559bb8d05
voice_id: 5f8e97b1-cd48-431a-b6a1-3b94306d8914
twilio_number:
plan: trial
tags: [client, plumber, test]
related: [[Tracker/D277]], [[Tracker/D260]]
updated: 2026-03-31
---

# Plumber Calgary NW — Dave

## Identity
| Field | Value |
|-------|-------|
| Slug | `plumber-calgary-nw` |
| Ultravox Agent | `d863d0c5-2ac8-4065-94a4-867559bb8d05` |
| Voice | `5f8e97b1-cd48-431a-b6a1-3b94306d8914` |
| Twilio Number | (not provisioned) |
| Plan | Trial / test |
| Niche | `plumber` |
| Agent Name | Dave |
| Business | Plumber Calgary NW, Calgary, Alberta |
| Owner / Close Person | Emon |

## Active Features
- [ ] Booking
- [ ] SMS
- [ ] Transfer
- [ ] IVR
- [ ] Knowledge RAG

## Prompt Notes
- Voice: Default plumber voice preset
- Tone: Professional, direct
- Key behaviors: Standard plumber niche triage (emergency leak/burst/backup vs routine maintenance)
- Prompt history: was 18,503 chars (causing lag), compressed to 5,312 chars in DB on 2026-03-31

## Open Issues
- **Lag investigation (D277):** Original 18.5K prompt caused lag. Compressed to 5.3K. Ultravox sync pending. Root cause TBD — prompt size alone may not explain it since other systems at 20K don't lag. Possible factors: tool count, knowledge config (pgvector with 0 hits), duplicate services.
- **Service catalog duplicates:** 21 services with duplicates (both "Drain cleaning" and "Drain Cleaning"). Needs dedup. Relates to [[Tracker/D260]] — service catalog edits don't flow to live agent.
- **Ultravox sync:** Pending. DB has compressed 5.3K prompt but Ultravox agent still had old 18.7K prompt as of session end.

## Call Observations
- Test client onboarded for testing purposes
- Not yet taking live calls
