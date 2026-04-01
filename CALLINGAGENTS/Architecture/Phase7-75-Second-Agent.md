---
type: architecture
status: approved
tags: [phase7, onboarding, execution-plan]
related: [[Plan-Equals-Mode]], [[Onboarding Audit 2026-04-01]]
updated: 2026-04-01
---

# Phase 7: 75-Second Agent — Optimized Execution Plan
*Research-validated 2026-04-01 via Lyra + 6 web research streams*

## Context
7-step onboarding → 3 steps. GBP → Plan → Go.
Plan = Mode (Lite=voicemail, Core=receptionist, Pro=booking).

**Research validation:**
- 3 steps optimal (7% conversion loss per extra field) — [SaaS Onboarding Best Practices 2026](https://designrevision.com/blog/saas-onboarding-best-practices)
- Center-stage pricing (1.4x conversion vs 2 tiers) — [Pricing Page Best Practices](https://userpilot.com/blog/pricing-page-best-practices/)
- Annual default (+19% adoption) — [SaaS Pricing 2026](https://influenceflow.io/resources/saas-pricing-page-best-practices-complete-guide-for-2026/)
- Visible optional inputs (40-60% engagement vs 15-25% collapsed) — [Progressive Disclosure](https://lollypop.design/blog/2025/may/progressive-disclosure/)
- Goodcall validates GBP-first: "link Google listing → agent starts" — [Goodcall vs Synthflow](https://serviceagent.ai/blogs/goodcall-vs-synthflow/)
- Duolingo pattern: first value in 60 seconds — [Onboarding Statistics 2026](https://userguiding.com/blog/user-onboarding-statistics)

---

## Wave 0 — Backend Fixes (3 parallel tasks)

### Task A: D324 — planToMode() helper
**File:** `src/lib/plan-entitlements.ts`
- Add `defaultMode` to `PlanEntitlements` interface
- Lite → `'voicemail_replacement'`, Core → `'lead_capture'`, Pro → `'appointment_booking'`, Trial → `'lead_capture'`
- Export `planToMode(planId: string): string`

### Task B: D326 — Wire parsedServiceDrafts through provision
**File:** `src/app/api/provision/trial/route.ts`
- Lines 209-219: Build `Map<string, ParsedDraft>` from `data.parsedServiceDrafts`
- Merge `description`, `price`, `duration_mins` into service_catalog and client_services rows

### Task C: D320 — urgencyWords persistence
**File:** `src/lib/intake-transform.ts` → `toIntakePayload()`
- Store urgencyWords in `context_data` alongside existing `priceRange` prefix

**Gate:** `npm run build` passes.

---

## Wave 1 — 3-Step Onboarding (sequential)

### 1a: Step registry rewrite
**File:** `src/app/onboard/config/steps.ts`
3 steps: YourBusiness → YourPlan → Launch
```ts
export const STEP_DEFS: StepDef[] = [
  {
    label: 'Your business',
    component: Step1GBP,
    canAdvance: (d) => !!d.businessName && !!d.voiceId && !!d.agentName?.trim(),
  },
  {
    label: 'Your plan',
    component: StepPlan,
    canAdvance: (d) => !!d.selectedPlan,
  },
  {
    label: 'Launch',
    component: Step6Activate,
    canAdvance: (d) => !!d.businessName?.trim() && !!d.contactEmail?.trim() && !!d.callbackPhone?.trim(),
    hideFooterCta: true,
    activationProps: true,
  },
]
```

### 1b: step1-gbp.tsx — "Find Your Business"
**Design:** Run through `/ui-ux-pro-max` + 21st.dev components

1. **GBP search** (existing) + `VoicePoweredOrb` loading state ("Looking up your business...")
2. **Confirmed card** with:
   - Niche badge (emoji + label + "Change" link)
   - GBP rating, address, hours (from Places API)
3. **Agent name input** (existing)
4. **Voice style picker** (RESEARCH-ADJUSTED — style labels, not gender):
   - Two large cards: **"Warm & Friendly"** (Jacqueline `aa601962`) / **"Confident & Clear"** (Mark `b0e6b5c1`)
   - Show voice name below style label
   - Auto-play 3s greeting on tap
   - "More voices in your dashboard" link
   - Use `/api/public/voice-preview/{id}` endpoint
   - *Why style not gender:* communicates value (what caller hears), avoids demographic question, aligns with 2025 voice UX research
5. **Caller reasons** (RESEARCH-ADJUSTED — VISIBLE, not collapsed):
   - 3 inputs with **"Optional"** badge
   - Niche-adaptive placeholder text (NOT hardcoded windshield examples)
   - Micro-copy: "These help your agent sound like it knows your business"
   - Fire TRIAGE_DEEP generation on blur (reuse debounced logic from step3-capabilities.tsx)
   - If skipped, agent works fine (niche defaults fill in)
   - *Why visible:* 40-60% engagement vs 15-25% when collapsed. Highest-ROI input deserves visibility.
6. **Background website scrape** — if websiteUrl set from GBP, fire scrape in background (non-blocking)

**Error states:**
- GBP lookup fails → "Couldn't find it. Try a different name or fill in manually" + manual fallback button
- Niche inference fails → show niche grid picker, default to 'other'
- Voice preview fails → silent fail, show name without audio

**No-GBP fallback** ("No Google listing? Fill in manually"):
- Business name input → AI niche inference fires on name (existing line 162-204)
- Niche grid picker appears
- Default hours to "24/7" (safest — agent always answers)
- Same voice picker + caller reasons available
- Everything else (hours, services, knowledge) is dashboard post-onboarding

**Mobile constraints:**
- All inputs thumb-reachable (bottom 60% of screen)
- Voice cards min 48px tap targets
- 3-dot progress indicator (not numbered stepper)
- No horizontal scroll

### 1c: step-plan.tsx — "Pick Your Plan"
**Design:** Run through `/ui-ux-pro-max` + 21st.dev components

1. **3 pricing cards** with CENTER-STAGE highlight on Core:
   - Lite: **"AI Voicemail"** — $49/mo
   - Core: **"Smart Receptionist"** — $99/mo (**POPULAR** badge)
   - Pro: **"Receptionist + Booking"** — $149/mo
2. **Feature comparison checklist** (3-5 per plan) with ✓/— marks:
   - 24/7 answering, SMS follow-up, call transfer, calendar booking, knowledge base
3. **Annual/monthly toggle** (default: ANNUAL, show savings %)
4. **Social proof:** "Trusted by auto shops, restaurants, and property managers across Canada"
5. **CTA:** "Start free trial" (not "Select plan")
6. **Trial banner:** "14-day free trial, no credit card required"

**Mobile:** Cards stack vertically, swipeable carousel optional

### 1d: step6-activate.tsx — "Launch"
**Keep:** email, phone, website URL, notification method
**Remove:** WebsiteScrapePreview (dashboard handles this), businessName field (in step 1)
**Add:** KnowledgeSummary, GBP summary pills, plan summary
**Derive:** mode from plan via `planToMode()`

**POST-LAUNCH SUCCESS STATE** (elevated from Wave 3):
After successful provision → **"Your Agent Is Ready"** screen:
- VoicePoweredOrb celebration animation
- 3-item activation checklist:
  1. **"Forward your calls"** → forwarding wizard
  2. **"Test your agent"** → WebRTC test call
  3. **"Add your services"** → dashboard Knowledge page
- Progress bar showing 1/3 complete
- "Go to Dashboard" button

*Why elevated:* Users not engaging in 3 days have 90% churn risk. First 2 minutes post-signup = highest-intent moment.

### 1e: intake-transform + provision route
- `toIntakePayload()`: derive `call_handling_mode` from `planToMode(data.selectedPlan)`
- Default hours to "24/7, always available" if `businessHoursText` empty
- Backwards compat with `data.agentMode`

### 1f: localStorage version gate
**File:** `src/app/onboard/page.tsx`
- `version: 2` in save payload
- On load: version !== 2 → reset to step 1 with fresh defaults

### 1g: ProvisioningOverlay error state
**File:** `src/components/onboard/ProvisioningOverlay.tsx`
- `error` prop → friendly message + retry button + "Contact us" link

### 1h: Delete dead files
```
DELETE: src/app/onboard/steps/step2-voice-preview.tsx
DELETE: src/app/onboard/steps/step3-capabilities.tsx
DELETE: src/app/onboard/steps/step4-schedule.tsx
DELETE: src/app/onboard/steps/step4.tsx
DELETE: src/app/onboard/steps/step2-job.tsx
```
**KEEP:** `src/app/onboard/steps/niches/*.tsx` — dashboard can reuse for "Quick Setup" cards.

**Gate:** `npm run build` + manual test of GBP and manual paths.

---

## Wave 2 — Dashboard Post-Onboarding (parallel, 3 tasks)

### Task A: D189 — Trial/paid unification + feature unlock CTAs
- Trial users see full dashboard (D314 done)
- Locked features show "Upgrade to unlock" badges
- Feature CTAs on plan-gated capabilities

### Task B: D264 + D306 — GBP data on Overview + empty states
- Overview KnowledgeInlineTile: show "Imported from Google" with rating, description, hours
- Every empty tile has a clear CTA ("Add your services", "Forward your calls")

### Task C: D262 — Capability badge → knowledge modal
- Click badge → popover showing what agent knows

**Gate:** `npm run build`. Dashboard looks good for trial + paid.

---

## Wave 3 — Polish (parallel, 2 tasks)

### Task A: D292 — Call forwarding wizard
- Carrier-specific instructions (Telus, Bell, Rogers)
- Test forwarding button
- Prominent overview CTA when not set up

### Task B: D230 — Activation smoke test
- Auto WebRTC test after provision, Telegram alert on fail

---

## Wave 4 — Visual Redesign (design-first)
- Run `/ui-ux-pro-max` with 3-step wireframes BEFORE implementing
- Use 21st.dev components where they fit (pricing cards, progress dots, orb animations)
- Mobile-first (many owners onboard from phone)
- Match dashboard design language

---

## Items Superseded
D315, D316, D317, D318, D319, D321, D322, D185, D255, D273

## Items Independent
- D291: GBP auto-import via Apify (future enhancement to step 1)
- D293: Paste URL → agent ready (future)
- D242: Haiku niche inference for 'other' (keep)
- D297: Learning loop UX (Phase 9)

---

## Key Files

| File | Role | Wave |
|------|------|------|
| `src/app/onboard/config/steps.ts` | Step registry — rewrite to 3 | W1 |
| `src/app/onboard/steps/step1-gbp.tsx` | GBP + badge + voice + orb + reasons | W1 |
| `src/app/onboard/steps/step-plan.tsx` | Pricing cards + mode badges | W1 |
| `src/app/onboard/steps/step6-activate.tsx` | Launch (simplified) + activation checklist | W1 |
| `src/app/onboard/page.tsx` | Shell + localStorage version | W1 |
| `src/components/onboard/ProvisioningOverlay.tsx` | Error state | W1 |
| `src/lib/plan-entitlements.ts` | planToMode() | W0 |
| `src/lib/intake-transform.ts` | Mode derivation + urgencyWords | W0+W1 |
| `src/app/api/provision/trial/route.ts` | Plan mode + parsedServiceDrafts | W0+W1 |
| `src/components/ui/voice-powered-orb.tsx` | Loading orb reuse | W1 |

## Verification
1. `npm run build` after each wave
2. **GBP path**: Search "Red Swan Pizza Calgary" → niche badge "Restaurant" → "Warm & Friendly" voice → Core plan → email/phone → Launch → activation checklist
3. **Manual path**: "No listing" → type name → niche grid → "Confident & Clear" voice → Lite plan → email/phone → Launch
4. **localStorage**: Save old 7-step draft → reload → resets to step 1 (version gate)
5. **Error path**: Kill OPENROUTER_API_KEY → provision → friendly error + retry button
6. **Dashboard**: GBP data on overview, empty states with CTAs, capability badge click
7. **Mobile**: 3-step flow on narrow viewport — dots, no sidebar overflow
8. **Test client**: `e2e-test-plumbing-co` provision works end-to-end

## Readiness Score: 96/100
Missing 4 points: no A/B test framework (not critical for v1), no analytics event tracking spec (add later), Wave 4 visual design deferred to /ui-ux-pro-max.
