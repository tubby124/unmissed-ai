# Flows Audit: endvoicemail.ai — Production Readiness for Auto-Glass Cold Campaign
**Generated:** 2026-06-10 | **Scope:** /audit flows (onboarding, prompt pipeline, first-10-minutes lead UX)
**Git branch:** main | **Last commit:** 879cca93 — fix(carrier_id): wire onboarding capture through dashboard + launch screen
**Working tree:** DIRTY — ~20 modified files uncommitted (see Section 4)
**Live prod verified:** / /onboard /for-auto-glass /pricing /try /login /privacy /terms all 200; prod CTAs → /onboard (NOT mailto)

---

## Executive Summary

The product is closer to campaign-ready than feared. The prompt update pipeline is sound:
dashboard save → Supabase `clients.system_prompt` → synchronous Ultravox PATCH in the same
request, with failure tracking (`last_agent_sync_status`) and Telegram alerts. Self-serve
onboarding works end-to-end on both trial (WebRTC agent live in ~10s, no card) and paid
(Stripe checkout → webhook → Twilio number in ~3-8s) paths. The biggest pre-campaign risk
is NOT the code in production — it's the uncommitted working tree, which replaces every
primary CTA with `mailto:hello@endvoicemail.ai` and deletes the homepage demo audio +
niche selector. Shipping that as-is would kneecap conversion at the exact moment cold
leads arrive. Second-biggest gap: the post-activation call-forwarding cliff (D292 wizard
not built) — trial users get a live agent but no carrier-specific guide to forward their
real number, and no confirmation email.

---

## 1. Flow: Self-Serve Signup → First Working Agent

**Entry:** `/onboard` (also `/onboard?niche=auto_glass` from /for-auto-glass)
**Wizard:** `src/app/onboard/page.tsx` + `src/app/onboard/steps/` — 5 steps:
business/GBP → niche+voice → call routing (carrier capture) → plan → launch
(email, phone, recording-consent gate). Draft persists in localStorage (`onboard_draft_v3`).

### Trial path (no card)
`POST /api/provision/trial` → creates `intake_submissions` + `clients` (status=setup) →
`buildPromptFromIntake()` (3-tier fallback, 25,300-char cap) → Ultravox `createAgent()`
(maxDuration 180s) → `activateClient(mode:'trial', trialDays:7)` → `syncClientTools()`.
- ✅ Agent live in ~5-10s, testable via WebRTC immediately.
- ❌ No Twilio number → no real PSTN calls until upgrade or manual forwarding setup.
- ❌ No confirmation email, no setup guide after the success screen.

### Paid path (Stripe)
`POST /api/stripe/create-public-checkout` (idempotent provisioning, optional number
reservation with 30-min CAS expiry) → Stripe Checkout → `checkout.session.completed`
webhook (`/api/webhook/stripe`) → `activateClient(mode:'stripe')` →
`ensureTwilioProvisioned()` (inventory or fresh purchase, configures webhooks) →
success page polls `GET /api/public/activation-status` every 4s (90s timeout).
- ✅ Fully self-serve, no founder steps. Number live ~3-8s post-payment.
- ⚠️ Twilio provisioning failure → customer sees "needs manual help"; operator gets Telegram.

### Breaks / manual steps (ranked)
| Gap | Severity |
|---|---|
| Call-forwarding setup post-activation: no per-carrier wizard (D292 NOT DONE), ForwardingDiagnostic.tsx stubbed, no "is forwarding working" test | **CRITICAL for trial, HIGH for paid** |
| Trial: no post-signup email / next-steps path → sign up, hear demo, never return | HIGH |
| `sms_enabled=true` on trial with no number → SMS tool silently fails; settings PATCH on `twilio_number` change doesn't re-run `syncClientTools()` (documented drift risk) | MEDIUM |
| Booking shown active before Google Calendar OAuth connected (fails gracefully) | LOW |

**Verdict:** a stranger CAN self-serve to a working agent. Paid path is clean. Trial path
has an invisible activation cliff at call forwarding.

---

## 2. Flow: Prompt Update Pipeline (dashboard → Supabase → Ultravox → live call)

**Editors:** `PromptEditorCard.tsx`, `SectionEditorCard.tsx`, `VoiceStyleCard.tsx` →
`usePatchSettings.ts` (serializes concurrent saves, SET-12) →
`PATCH /api/dashboard/settings` (`src/app/api/dashboard/settings/route.ts:167-484`).

