# S12 Phase 3c — Trial Onboarding Experience Tracker

**Created:** 2026-03-22
**Master plan:** `docs/s12-audit/S12-PHASE3C-IMPLEMENTATION-PLAN.md`
**Conflict zone:** Settings page cards are being modified in a parallel instance — DO NOT touch settings components.

---

## Research Summary (Sonar Pro — 2026-03-22)

### Conversion benchmarks
- SaaS trial-to-paid avg: 14-25%, improvable 20-40% with good onboarding
- 3-5 steps for self-serve SaaS, ordered by quick value delivery first
- Shorter Time-to-Value (TTV) = higher conversion — first "aha moment" is critical
- Post-aha CTAs convert 20-40% better than time-based nudges
- Support engagement during trial lifts conversions 45%
- Behavior-based emails + case studies boost rates 30% over time-based emails

### UX patterns to apply
- **Checklist:** 3-5 items max, start with quick wins (<30s), progress bar "2/5 complete"
- **Step states:** locked (grayed + lock icon), active (highlighted/glowing), complete (checkmark + scale-up animation)
- **Empty states:** Action-oriented copy ("No calls yet — test your agent"), illustrative icons, primary CTA
- **Celebrations:** Lightweight (<1s) confetti/checkmark on step completion, then "What's next?" prompt
- **Feature gating:** Non-blocking "Paid plan" badges, allow hover/preview, no hard blocks
- **Upgrade CTA:** Contextual post-activation, not popups. Copy: "Ready for more?" not "BUY NOW"
- **Persistence:** Progress survives sessions. Multi-channel nudges for abandons.

### Voice AI / telephony specific
- Zero competitors have in-browser testing (first-mover advantage)
- First-call experience IS the aha moment — prioritize it
- Track: activation rate (onboarding completion), feature adoption (test call count), TTV

---

## What's Already Done (pre-Phase 3c)

| Item | Status | Notes |
|------|--------|-------|
| `AgentTestCard.tsx` | DONE (committed) | Full WebRTC test orb with VoiceOrb, transcripts, retry |
| `useUltravoxCall.ts` | DONE (committed) | Shared hook: lazy SDK, mic permission, abort controller |
| `/api/dashboard/agent-test` | DONE (committed) | Auth + rate limit + callViaAgent + call_logs |
| Integration in `calls/page.tsx` | DONE (committed) | Shows for non-admin users with agent |

---

## Wave 0: Schema + Foundation

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 0.1 | Supabase migration: `client_users.onboarding_state` jsonb column | Migration SQL | **DONE** 2026-03-22 |
| 0.2 | `useOnboarding()` hook — state management + PATCH calls | `src/hooks/useOnboarding.ts` | **DONE** 2026-03-22 |
| 0.3 | `PATCH /api/dashboard/onboarding-state` route | `src/app/api/dashboard/onboarding-state/route.ts` | **DONE** 2026-03-22 |
| 0.4 | `EmptyStateBase.tsx` + 4 empty state variants | `src/components/dashboard/empty-states/` | **DONE** 2026-03-22 |

**Ship gate:** PASS. Migration applied, API returns 200, hook works, 5 empty state components built.

---

## Wave 1: Enhanced Checklist + Empty States + Gating

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | Rewrite `OnboardingChecklist.tsx` — trial-aware, 4 steps, persistent dismiss | Full rewrite | **DONE** 2026-03-22 |
| 1.2 | `TrialBadge.tsx` component | `src/components/dashboard/TrialBadge.tsx` | **DONE** 2026-03-22 |
| 1.3 | `UpgradeCTA.tsx` component | `src/components/dashboard/UpgradeCTA.tsx` | **DONE** 2026-03-22 |
| 1.4 | Update `calls/page.tsx` — show checklist for trial + active, knowledge check | Modified page | **DONE** 2026-03-22 |
| 1.5 | Integrate NoCalls into CallsList for trial users | Modified `CallsList.tsx` | **DONE** 2026-03-22 |
| 1.6 | Add UpgradeCTA to Sidebar (trial only) | Modified `Sidebar.tsx` + `layout.tsx` | **DONE** 2026-03-22 |
| 1.7 | Post-call enhancement: "What's next" guidance | Modified `AgentTestCard.tsx` | **DONE** 2026-03-22 |

**Ship gate:** PASS. Trial user sees 4-step checklist, dismiss persists across sessions, empty states render, post-call guides to next step, UpgradeCTA in sidebar. `tsc --noEmit` clean.

