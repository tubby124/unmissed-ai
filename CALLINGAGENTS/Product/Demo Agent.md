---
type: product
status: active
tags: [product, demo, zara, ultravox]
related: [Architecture/Call Path Matrix, Architecture/Per-Call Context]
updated: 2026-03-31
---

# Demo Agent — Zara (unmissed-demo)

## Identity
| Field | Value |
|-------|-------|
| Agent slug | `unmissed-demo` |
| Ultravox agent ID | `74ccdadb` |
| Voice | Zara (Ultravox default warm female) |
| Current version | v12 (deployed 2026-03-30) |
| Revision | `c53ba68f` |

## What Zara Does
- Lives on the marketing site demo page (public)
- Demonstrates the unmissed.ai product to potential clients
- "Wow-first" philosophy: immediate demo experience, no qualifying interrogation
- Simulates a real inbound call for auto_glass, property_mgmt, real_estate niches

## Call Types (3 paths)

### 1. Browser Demo (public WebRTC)
- Visitor clicks "Talk to Agent" on marketing page
- POST `/api/demo/start` with `demoId=auto_glass|property_mgmt|real_estate`
- `createDemoCall()` — no tools, no logging to `call_logs`

### 2. Preview Mode (onboarding)
- New signup tests their own agent before going live
- POST `/api/demo/start` with `mode=preview` + `onboardingData`
- Prompt generated live from `buildPromptFromIntake()`

### 3. "Call Me" (phone demo)
- Visitor enters phone number → receives outbound call
- POST `/api/demo/call-me`
- Ultravox creates call, Twilio dials visitor's phone from `DEMO_TWILIO_NUMBER`

## Active Tools (v12)
1. `hangUp` — end the call gracefully
2. `sendSmsDemo` — demo SMS (fires to demo Twilio number)
3. `checkAvailabilityDemo` — fake calendar availability check
4. `bookAppointmentDemo` — demo booking (no real calendar)
5. `transferDemo` — demo transfer simulation

## Wow-First Philosophy
- Agent opens by naming the niche immediately
- Does NOT ask: "What's your name?" / "How can I help?" / "Where did you find us?"
- Guides caller to the demo, leads with capability
- Source: `memory/voice-naturalness.md` + `memory/feedback_demo_wow_first.md`

## Key Files
- `src/app/api/demo/start/route.ts` — main demo creation
- `src/app/api/demo/call-me/route.ts` — outbound demo
- `src/lib/demo-prompts.ts` — demo prompt content
- `src/lib/ultravox.ts` — `buildDemoTools()`, `createDemoCall()`
- `agent-app/docs/DEMO_PATH_PARITY.md` — parity doc for 3 demo paths

## Path Parity (vs Production)
| Feature | Demo | Production |
|---------|------|-----------|
| Tool registration | `buildDemoTools()` (capability-driven) | `buildAgentTools()` (plan-gated) |
| Context injection | Inline append (name/phone) | `templateContext` via Agents API |
| call_logs | `demo_calls` table | `call_logs` table |
| Billing | None | `seconds_used_this_month` incremented |
| Transfer | Simulated | Real Twilio redirect |
| Max duration | 600s | 600s |
