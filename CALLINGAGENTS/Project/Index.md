---
type: moc
tags: [index, project]
updated: 2026-03-31
---

# unmissed.ai — Project Knowledge Graph

> Voice agent SaaS. Railway + Ultravox + Twilio + Supabase + Next.js 15.

## Active Clients
- [[Clients/hasan-sharif]] — Hasan Sharif · Aisha · `f19b4ad7`
- [[Clients/exp-realty]] — Omar Sharif · Fatema · `c9019927`
- [[Clients/windshield-hub]] — Mark · Blake · `00652ba8`
- [[Clients/urban-vibe]] — Alisha · Ashley · `5f88f03b`
- [[Clients/manzil-isa]] — Fatima · Nour · TEST MODE

## Architecture Contracts (read-first gates)
- [[Architecture/Control Plane Mutation]] — how every settings field flows DB → Ultravox
- [[Architecture/Per-Call Context]] — what gets injected at call time vs stored in prompt
- [[Architecture/Call Path Matrix]] — capabilities per call type (PSTN / WebRTC / Demo)
- [[Architecture/Webhook Chain]] — inbound → completed → Telegram → billing full flow
- [[Architecture/Billing and Stripe]] — subscription tiers, tool gating, minute enforcement
- [[Architecture/Mode Architecture]] — call_handling_mode, D180 bug, PRIMARY GOAL fix
- [[Architecture/Prompt Generation]] — buildPromptFromIntake(), template structure, deploy paths

## Features
- [[Features/Booking]] — calendar auth, patchCalendarBlock, plan gating
- [[Features/SMS]] — sms_enabled, twilio_number, sendTextMessage tool
- [[Features/Transfer]] — forwarding_number, transferCall HTTP tool
- [[Features/IVR]] — ivr_enabled, ivr_prompt, Gather TwiML
- [[Features/Knowledge RAG]] — pgvector, knowledge_chunks, queryKnowledge tool
- [[Features/AI Compiler]] — compile/apply, trust tiers, BLOCKED_KINDS
- [[Features/Voicemail]] — buildVoicemailTwiml, recording upload, Telegram alert
- [[Features/Notifications]] — Telegram + email alerts, notification_logs

## Product & Dashboard
- [[Dashboard/Dashboard Architecture]] — all pages, home gaps, calls, knowledge, trial/paid split
- [[Dashboard/Settings Cards]] — 19 cards, what saves where, Ultravox sync table
- [[Product/Onboarding Flow]] — 7 steps, removed step 4, mode-first redesign
- [[Product/Intent Classification]] — root problem (info bots), 5-layer fix, D240-D245
- [[Product/Demo Agent]] — Zara, unmissed-demo v12, wow-first philosophy
- [[Product/Working Agent Patterns]] — 9 patterns from 4 live agents, 6 onboarding questions (D253 output)
- [[Product/Business Pain Map]] — per-niche pain map: Hasan/Omar/Sabbir/Ray, the 7 elements every agent needs
- [[Product/Injectable Variables Architecture]] — how TRIAGE_DEEP/context_data/knowledge flow from owner input → working agent. The self-serve loop.

## Operations
- [[Operations/Deployment]] — Railway build process, known failure causes, "DONE" definition
- [[Operations/Cron Jobs]] — 10 jobs, CRON_SECRET dependency, drift check
- [[Operations/Lead Classification]] — HOT/WARM/COLD/JUNK system, AI classification
- [[Operations/Environment Variables]] — all Railway env vars, dev vs prod delta

## Open Tracker (top priority)
> 🔴 = root fix — do before any marketing or new clients

- [[Tracker/D243]] — TRIAGE rewrite: intent-first structure 🔴
- [[Tracker/D247]] — ✅ DONE — 6 onboarding questions → Haiku → TRIAGE_DEEP (D254 companion: dashboard card)
- [[Tracker/D254]] — ✅ DONE — CallRoutingCard: post-onboarding caller reasons → regenerate TRIAGE_DEEP
- [[Tracker/D249]] — Agent readiness gate + score on home 🔴
- [[Tracker/D250]] — ROI card ("12 calls, 4 HOT leads, ~3hrs saved") 🔴
- [[Tracker/D251]] — Per-section prompt editor UI (self-serve fixes) 🔴
- [[Tracker/D245]] — Intent routing test on active clients (after D243)
- [[Tracker/D233]] — CRON_SECRET verify in Railway ⚠️ ops
- [[Tracker/D189]] — Unify trial/paid dashboard
- [[Tracker/D219]] — Missed call auto-SMS
- [[Tracker/D220]] — Lead queue / callback tracking
- [[Tracker/D229]] — "Call back now" button

## Decisions Log
- [[Decisions/n8n Retirement]] — why n8n was retired Mar 2026
- [[Decisions/Agents API vs createCall]] — toolOverrides pattern, initialState rejected
- [[Decisions/clients.tools as Runtime Source]] — why agent stored tools are overridden every call
- [[Decisions/Voice Personality Lock]] — never change voice/tone without explicit ask

## System Map
```
Caller → Twilio PSTN → /api/webhook/[slug]/inbound
         → buildAgentContext() + clients.tools
         → callViaAgent() [Agents API]
              → Ultravox stream ↔ Agent (system_prompt + tools)
                   → Tool calls → /api/webhook/[slug]/{transfer,sms,booking,knowledge}
         → POST-CALL: /api/webhook/[slug]/completed
              → AI classification (HOT/WARM/COLD/JUNK) → Telegram alert → billing
         → Stripe webhook → plan change → syncClientTools() → tool resync

Demo:
Visitor → /api/demo/start → createDemoCall() → WebRTC browser ↔ Zara (unmissed-demo)
```

---

## Live Queries (Dataview)

### Open Tracker Items
```dataview
TABLE priority, affects-clients
FROM "Tracker"
WHERE status = "open"
SORT priority DESC
```

### Active Clients
```dataview
TABLE ultravox_agent_id, plan, status
FROM "Clients"
WHERE type = "client"
SORT file.name ASC
```

### Recent Decisions
```dataview
TABLE date, status
FROM "Decisions"
SORT date DESC
```