### Files Created (Wave 0+1)
- `src/hooks/useOnboarding.ts` — onboarding state hook with optimistic updates
- `src/app/api/dashboard/onboarding-state/route.ts` — GET/PATCH API
- `src/components/dashboard/empty-states/EmptyStateBase.tsx` — reusable base
- `src/components/dashboard/empty-states/NoCalls.tsx` — trial vs active variants
- `src/components/dashboard/empty-states/NoKnowledge.tsx`
- `src/components/dashboard/empty-states/NoNotifications.tsx`
- `src/components/dashboard/empty-states/NoBookings.tsx`
- `src/components/dashboard/TrialBadge.tsx` — non-blocking "Paid plan" badge
- `src/components/dashboard/UpgradeCTA.tsx` — sidebar upgrade card with collapsed state

### Files Modified (Wave 0+1)
- `src/components/dashboard/OnboardingChecklist.tsx` — full rewrite (4 steps, persistent dismiss, trial-aware)
- `src/app/dashboard/calls/page.tsx` — knowledge check, show checklist for trial + active
- `src/components/dashboard/CallsList.tsx` — NoCalls empty state for trial users
- `src/components/dashboard/Sidebar.tsx` — UpgradeCTA for trial users, `clientStatus` prop
- `src/app/dashboard/layout.tsx` — pass `clientStatus` to Sidebar
- `src/components/dashboard/AgentTestCard.tsx` — "What's next" post-call guidance

---

## Wave 2: Gap Filling + Auto-Completion

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2.1 | Auto-complete `meet_agent` checklist step on test call end | `AgentTestCard.tsx` + `useOnboarding.ts` | **DONE** 2026-03-22 |
| 2.2 | Smart "What's next" — only show incomplete steps in post-call guidance | `AgentTestCard.tsx` | **DONE** 2026-03-22 |
| 2.3 | Swap Calendar inline empty state for `NoBookings` component | `calendar/page.tsx` | **DONE** 2026-03-22 |
| 2.4 | Swap Notifications inline empty state for `NoNotifications` component | `notifications/page.tsx` | **DONE** 2026-03-22 |
| 2.5 | Record first login via `recordFirstLogin()` on checklist mount | `OnboardingChecklist.tsx` | **DONE** 2026-03-22 |
| 2.6 | Add `UpgradeCTA` to MobileNav for trial users | `MobileNav.tsx` + `layout.tsx` | **DONE** 2026-03-22 |
| 2.7 | Fix "Test now" dead button — anchor link to `#agent-test-card` | `OnboardingChecklist.tsx` + `AgentTestCard.tsx` | **DONE** 2026-03-22 |

**Ship gate:** PASS (2.1-2.7). Checklist auto-completes, empty states use reusable components, first login tracked, mobile CTA wired, "Test now" scrolls to card. `tsc --noEmit` clean.

### Files Modified (Wave 2)
- `src/components/dashboard/AgentTestCard.tsx` — useOnboarding integration, smart "What's next", `id="agent-test-card"`
- `src/components/dashboard/OnboardingChecklist.tsx` — recordFirstLogin on mount, "Test now" anchor fallback
- `src/app/dashboard/calendar/page.tsx` — NoBookings component swap
- `src/app/dashboard/notifications/page.tsx` — NoNotifications component swap
- `src/components/dashboard/MobileNav.tsx` — clientStatus prop, UpgradeCTA for trial
- `src/app/dashboard/layout.tsx` — pass clientStatus to MobileNav

---

## Wave 3: driver.js Tour (deferred — build after Waves 0-2)

| # | Task | Status |
|---|------|--------|
| 3.1 | `npm install driver.js` | NOT STARTED |
| 3.2 | `driver-overrides.css` dark theme | NOT STARTED |
| 3.3 | `OnboardingTour.tsx` component | NOT STARTED |
| 3.4 | Integration + first-login trigger | NOT STARTED |

---

## Wave 4: Post-Call Intelligence (deferred)

| # | Task | Status |
|---|------|--------|
| 4.1 | Post-call AI summary (reuse `/api/demo/summarize`) | NOT STARTED |
| 4.2 | "Your agent used X tools" insight in ended state | NOT STARTED |

---

