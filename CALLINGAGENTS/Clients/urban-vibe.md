---
type: client
status: active
slug: urban-vibe
ultravox_agent_id: 5f88f03b
voice_id: df0b14d7
plan: core
tags:
  - client
  - propertymanagement
related:
  - Features/Booking
updated: 2026-03-31
---

# Urban Vibe — Ray / Alisha (Beauty Salon)

## Identity
| Field | Value |
|-------|-------|
| Slug | `urban-vibe` |
| Ultravox Agent | `5f88f03b` |
| Voice | Ashley `df0b14d7` — **Ray's personal pick, sensitive to any tone drift** |
| Plan | Core |
| Niche | `beauty` |

## CRITICAL Rules
- Say "virtual assistant" NOT "AI assistant"
- Word "gotcha" is BANNED — forever, all agents
- DO NOT deploy until after test call confirms voicemail builder output (new buildVoicemailPrompt())

## Active Features
- [x] Booking → [[Features/Booking]]
- [ ] SMS
- [ ] Transfer
- [ ] IVR
- [ ] Knowledge RAG

## Open Issues
- ⚠️ PENDING DEPLOY — will get completely new prompt from buildVoicemailPrompt(). Verify first.

## Connections
- → [[Features/Booking]] (primary use case)
- → [[Decisions/Voice Personality Lock]] (Ashley voice = Ray's pick)
