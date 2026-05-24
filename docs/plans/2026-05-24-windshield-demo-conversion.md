# Windshield Demo Conversion Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn the polished windshield/auto-glass landing page into a live EndVoicemail conversion flow where a prospect submits name + phone + optional email/shop info, the demo agent calls them by name, demonstrates the real Windshield Hub triage pattern, and pushes them toward signup/onboarding.

**Architecture:** Keep the public page on a clean branch from `origin/main`; reuse the existing `/api/demo/call-me` route and `demo_calls` table rather than inventing a second call system. Add richer prospect intake to the widget/page, pass it into the call prompt, and optionally add Ultravox call stages through a stage-change tool only after the basic flow is stable.

**Tech Stack:** Next.js 16 app router, React 19, TypeScript, Supabase `demo_calls`, Twilio outbound calls, Ultravox calls/tools/stages, existing EndVoicemail components (`VoicePoweredOrb`, demo call tooling, `CallMeNowWidget`).

---

## Current Evidence

- `src/components/CallMeNowWidget.tsx` only asks for phone. It already supports sending `callerName` / `callerEmail` if the component provides them, because `/api/demo/call-me/route.ts` parses those fields.
- `/api/demo/call-me/route.ts` already:
  - normalizes/validates phone;
  - builds a live demo prompt;
  - injects `CALLER NAME`, `CALLER PHONE`, optional `CALLER EMAIL`;
  - signs the `/completed` callback;
  - creates Ultravox + Twilio outbound calls;
  - inserts into `demo_calls` with `caller_name`, `caller_phone`, `caller_email`, `ultravox_call_id`, `source`.
- `demo_calls.followup_sent_at` exists; the demo follow-up cron already sends follow-up when `caller_email` exists.
- Ultravox Call Stages docs confirm stages can change `systemPrompt`, `initialMessages`, `selectedTools`, voice, and more. Stages are triggered by a tool returning `X-Ultravox-Response-Type: new-stage`; stages inherit prior call properties unless overridden.

## Product Flow

1. Prospect lands on `/for-auto-glass` or `/windshield`.
2. Hero says: “Have the AI call you.”
3. Intake asks:
   - first name / name — required;
   - phone — required;
   - email — optional but strongly nudged for the follow-up summary;
   - shop name — optional;
   - current missed-call pain — optional select: “busy installs,” “after hours,” “too many junk calls,” “want quote triage.”
4. Prospect submits.
5. Aisha/EndVoicemail demo calls them by name: “Hey Ashley, this is the End Voicemail demo for auto glass shops…”
6. Call stage 1: warm onboarding/context. Confirm what they want to see and explain this is a short demo.
7. Call stage 2: simulated Windshield Hub triage. The agent asks auto-glass intake questions exactly like it would for their callers.
8. Call stage 3: owner-side reveal. Explain what the shop owner receives: Telegram/email summary, lead status, vehicle details, urgency, next step.
9. Call stage 4: conversion handoff. Ask if they want the free month and tell them setup is missed/busy forwarding, no number porting.
10. Post-call: `demo_calls` stores the call; follow-up email fires if email exists; internal dashboard/demo stats see the conversion.

## Task 1: Create Clean Public Route Shell

**Objective:** Add a route for the new windshield page without touching dashboard surfaces.

**Files:**
- Create or replace: `src/app/for-auto-glass/page.tsx`
- Optional create: `src/app/windshield/page.tsx` redirect or alias later
- Reuse: `src/components/ui/voice-powered-orb.tsx`

**Steps:**
1. Replace the current generic `NicheLandingPage` render for auto-glass with a dedicated page component.
2. Preserve metadata title/description/canonical.
3. Use the static page visual structure from `/root/hermes-output/windshield-landing-v2.html` but convert to JSX/Tailwind where practical.
4. Do not modify dashboard navigation, settings, outbound routes, or migrations in this task.
5. Run: `npm run build` if only route-level JSX changed; expected: build succeeds.

**Acceptance:** `/for-auto-glass` renders the new dark premium page with orb, live-call dashboard, waveform, Telegram alert, proof band, setup explanation, and price/offer.

## Task 2: Upgrade CallMeNowWidget Intake

**Objective:** Make the “AI call me” CTA collect enough info for the call to feel personal.

**Files:**
- Modify: `src/components/CallMeNowWidget.tsx`
- Modify if needed: `src/lib/marketing-content.ts`

**Steps:**
1. Add optional props:
   - `collectName?: boolean`
   - `collectEmail?: boolean`
   - `collectShopName?: boolean`
   - `collectPain?: boolean`
   - `variant?: 'default' | 'windshield'`
2. Add local state for `callerName`, `callerEmail`, `shopName`, `painPoint`.
3. Require name only when `collectName` is true.
4. Keep email optional but validate format if present.
5. Send request body:
   ```ts
   { phone: e164, niche, callerName, callerEmail, shopName, painPoint }
   ```
6. Keep existing compact mode backwards-compatible.
7. Run targeted build/type check.

**Acceptance:** Existing homepage widget still works; windshield widget collects name + phone and optional email/shop/pain.

## Task 3: Extend `/api/demo/call-me` Prospect Context

**Objective:** Pass shop context and pain point into the demo call prompt and store it safely.