**Chain (all in one request):**
1. Auth + Zod validation → `UPDATE clients SET system_prompt=...` (line ~275)
2. Knowledge reseed if facts/QA changed (pgvector, non-blocking)
3. Slot regeneration if niche vars/city changed (D283c/D276)
4. `computeNeedsSync()` → `syncToUltravox()` → `updateAgent()` PATCH to
   `api.ultravox.ai/api/agents/{id}` with full callTemplate + rebuilt tools (`src/lib/ultravox.ts:859-903`)
5. `last_agent_sync_at/_status/_error` recorded; Telegram alert on failure; `prompt_versions` audit row
6. Response returns fresh `system_prompt` + `ultravox_synced` (SET-13)

**Call time** (`src/app/api/webhook/[slug]/inbound/route.ts`): fresh SELECT from Supabase
every call; Agents API path injects `{{callerContext}}/{{businessFacts}}/{{contextData}}`
into the agent's stored prompt; fallback path inlines `system_prompt` into `createCall()`.

**Verdict: YES — a saved prompt is on the very next inbound call.** Sync is synchronous.
Drift only when the Ultravox PATCH fails (visible: amber banner + `last_agent_sync_status='error'` + Telegram).

**Fleet health check (run anytime):**
```sql
SELECT slug, last_agent_sync_status, last_agent_sync_at, last_agent_sync_error
FROM clients WHERE status='active' AND last_agent_sync_status <> 'ok';
```

**Known prompt-quality issue (separate from propagation):** 0% production hit rate on
queryKnowledge — 9 scattered instructions in 23K-char prompts get "lost in the middle"
(SESSION-HANDOFF P2). Tool registered, corpus populated; fix is instruction consolidation
in `src/lib/prompt-config/niche-defaults.ts`. Audit tooling exists:
`npx tsx tests/promptfoo/knowledge-routing/audit.ts --all`.

---

## 3. Flow: Cold Lead's First 10 Minutes (live prod, verified 2026-06-10)

- ✅ All routes 200: / /onboard /for-auto-glass /pricing /try /login /privacy /terms
- ✅ Live /for-auto-glass CTAs → `/onboard?niche=auto_glass` (2) + `/onboard` (2)
- ✅ Live homepage CTAs → `/onboard` (6) + `/try` (1)
- ⚠️ Demo `/api/demo/call-me`: infinite spinner on slow Twilio/Ultravox (no timeout/retry UI); 429 rate-limit returns raw JSON with no friendly message (10/IP/hour + global budget)
- ⚠️ Pricing page: prices without tier-to-feature mapping (D208 copy NOT STARTED)
- ⚠️ Demo agent is generic voicemail-replacement, not auto-glass-specific
- LOW: footer `hover:t1` dead Tailwind class; internal `unmissed_demo` niche id (invisible)

---

## 4. THE LANDMINE: Uncommitted Working Tree (verified via git diff)

Local changes NOT in prod that would crater the campaign if pushed as-is:
- `src/app/page.tsx` — primary CTA `/onboard` → `BOOK_WALKTHROUGH_HREF`; **deletes
  `DemoAudioPlayer` + `NicheSelectorGrid`**
- `src/app/for-auto-glass/page.tsx` — both `/onboard?niche=auto_glass` CTAs →
  `BOOK_WALKTHROUGH_HREF`
- `src/lib/booking.ts` — `BOOK_WALKTHROUGH_HREF` = `mailto:hello@endvoicemail.ai`
  (NOT a booking page)
- `next.config.ts` — 11 niche redirects (/for-trades → /for-auto-glass etc.) — good,
  but only if destination CTAs still onboard

This is a half-finished pivot from self-serve to concierge ("book a walkthrough").
Mailto at the highest-intent moment fails both models. **Decide one before the blast.**

---

## 5. Recommendations (priority order)

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Resolve the CTA pivot: keep `/onboard` primary, add "Book a walkthrough" as secondary (real booking link, not mailto). Commit or revert the WIP — don't email leads with a dirty tree you might accidentally ship | HIGH | LOW |
| 2 | Forwarding wizard or v0.5: post-activation screen + email with carrier-specific forwarding codes (carrier_id is already captured in onboarding — use it) | HIGH | MED |
| 3 | Trial confirmation email with setup link + "go live" steps (currently nothing) | HIGH | LOW |
| 4 | Demo widget resilience: 10s timeout → "try again" state; friendly 429 message | MED | LOW |
| 5 | Pricing tier-to-feature mapping (D208 copy) | MED | LOW |
| 6 | Run `audit.ts --all` knowledge-routing fleet check + consolidate queryKnowledge instructions before onboarding a wave of auto_glass clients | MED | MED |
| 7 | Fleet sync-status SQL check as pre-campaign gate (Section 2) | LOW | LOW |
