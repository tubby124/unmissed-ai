---
type: moc
tags: [index, project]
updated: 2026-04-01
cleaned: 2026-03-31
last-tracker-cleanup: 2026-03-31
---

# unmissed.ai — Project Knowledge Graph

> Voice agent SaaS. Railway + Ultravox + Twilio + Supabase + Next.js 15.

## Latest Session (2026-04-01 — Phase 7 Testing + Fixes)
- **Phase 7 Wave 1 DONE**: 3-step onboarding shipped (GBP → Plan → Launch)
- **Manual test found slug collision bug**: `true-color-display-printing-ltd` already existed → provision failed
- **Fix: slug dedup** — provision route now appends random 4-char suffix on collision
- **Fix: Calendar Connect banner** — now shows for Core/Pro/Trial users, not just `appointment_booking` mode
- **Fix: Setup progress** — calendar dimension counted for Core+ plans
- **Remaining**: AgentReadinessRow calendar dimension still gated on `appointment_booking` — needs same fix
- **Tier restructure**: Lite → **Call Catcher** ($49), Core → **AI Receptionist** ($119), Pro → **Front Desk Pro** ($229)
- Core now includes booking; Pro = IVR + transfer + volume for real companies
- See [[Architecture/Phase7-75-Second-Agent]] for full execution plan
- See [[Features/Plan Tiers and Gating]] for updated tier matrix
- **CRM Contacts + Calendar spec**: [[Architecture/Phase7-CRM-Contacts-Calendar]]
- **CRM Phase 0-2 DONE (2026-04-01):** D334 ✅ D335 ✅ D336 ✅ D337 ✅ D338 ✅

## Active Clients
- [[Clients/hasan-sharif]] — Hasan Sharif · Aisha · `f19b4ad7`
- [[Clients/exp-realty]] — Omar Sharif · Fatema · `c9019927`
- [[Clients/windshield-hub]] — Mark · Blake · `00652ba8`
- [[Clients/urban-vibe]] — Alisha · Ashley · `5f88f03b`
- [[Clients/manzil-isa]] — Fatima · Nour · TEST MODE
- [[Clients/plumber-calgary-nw]] — Test client · Dave · `d863d0c5` · plumbing niche

## System Map
- [[Architecture/Control-Plane Mutation Contract]] — how every field flows UI → DB → agent
- [[Architecture/Per-Call Context Contract]] — what gets injected per call vs stored
- [[Architecture/Call-Path Capability Matrix]] — which features work on which call path
- [[Architecture/Webhook Security and Idempotency]] — every webhook route audited
- [[Architecture/Phase7-75-Second-Agent]] — 75-second agent execution plan

## Features
- [[Features/Plan Tiers and Gating]] — Lite/Core/Pro entitlements matrix
- [[Features/Booking]] — calendar OAuth, tools, gating
- [[Features/Knowledge System]] — pgvector RAG, AI Compiler, seeding paths
- [[Features/SMS]] — sms_logs, opt-out, sendSmsTracked()
- [[Features/Transfer]] — HTTP transferCall → Twilio redirect → recovery
- [[Features/IVR]] — ivr_enabled, ivr_prompt, digit routing

## Decisions
- [[Decisions/Plan-Equals-Mode]] — selecting plan auto-derives agent mode
- [[Decisions/Overview-5-Tier-Layout]] — dashboard layout validated by Sonar research
- [[Decisions/Dashboard-Tab-Naming]] — "Overview" not "Agent Brain"

## Tracker
- Active D-items: see `.claude/rules/refactor-phase-tracker.md`
- Completed phases: see `docs/architecture/prompt-architecture-completed-phases.md`