**Files:**
- Modify: `src/app/api/demo/call-me/route.ts`
- Optional migration only if we decide to persist shop/pain as first-class columns; otherwise store in existing metadata/json if available or include only in prompt initially.

**Steps:**
1. Parse sanitized:
   - `shopName`
   - `painPoint`
2. Validate lengths; reject absurd payloads.
3. Extend prompt block:
   ```txt
   PROSPECT SHOP NAME: ...
   PROSPECT PAIN POINT: ...
   DEMO OBJECTIVE: give a short personalized demo, then simulate an auto-glass triage, then explain what the owner receives.
   ```
4. Avoid collecting sensitive data. Do not ask for customer PII during demo.
5. Keep `demo_calls` insert compatible with current schema.

**Acceptance:** Ultravox prompt has prospect name/email/shop/pain context; existing call path still logs to `demo_calls`.

## Task 4: Add Windshield-Specific Demo Prompt Layer

**Objective:** Make the agent call feel “holy shit, this knows my shop,” not generic AI receptionist.

**Files:**
- Modify: `src/lib/demo-prompts.ts`
- Possibly add: `src/lib/demo/windshield-demo.ts`

**Prompt shape:**

Stage-less MVP prompt:
```txt
You are Aisha from End Voicemail, calling {{callerName}} because they requested the auto-glass demo.
Start warm and concise. Reference their name and shop name if provided.
Explain this is a 2-minute demo: first you will show how the AI would answer a windshield caller, then explain what the owner receives.
Do not be robotic. Do not over-explain AI.
Collect no sensitive data.
If they ask how setup works: they keep their number; missed/busy/after-hours calls forward to their AI number; no porting.
If they sound interested: offer the free first month and tell them the next step is setup/onboarding.
After initial orientation, simulate a real Windshield Hub caller triage: chip/crack/replacement, year/make/model, urgency, location, insurance/cash, callback need.
Then reveal the summary the owner would get.
```

**Acceptance:** Demo agent opening uses caller name and feels purpose-built for auto glass.

## Task 5: Stage Tool Spike — Only If It’s Worth It

**Objective:** Validate Ultravox call stages before productionizing them.

**Files:**
- Create API tool route if needed: `src/app/api/demo/stage-transition/route.ts`
- Modify: `src/lib/ultravox.ts` or tool builder area
- Tests: add targeted test for tool payload shape if practical

**Ultravox doc facts:**
- Stage change is triggered by a custom tool returning header `X-Ultravox-Response-Type: new-stage`.
- Response body can include `systemPrompt`, `initialMessages`, `selectedTools`, etc.
- New stages inherit prior call properties unless overridden.
- If using stages, audit via `/api/calls/{call_id}/stages` and stage-centric messages/tools endpoints.

**Proposed stages:**
1. `intro_onboarding`
   - Goal: greet by name, explain demo, ask if they are ready.
2. `windshield_triage_simulation`
   - Goal: roleplay a real caller and ask quote/vehicle/damage questions.
3. `owner_summary_reveal`
   - Goal: explain Telegram/email summary and lead classification.
4. `conversion_handoff`
   - Goal: free month, setup steps, ask permission to send follow-up/start onboarding.

**Do not ship stages blindly.** First confirm the app’s existing tool registration can return custom headers cleanly. If not, keep MVP stage-less and write a tracker for the staged version.

**Acceptance:** Either stages work in a local/test call and are logged via stages endpoint, or MVP explicitly defers stages with a tracker item.

## Task 6: Post-Call Follow-Up Alignment

**Objective:** Make email follow-up match the call and landing page.

**Files:**
- Modify: `src/app/api/cron/demo-followup/route.ts`
- Optional: `src/lib/email/demo-followup.ts`

**Steps:**
1. Make email auto-glass aware if `demo_id` / niche is auto-glass.
2. Mention:
   - they requested the auto-glass demo;
   - setup = missed/busy/after-hours forwarding;
   - first month free;
   - $120/mo after, 250 minutes;
   - CTA to onboard/pay.
3. Keep unsubscribe / compliance posture sane for follow-up triggered by their request.

**Acceptance:** Email feels like a continuation of the call, not generic SaaS drip.

## Task 7: Internal Notification

**Objective:** Alert Hasan/Zara when a good prospect requests the call.

**Files:**
- Existing notification surface TBD after inspecting app notification helpers.
- Could start with DB/demo dashboard only; Telegram alert later if no helper exists.

**Acceptance:** Hasan can see who requested demo calls and whether email exists for follow-up.

## Task 8: Verification + Deploy

**Commands:**
```bash
cd /root/tmp/unmissed-ai
git status --short
git diff --name-status origin/main..HEAD
npm run build
npm run test:all
railway link --project endearing-adaptation -e production
railway up
curl -I https://endvoicemail.ai/api/health
curl -L -sS https://endvoicemail.ai/for-auto-glass?verify=windshield-demo | grep -i "Have the AI call"
```

**Acceptance:** Production route is live, health is 200, the new copy is present, and no dashboard/outbound protected files were touched unintentionally.

## Tracker Follow-Up

Create a tracker item if stages are not shipped in MVP:

`D435 — Ultravox staged demo-call journey for auto-glass conversion`

Required:
- stage transition API tool;
- stage-specific prompt blocks;
- stage audit UI/endpoint verification;
- fallback if stage transition fails;
- transcript + conversion analytics by stage.