## Wave 5: Celebration + Gating (deferred)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | "All done" celebration state before checklist vanishes | NOT STARTED | Congrats message + confetti, then auto-hide after 3s |
| 5.2 | `TrialBadge` integration on gated features | BLOCKED | Settings pages in conflict zone — do when conflict clears |
| 5.3 | `NoCalls` `onTestAgent` callback — client wrapper for scroll-to-card | NOT STARTED | Server→client boundary; needs wrapper component |
| 5.4 | Drip email for abandoned onboarding (Brevo + cron) | NOT STARTED | Research says +30% conversion; needs Brevo template + `first_login_at` check |

---

## Wave 6: Polish (deferred)

| # | Task | Status |
|---|------|--------|
| 6.1 | Mobile responsiveness audit | NOT STARTED |
| 6.2 | SCRAPE integration verification | NOT STARTED |
| 6.3 | E2E test: full trial flow | NOT STARTED |

---

## Checklist Step Design (4 steps)

| Step ID | Label | CTA | Complete when | Available for |
|---------|-------|-----|---------------|---------------|
| `meet_agent` | Meet your agent | "Test now" (inline button) | Test call completed OR real call received | trial + active |
| `setup_alerts` | Set up alerts | "Connect" → notifications tab | `telegram_chat_id` set | trial + active |
| `train_agent` | Train your agent | "Add knowledge" → knowledge tab | `knowledge_chunks.count > 0` | trial + active |
| `go_live` | Go live | "Get a number" (trial) / "Setup instructions" (active) | Has phone + is active | trial + active |

---

## Component Unification Strategy (Onboarding = Settings)

> Reference: `docs/settings-extraction-tracker.md` — full field map, extraction order, data flow

### Core Principle

Onboarding and settings edit the **same DB fields** via the **same API endpoint** (`PATCH /api/dashboard/settings`). They must share the same UI components.

```
Trial Onboarding          Settings Page (paid user)
  ┌──────────────┐         ┌──────────────┐
  │ HoursCard    │  ──────▶│ HoursCard    │  (same component, full view)
  │ (simplified) │         │              │
  └──────────────┘         └──────────────┘
  ┌──────────────┐         ┌──────────────┐
  │ VoiceStyle   │  ──────▶│ VoiceStyle   │
  │ (pick one)   │         │ (full editor)│
  └──────────────┘         └──────────────┘
```

### Rules

1. **Never build a separate onboarding component for a field that already has a settings card.** Use the settings card with a `mode="onboarding"` or `simplified` prop.
2. **`usePatchSettings` is the shared save hook** — onboarding uses it too.
3. **AgentTestCard (voice orb) is permanent** — not just for onboarding. All users (trial + paid) should be able to talk to their agent from the dashboard at any time.
4. **After conversion, nothing changes** — the settings page shows exactly what the trial user configured during onboarding. No migration, no re-entry.

### Reusable Settings Cards for Onboarding

From `docs/settings-extraction-tracker.md`, these already-extracted cards map directly to onboarding steps:

| Onboarding Step | Settings Card | Fields |
|-----------------|--------------|--------|
| Train your agent | `AdvancedContextCard` | `business_facts`, `extra_qa`, `context_data` |
| Train your agent | `KnowledgeEngineCard` | `knowledge_backend` |
| Set up alerts | (NotificationsTab) | `telegram_bot_token`, `telegram_chat_id` |
| Meet your agent | `AgentTestCard` | (fires test call, no field save) |
| Go live | `SetupCard` (Wave 2 extraction) | `forwarding_number`, `transfer_conditions` |

### Cards NOT needed for onboarding (admin/advanced only)

- `SectionEditorCard` — admin prompt editing
- `AgentConfigCard` — admin sync/model info
- `WebhooksCard` — admin webhook URLs
- `GodModeCard` — admin Telegram/Twilio/timezone
- `PromptEditorCard` / `AIImproveCard` / `PromptHistoryCard` — admin prompt management

---

## Wave 7: Agent Preview + Self-Service (future)

