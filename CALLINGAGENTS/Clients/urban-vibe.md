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

## KB-Aware (PR #83/#84) — DEFERRED 2026-05-06

Status: **Eligible but not recomposed.** Urban Vibe is on the slot pipeline (post-D445), so the new kb-aware niche templates would apply cleanly. Dryrun shows clean +1,212 char delta, old route-everything rule stripped, safety preserved (see `CALLINGAGENTS/00-Inbox/dryrun-urban-vibe-kb-aware.json`).

**Why deferred:** Ray's current prompt works. Hasan's call: don't redeploy kb-aware unless there's a behavioral problem to fix. The 34 approved KB chunks remain retrievable via the universal `FORBIDDEN_ACTIONS` slot KB-priming on next dashboard save — just not via the niche-specific `For general building policies` framing until then.

**To resume:** Adapt `scripts/recompose-brian.ts` for slug `urban-vibe`. Ray's row is `hand_tuned=true` post-D445 — pass `forceRecompose=true` to override.

## Connections
- → [[Features/Booking]] (primary use case)
- → [[Decisions/Voice Personality Lock]] (Ashley voice = Ray's pick)
