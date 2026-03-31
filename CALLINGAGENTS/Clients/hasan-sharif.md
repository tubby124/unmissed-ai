---
type: client
status: active
slug: hasan-sharif
ultravox_agent_id: f19b4ad7
voice_id: 87edb04c
plan: pro
tags: [client, real-estate]
related: [Features/Booking, Features/SMS]
updated: 2026-03-31
---

# Hasan Sharif — Aisha (Real Estate)

## Identity
| Field | Value |
|-------|-------|
| Slug | `hasan-sharif` |
| Ultravox Agent | `f19b4ad7` |
| Voice | Monika `87edb04c` — **NEVER change without --voice flag** |
| Plan | Pro |
| Niche | `real_estate` |

## Active Features
- [x] Booking → [[Features/Booking]] — calendar connected
- [x] SMS → [[Features/SMS]]
- [ ] Transfer
- [ ] IVR
- [x] Knowledge RAG → [[Features/Knowledge RAG]]

## Prompt Notes
- Agent name: Aisha
- NEVER change voice or tone without explicit ask
- Returning caller detection active
- Booking flow in CALENDAR BOOKING FLOW section

## Open Issues
- D198 — local SYSTEM_PROMPT.txt drifted from DB. Run `/prompt-deploy hasan-sharif`
- Hasan Calendar Tools: still n8n in production (not yet retired)

## Connections
- → [[Architecture/Control Plane Mutation]] (booking_enabled → patchCalendarBlock)
- → [[Features/Booking]] (calendar_auth_status = 'connected')