> All users (trial + paid) should be able to talk to their agent from the dashboard to hear what callers experience.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | Make AgentTestCard permanent for all user types (not just onboarding) | NOT STARTED | Currently shows for non-admin with agent. Should be accessible from settings or a dedicated "Test" page for paid users too (e.g. Windshield Hub owner wants to hear their agent). |
| 7.2 | Post-test-call feedback capture — "What would you change?" | NOT STARTED | After hearing the agent, user can note revision requests. Store as `revision_requests` or similar. |
| 7.3 | Agent self-update via conversation (future) | NOT STARTED | User talks to orb and requests changes. Agent is **scope-aware** — knows its own toolset (call forwarding, SMS, booking, IVR, knowledge base, hours, voicemail). If the request is within scope (e.g. "add info about our new roofing service", "enable SMS", "change my hours"), agent confirms it can do that and queues the change. If outside scope, agent says so. User sees a pending changes list and approves before anything applies. Requires: capability registry, intent detection, change proposal UI, approval flow. |

---

## Wave 8: Conversion Optimization (discovered gaps)

> These gaps were identified from analyzing the current trial UX against SaaS conversion best practices.

| # | Task | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 8.1 | **Trial countdown** — "X days left" badge in sidebar + checklist | HIGH | NOT STARTED | Every SaaS trial shows expiration. #1 urgency driver. Needs: `trial_started_at` or `trial_expires_at` on `clients` table. Display in sidebar header + checklist footer. |
| 8.2 | **Simplified trial nav** — hide/dim empty pages during trial | MEDIUM | NOT STARTED | Trial users see Live, Insights, Calendar, Notifications — all empty. Hide or gray-out until relevant data exists. Reduces confusion, focuses attention on checklist steps. |
| 8.3 | **Before/after training comparison** — prompt re-test after knowledge add | MEDIUM | NOT STARTED | After user adds FAQs/knowledge, show "Your agent just got smarter — test again to hear the difference." Link back to AgentTestCard. Ties training to visible outcome. |
| 8.4 | **Trial admin funnel** — admin view of trial user engagement | HIGH | NOT STARTED | Dashboard for admin: which trial users tested agent, which step they're stuck on, days remaining, last login. Enables proactive outreach. Needs: aggregate `onboarding_state` across all trial `client_users`. |
| 8.5 | **Suggested test prompts** — guided scenarios during test call | MEDIUM | NOT STARTED | Pre-call or during-call suggestions: "Try asking about pricing", "Ask to book an appointment", "Call after hours". Shows capabilities without user guessing what to say. Could be niche-specific. |
| 8.6 | **Shareable demo link** — let trial user share agent with partner | LOW | NOT STARTED | Generate a time-limited link that lets a non-authenticated person hear the agent. Decision-makers often consult partners. Needs: public demo endpoint with rate limiting. |
| 8.7 | **Contextual help per step** — "Need help?" tied to checklist items | MEDIUM | NOT STARTED | Each checklist step gets a help tooltip or expandable FAQ. "Train your agent" → "What kind of info should I add?" Advisor bubble could be step-aware. Research: support engagement = +45% conversion. |
| 8.8 | **Usage/minutes transparency** — show plan limits and usage | LOW | NOT STARTED | Trial: "You've used 2 of 5 test calls". Active: "142 of 500 minutes used this month". Needs: `monthly_minute_limit` is already on `clients` table, just not surfaced in dashboard. |

### BUG: Trial minute limit is 100 instead of 50

**Location:** `src/lib/niche-config.ts:70` — `DEFAULT_MINUTE_LIMIT = 100`
**Problem:** `getNicheMinuteLimit()` returns 100 for all niches (except voicemail=50). Trial users get 100 minutes but `pricing.ts` SETUP says "50 free minutes included".
**Fix:** Add `TRIAL_MINUTE_LIMIT = 50` to pricing.ts or niche-config.ts. Use it in `activate-client.ts` and `stripe/route.ts` when provisioning trial clients. On paid conversion (Stripe webhook), upgrade to `BASE_PLAN.minutes` (100).

---

## Conflict Zones (parallel instance)

**DO NOT TOUCH:**
- `src/components/dashboard/settings/*` — being modified in another instance
- `src/app/dashboard/settings/page.tsx` — being modified in another instance
- `src/app/api/dashboard/settings/route.ts` — being modified in another instance

**SAFE TO MODIFY:**
- `src/components/dashboard/OnboardingChecklist.tsx`
- `src/app/dashboard/calls/page.tsx`
- `src/components/dashboard/AgentTestCard.tsx`
- `src/components/dashboard/CallsList.tsx`
- `src/components/dashboard/Sidebar.tsx` (only add UpgradeCTA)
- New files in `src/components/dashboard/empty-states/`
- New files in `src/hooks/`
- New API routes in `src/app/api/dashboard/`
