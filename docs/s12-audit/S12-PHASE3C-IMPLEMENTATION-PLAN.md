# S12 Phase 3c — Trial Dashboard Experience: Master Implementation Plan

**Date:** 2026-03-22
**Status:** PLANNING COMPLETE — ready for phased execution
**Dependency:** S12 Phase 1 DONE, S13 DONE, S13.5 VERIFIED
**Parallel work:** SCRAPE1-3 (website scrape preview) — separate Claude instance

---

## Executive Summary

Trial users log into a dashboard that does nothing useful. No way to test their agent, no guided setup, no progressive disclosure. This is the #1 trial-to-paid conversion blocker.

**Three interconnected workstreams:**

| Workstream | What | Impact | Effort |
|------------|------|--------|--------|
| **3c-A: Onboarding Tour** | driver.js tooltips + enhanced checklist + empty states | Guides users through first 5 minutes | Medium |
| **3c-B: Agent Testing** | In-dashboard WebRTC orb for trial users | "Wow moment" — hear YOUR agent | Medium-High |
| **3c-C: Feature Gating** | Trial vs paid visual distinction + admin analytics | Reduces confusion, increases upgrade intent | Low-Medium |

**Key insight from research:** The checklist + empty states do 80% of the heavy lifting. The tooltip tour is supplementary. Build the checklist and empty states first, add the tour last.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Supabase Schema Changes](#2-supabase-schema-changes)
3. [Workstream A: Onboarding Tour](#3-workstream-a-onboarding-tour)
4. [Workstream B: Agent Testing (WebRTC)](#4-workstream-b-agent-testing-webrtc)
5. [Workstream C: Feature Gating](#5-workstream-c-feature-gating)
6. [File Map](#6-file-map)
7. [Execution Waves](#7-execution-waves)
8. [Integration with SCRAPE1-3](#8-integration-with-scrape1-3)
9. [Testing Strategy](#9-testing-strategy)
10. [Bundle Impact](#10-bundle-impact)

---

## 1. Architecture Overview

### Current State

```
Trial user → login → /dashboard/calls
                      ├─ OnboardingChecklist (HIDDEN — only shows for status='active')
                      ├─ OperatorActivity (empty — no calls)
                      └─ CallsList (empty — no calls)
```

**Problems:**
- `OnboardingChecklist` only renders when `clientStatus === 'active'` (line 115, `calls/page.tsx`)
- Checklist steps assume paid client: phone number, call forwarding, Telegram
- Dismiss is `useState(false)` — lost on page refresh, never persisted
- Zero trial-specific UI anywhere in the dashboard
- No way to test the agent without a phone number

### Target State

```
Trial user → login → /dashboard/calls
                      ├─ EnhancedOnboardingChecklist (ALWAYS shows for trial + active until completed)
                      │   ├─ Step 1: "Meet Your Agent" → WebRTC orb (TRIAL1)
                      │   ├─ Step 2: "Set Up Alerts" → Telegram wizard link
                      │   ├─ Step 3: "Train Your Agent" → Knowledge base link
                      │   ├─ Step 4: "Go Live" → Upgrade CTA
                      │   └─ Persistence: client_users.onboarding_state (Supabase)
                      ├─ AgentTestCard (NEW — embedded WebRTC orb for trial users)
                      ├─ ContextualEmptyStates (NEW — per-section hints)
                      ├─ driver.js tooltip tour (triggers on first login, optional)
                      └─ TrialFeatureGating (visual distinction for unavailable features)
```

### Component Dependency Graph

```
                    ┌─────────────────────┐
                    │  Supabase Migration  │
                    │  onboarding_state    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
   ┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
   │  useOnboarding() │ │ agent-test   │ │ Empty States     │
   │  React hook      │ │ API route    │ │ Components       │
   └────────┬─────────┘ └──────┬───────┘ └────────┬─────────┘
            │                   │                   │
            ▼                   ▼                   │
   ┌──────────────────┐ ┌──────────────┐           │
   │  Enhanced        │ │ AgentTest    │           │
   │  Checklist       │ │ Card         │           │
   └────────┬─────────┘ └──────┬───────┘           │
            │                   │                   │
            └───────────┬──────┘───────────────────┘
                        ▼
               ┌─────────────────┐
               │  driver.js Tour │  (last — depends on all targets existing)
               └─────────────────┘
```

---

## 2. Supabase Schema Changes

### Migration: `client_users.onboarding_state`

```sql
-- S12-TOUR: Add onboarding state tracking to client_users
ALTER TABLE client_users
ADD COLUMN onboarding_state jsonb DEFAULT '{
  "checklist_dismissed": false,
  "tour_completed": false,
  "tour_dismissed": false,
  "steps_completed": [],
  "tour_started_at": null,
  "tour_completed_at": null,
  "last_step_seen": null,
  "first_login_at": null,
  "test_call_count": 0
}'::jsonb;

-- Index for quick lookup (checklist rendering on every page load)
CREATE INDEX idx_client_users_onboarding
ON client_users (user_id)
WHERE onboarding_state IS NOT NULL;
```

### Step IDs (stable, never rename)

| Step ID | Label | Completion Condition | Available For |
|---------|-------|---------------------|---------------|
| `meet_agent` | Meet Your Agent | User completes a WebRTC test call | trial + active |
| `setup_alerts` | Set Up Alerts | `client.telegram_chat_id` is set | trial + active |
| `train_agent` | Train Your Agent | `approved_chunk_count > 0` | trial + active |
| `go_live` | Go Live | `client.status === 'active'` (paid) | trial only |

### API Route: `PATCH /api/dashboard/onboarding-state`

Updates `client_users.onboarding_state` for the authenticated user.

```typescript
// Request body
{
  action: 'complete_step' | 'dismiss_checklist' | 'dismiss_tour' | 'start_tour' | 'increment_test_calls'
  stepId?: string  // required for 'complete_step'
}
```

Auth: session user → `client_users` lookup → update own row only.

---

## 3. Workstream A: Onboarding Tour

### A1. Enhanced OnboardingChecklist (FIRST — most impact)

**Replace** `src/components/dashboard/OnboardingChecklist.tsx` with a trial-aware version.

**Key changes from current component:**
- Shows for BOTH `trial` and `active` statuses (not just `active`)
- 4 steps instead of 3 (trial-aware steps, not phone-centric)
- Dismiss persisted to Supabase (`onboarding_state.checklist_dismissed`)
- Auto-detects completion based on real data (Telegram, knowledge chunks, test calls)
- Steps adapt based on client status (trial shows "Go Live", active hides it)

**Props (new):**

```typescript
interface EnhancedChecklistProps {
  clientStatus: 'trial' | 'active' | 'paused'
  hasTestedAgent: boolean         // onboarding_state.test_call_count > 0
  telegramConnected: boolean      // existing
  hasKnowledgeDocs: boolean       // approved_chunk_count > 0
  isPaid: boolean                 // client.status === 'active'
  checklistDismissed: boolean     // onboarding_state.checklist_dismissed
  stepsCompleted: string[]        // onboarding_state.steps_completed
  userId: string                  // for PATCH call
}
```

**Visual design:**
- Keep existing Framer Motion animations (already polished)
- Keep existing progress bar + checkmark pattern
- Add: step action buttons (not just links) — "Test Now", "Connect", "Add Knowledge"
- Add: celebration animation on step completion (confetti micro-animation via CSS, no library)
- Add: "Re-launch tour" link in collapsed state

### A2. Empty State Components

Create reusable empty state components for each dashboard section.

**Pattern:** Card with icon + heading + description + CTA button. Consistent across all sections.

```
src/components/dashboard/EmptyState.tsx          — base component
src/components/dashboard/empty-states/
  NoCalls.tsx          — "No calls yet" + test agent CTA
  NoKnowledge.tsx      — "Your agent starts smart..." + add knowledge CTA
  NoNotifications.tsx  — "Stay in the loop" + connect Telegram CTA
  NoBookings.tsx       — "No bookings yet" + connect calendar CTA
```

**Integration points:**
- `CallsList.tsx` — when `calls.length === 0` AND `clientStatus === 'trial'`
- `SettingsPage` Knowledge tab — when `chunks.length === 0`
- `CalendarPage` — when `bookings.length === 0`
- `NotificationsTab` (future S10c) — when no notification_logs

### A3. driver.js Tour (LAST — supplementary)

**Install:** `npm install driver.js` (5KB, zero deps)

**Tour component:** `src/components/dashboard/OnboardingTour.tsx`

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

interface OnboardingTourProps {
  shouldStart: boolean           // first_login_at === null AND !tour_dismissed
  onComplete: () => void         // PATCH onboarding_state
  onDismiss: () => void          // PATCH onboarding_state
}
```

**Tour steps:**

| # | Target Element | Popover | Side |
|---|---------------|---------|------|
| 1 | `#agent-test-card` | "Meet your AI agent — click to start a test call and hear how it sounds" | bottom |
| 2 | `#onboarding-checklist` | "Track your setup progress here — each step makes your agent smarter" | right |
| 3 | `[data-tour="settings-link"]` | "Customize your agent's voice, personality, and knowledge" | right |
| 4 | `#upgrade-cta` (trial only) | "When you're ready, get a phone number and start taking real calls" | bottom |

**Trigger logic:**
1. First login detected: `onboarding_state.first_login_at === null`
2. Set `first_login_at` to now
3. Delay 2 seconds (let page render)
4. Start driver.js tour
5. On complete/dismiss → PATCH `onboarding_state`
6. Tour never auto-starts again (only manual re-launch from help menu)

**CSS override file:** `src/styles/driver-overrides.css`
- Dark theme popover matching our design system
- Custom font (Inter)
- Rounded corners matching our `rounded-2xl` pattern
- Progress dots instead of step counter

### A4. useOnboarding() Hook

Shared React hook for all onboarding state management.

```typescript
// src/hooks/useOnboarding.ts
export function useOnboarding(userId: string, initialState: OnboardingState) {
  const [state, setState] = useState(initialState)

  const completeStep = async (stepId: string) => { /* PATCH API */ }
  const dismissChecklist = async () => { /* PATCH API */ }
  const dismissTour = async () => { /* PATCH API */ }
  const startTour = async () => { /* PATCH API */ }
  const incrementTestCalls = async () => { /* PATCH API */ }

  return { state, completeStep, dismissChecklist, dismissTour, startTour, incrementTestCalls }
}
```

---

## 4. Workstream B: Agent Testing (WebRTC)

### B1. API Route: `POST /api/dashboard/agent-test`

**Purpose:** Create a WebRTC call for authenticated trial/active users to test their OWN agent.

**Auth:** Supabase session → `client_users` lookup → get `client_id` → get `clients.ultravox_agent_id`

**Key difference from `demo/start`:**
- Authenticated (session required) vs public
- Uses user's own `ultravox_agent_id` vs demo agent
- Uses `callViaAgent()` (Agents API) vs `createCall()` (direct)
- Rate limit: 20/user/hour (generous for testing) vs 10/IP/hour (demo)
- No global budget limit (authenticated = trusted)

**Request:**
```typescript
// No body needed — agent is determined from session
POST /api/dashboard/agent-test
```

**Response:**
```typescript
{
  joinUrl: string          // WebRTC connection URL
  callId: string           // Ultravox call ID
  agentName: string        // From clients.agent_name
  companyName: string      // From clients.business_name
}
```

**Implementation outline:**

```typescript
export async function POST(request: Request) {
  // 1. Session auth
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Get client via client_users
  const { data: cu } = await supabase
    .from('client_users')
    .select('client_id, clients(ultravox_agent_id, slug, business_name, agent_name, status, tools, niche)')
    .eq('user_id', user.id)
    .single()

  if (!cu?.clients?.ultravox_agent_id) {
    return NextResponse.json({ error: 'No agent configured' }, { status: 404 })
  }

  // 3. Rate limit (per user, not per IP)
  // 20/user/hour — SlidingWindowRateLimiter keyed on user.id

  // 4. Create call via Agents API
  const client = cu.clients
  const tools = Array.isArray(client.tools) ? client.tools : undefined
  const joinUrl = await callViaAgent({
    agentId: client.ultravox_agent_id,
    medium: { webRtc: {} },
    overrideTools: tools,
    metadata: { source: 'dashboard-test', userId: user.id, slug: client.slug }
  })

  // 5. Log as test call (call_logs with source='dashboard-test')
  // Fire-and-forget OK here — test call logging is not critical

  return NextResponse.json({
    joinUrl,
    callId: /* from callViaAgent response */,
    agentName: client.agent_name || 'Your Agent',
    companyName: client.business_name,
  })
}
```

**Tool handling during WebRTC test calls:**

| Tool | Works? | Notes |
|------|--------|-------|
| hangUp | Yes | Built-in |
| checkForCoaching | Yes | DB query only |
| queryKnowledge | Yes | pgvector query only |
| checkCalendarAvailability | Yes | Google Calendar API (if connected) |
| bookAppointment | Yes | Google Calendar API (if connected) |
| sendTextMessage | **Partial** | Needs `twilio_number` — trial users don't have one. Tool will fail gracefully. |
| transferCall | **No** | Needs `twilio_number` + `forwarding_number` — not available on trial. |

**Graceful tool failure:** The agent prompt should include a note: "If a tool fails during a test call, acknowledge the limitation naturally: 'In a live setup, I'd send you a text confirmation right now.'"

### B2. AgentTestCard Component

**Purpose:** Embedded WebRTC call interface in the dashboard for trial users.

**Location:** `src/components/dashboard/AgentTestCard.tsx`

**Design:** Reuse `DemoCallVisuals.tsx` components (VoiceOrb, WaveformBars, StatusBadge, TranscriptBubble, PostCallSummary). Do NOT duplicate — import from shared visuals.

**States:**
1. **Idle:** Card with VoiceOrb, "Test Your Agent" button, agent name + business name
2. **Connecting:** VoiceOrb pulsing, "Connecting..." status
3. **Active:** Full call UI — orb, waveform, transcript, timer (3-min limit for test calls)
4. **Ended:** Post-call summary card, "Test Again" button

**Key differences from DemoCall.tsx:**
- No `demoId` — uses authenticated `/api/dashboard/agent-test` route
- No 2-minute countdown — 3-minute limit for test calls (more time to explore)
- No post-call CTA to "Get My Agent Set Up" — user already has an agent
- Add: "Your agent used X tools during this call" post-call insight
- Add: on call complete, call `incrementTestCalls()` from `useOnboarding` hook
- Add: `id="agent-test-card"` for driver.js tour targeting

**Component structure:**

```typescript
interface AgentTestCardProps {
  agentName: string
  companyName: string
  clientStatus: 'trial' | 'active'
  onCallComplete?: () => void  // trigger checklist step completion
}
```

**Placement in dashboard:**
- Trial users: above CallsList, below EnhancedOnboardingChecklist
- Active users: collapsed to a "Test your agent" button in the header area
- Admin: not shown (admin has BrowserTestCall in lab)

### B3. Reuse Strategy

**DO reuse from DemoCallVisuals.tsx:**
- `VoiceOrb` — animated call orb
- `WaveformBars` — audio visualization
- `StatusBadge` — connection status display
- `CallTimer` — countdown timer
- `TranscriptBubble` — real-time transcript display
- `PostCallSummary` — post-call analysis card
- `EndCallButton` — end call control
- `createSoundCues` — audio feedback
- `useClassificationTags` — intent detection

**DO NOT reuse:**
- `DemoCall.tsx` itself — too coupled to demo flow (demoId, public API, post-call CTA)
- Classification rules specific to demo agents (auto_glass, property_mgmt, etc.)

**New shared code:** Extract common WebRTC session management into a hook:

```typescript
// src/hooks/useUltravoxCall.ts
export function useUltravoxCall(options: {
  apiEndpoint: string              // '/api/demo/start' or '/api/dashboard/agent-test'
  apiBody?: Record<string, unknown>
  maxDuration?: number             // seconds (default 180 for test, 120 for demo)
  onTranscript?: (entry: TranscriptEntry) => void
  onStatusChange?: (status: AgentStatus) => void
  onEnd?: (callId: string) => void
}) {
  // Shared: lazy SDK import, session management, transcript handling, cleanup
  // Returns: { start, end, status, transcripts, callId, secondsLeft, error }
}
```

This hook eliminates the 200+ lines of duplicated WebRTC session logic between DemoCall and AgentTestCard.

---

## 5. Workstream C: Feature Gating

### C1. Trial Feature Indicators

**Approach:** Light touch — don't block, just inform.

Add a shared `TrialBadge` component that shows next to features unavailable on trial:

```typescript
// src/components/dashboard/TrialBadge.tsx
export function TrialBadge({ feature }: { feature: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
      Paid plan
    </span>
  )
}
```

**Where to apply:**
- SMS settings toggle → `<TrialBadge feature="SMS follow-ups" />`
- Call forwarding field → `<TrialBadge feature="Call forwarding" />`
- Phone number display → "Get a phone number on the paid plan"

### C2. Upgrade CTA Card

```typescript
// src/components/dashboard/UpgradeCTA.tsx
// Persistent card in sidebar (trial only) with:
// - Minutes used this trial
// - Days remaining in trial
// - "Upgrade Now" button → /pricing or Stripe checkout
// - id="upgrade-cta" for driver.js tour targeting
```

### C3. Admin Trial Analytics (deferred)

Track in `onboarding_state`:
- `test_call_count` — how many WebRTC tests the user ran
- `steps_completed` — which checklist steps are done
- `first_login_at` — when did they first see the dashboard
- `tour_completed` — did they finish the tour

Admin can query `client_users.onboarding_state` to see trial engagement. Full analytics dashboard deferred to S12-TRIAL4.

---

## 6. File Map

### New Files

| File | Workstream | Purpose |
|------|-----------|---------|
| `src/hooks/useOnboarding.ts` | A | Onboarding state management hook |
| `src/hooks/useUltravoxCall.ts` | B | Shared WebRTC session management hook |
| `src/app/api/dashboard/agent-test/route.ts` | B | Authenticated WebRTC call creation |
| `src/app/api/dashboard/onboarding-state/route.ts` | A | Onboarding state PATCH endpoint |
| `src/components/dashboard/AgentTestCard.tsx` | B | In-dashboard WebRTC test interface |
| `src/components/dashboard/EmptyState.tsx` | A | Reusable empty state base component |
| `src/components/dashboard/empty-states/NoCalls.tsx` | A | Empty state for calls list |
| `src/components/dashboard/empty-states/NoKnowledge.tsx` | A | Empty state for knowledge base |
| `src/components/dashboard/empty-states/NoNotifications.tsx` | A | Empty state for notifications |
| `src/components/dashboard/empty-states/NoBookings.tsx` | A | Empty state for bookings |
| `src/components/dashboard/OnboardingTour.tsx` | A | driver.js tour wrapper |
| `src/components/dashboard/TrialBadge.tsx` | C | "Paid plan" feature badge |
| `src/components/dashboard/UpgradeCTA.tsx` | C | Sidebar upgrade card |
| `src/styles/driver-overrides.css` | A | driver.js dark theme CSS |
| `src/lib/__tests__/onboarding-state.test.ts` | A | Onboarding state unit tests |

### Modified Files

| File | Workstream | Change |
|------|-----------|--------|
| `src/components/dashboard/OnboardingChecklist.tsx` | A | Full rewrite → trial-aware, 4 steps, persistent dismiss |
| `src/app/dashboard/calls/page.tsx` | A+B | Show checklist for trial users, add AgentTestCard, add empty states |
| `src/app/dashboard/layout.tsx` | A+C | Pass `onboarding_state` to children, add UpgradeCTA to sidebar |
| `src/components/dashboard/Sidebar.tsx` | C | Add UpgradeCTA for trial users, add "Re-launch tour" link |
| `src/components/dashboard/CallsList.tsx` | A | Render NoCalls empty state when no calls + trial |
| `package.json` | A | Add `driver.js` dependency |

### NOT Modified (reused as-is)

| File | Why |
|------|-----|
| `src/components/DemoCallVisuals.tsx` | Import VoiceOrb, WaveformBars, etc. — no changes needed |
| `src/components/DemoCall.tsx` | Demo flow stays separate — different API route, different UX |
| `src/lib/ultravox.ts` | `callViaAgent()` already handles authenticated calls correctly |

---

## 7. Execution Waves

### Wave 0: Schema + Foundation (no UI) — 1 session

**Dependencies:** None
**Parallel safe:** Yes (no UI changes, no component conflicts)

| # | Task | Files | Est. |
|---|------|-------|------|
| 0.1 | Supabase migration: `onboarding_state` column | Migration SQL | 10 min |
| 0.2 | `useOnboarding()` hook | `src/hooks/useOnboarding.ts` | 30 min |
| 0.3 | `PATCH /api/dashboard/onboarding-state` route | `src/app/api/dashboard/onboarding-state/route.ts` | 30 min |
| 0.4 | Unit tests for onboarding state logic | `src/lib/__tests__/onboarding-state.test.ts` | 20 min |
| 0.5 | `EmptyState.tsx` base component | `src/components/dashboard/EmptyState.tsx` | 15 min |

**Ship gate:** Migration applied, API route returns 200, hook unit tests pass.

### Wave 1: Enhanced Checklist + Empty States — 1 session

**Dependencies:** Wave 0
**Parallel safe with SCRAPE1-3:** Yes (different files)

| # | Task | Files | Est. |
|---|------|-------|------|
| 1.1 | Rewrite `OnboardingChecklist.tsx` | Full rewrite | 60 min |
| 1.2 | Update `calls/page.tsx` to show checklist for trial users | Modify line 115 guard | 15 min |
| 1.3 | Create empty state variants (NoCalls, NoKnowledge, NoNotifications, NoBookings) | 4 new files | 30 min |
| 1.4 | Integrate NoCalls into CallsList | Modify `CallsList.tsx` | 15 min |
| 1.5 | `TrialBadge.tsx` component | New file | 10 min |
| 1.6 | `UpgradeCTA.tsx` component | New file | 20 min |
| 1.7 | Add UpgradeCTA to Sidebar (trial only) | Modify `Sidebar.tsx` | 15 min |

**Ship gate:** Trial user sees 4-step checklist on login, dismiss persists across sessions, empty states render.

### Wave 2: WebRTC Agent Testing — 1-2 sessions

**Dependencies:** Wave 0 (useOnboarding hook)
**Parallel safe with Wave 1:** Mostly (Wave 2 adds AgentTestCard to `calls/page.tsx` — coordinate with Wave 1 changes)

| # | Task | Files | Est. |
|---|------|-------|------|
| 2.1 | `POST /api/dashboard/agent-test` route | New route file | 45 min |
| 2.2 | `useUltravoxCall()` shared hook | New hook file | 60 min |
| 2.3 | `AgentTestCard.tsx` component | New component | 90 min |
| 2.4 | Integrate AgentTestCard into `calls/page.tsx` | Modify page | 15 min |
| 2.5 | Pass `onboarding_state` through layout → page | Modify `layout.tsx` | 20 min |
| 2.6 | Test call → auto-complete "Meet Your Agent" step | Hook integration | 15 min |

**Ship gate:** Trial user clicks "Test Your Agent" → WebRTC connects to their agent → transcript displays → post-call summary shows → checklist step auto-completes.

### Wave 3: driver.js Tour — 1 session

**Dependencies:** Wave 1 + Wave 2 (tour targets must exist in DOM)

| # | Task | Files | Est. |
|---|------|-------|------|
| 3.1 | `npm install driver.js` | `package.json` | 2 min |
| 3.2 | `driver-overrides.css` dark theme | New CSS file | 30 min |
| 3.3 | `OnboardingTour.tsx` component | New component | 45 min |
| 3.4 | Integrate tour into `calls/page.tsx` | First-login trigger | 15 min |
| 3.5 | Add "Re-launch tour" to help menu / sidebar | Modify Sidebar | 10 min |
| 3.6 | E2E test: tour flow | Playwright | 30 min |

**Ship gate:** First login triggers 4-step tooltip tour, tour state persisted, re-launchable from sidebar.

### Wave 4: Polish + Integration — 1 session

**Dependencies:** Waves 1-3

| # | Task | Files | Est. |
|---|------|-------|------|
| 4.1 | Mobile responsiveness audit (checklist → bottom sheet on <768px) | CSS | 30 min |
| 4.2 | SCRAPE integration: if knowledge chunks seeded from scrape, auto-complete "Train" step | Hook logic | 15 min |
| 4.3 | PostCallSummary enhancement: "Your agent used X tools" insight | Component | 20 min |
| 4.4 | Test call tool failure graceful messaging | Prompt addition | 15 min |
| 4.5 | Full E2E: trial signup → first login → tour → test call → checklist completion | Playwright | 45 min |

**Ship gate:** Full trial experience works on mobile + desktop, SCRAPE data surfaces correctly, E2E passes.

---

## 8. Integration with SCRAPE1-3

### 8.1 Reference Documents

| Document | Location | What it covers |
|----------|----------|----------------|
| SCRAPE findings | `docs/s12-audit/scrape-architecture-findings.md` | 11 sections: data flow gaps, type design, API route, UI component, chunk seeding, existing patterns, edge cases, testing, cost analysis, "Top 1% Builder Considerations" (11a-11o) |
| SCRAPE implementation plan | `~/.claude/plans/twinkly-wibbling-fountain.md` | 6 phases (A-F): types → API → UI → knowledge seeding → edge cases → verification |
| Phase 3c master plan | This document | Workstreams A-C, 4 execution waves |
| Tracker cross-ref | `.claude/rules/refactor-phase-tracker.md` → "Research & Plans Index" | Links all docs with status + notes |

### 8.2 Integration Matrix

| SCRAPE Item | SCRAPE Reference | Phase 3c Integration | Which Wave | Coordination |
|-------------|-----------------|---------------------|------------|--------------|
| SCRAPE1 (preview UI during onboarding) | Findings §3-5, Plan Phase A-C | No direct dashboard integration — happens on `/onboard` step 6 before user reaches dashboard | Pre-Wave 0 | None needed. SCRAPE1 UI is on `/onboard/steps/step6-review.tsx`, dashboard is `/dashboard/calls/page.tsx`. |
| SCRAPE2 (seed knowledge_chunks at activation) | Findings §6, Plan Phase D1-D2 | **Wave 1:** "Train Your Agent" step auto-completes when `approved_chunk_count > 0`. SCRAPE2 creates those chunks. | Wave 1.1 | `approved_chunk_count` is the shared interface. Both read the same DB column — zero code coupling. |
| SCRAPE3 (pre-populated KB on first login) | Findings §6, Plan Phase D3 | **Wave 1:** `NoKnowledge` empty state only renders when `chunks === 0`. If SCRAPE2 seeded chunks, user sees populated KB instead. | Wave 1.3 | Check `approved_chunk_count` (same as SCRAPE2). Also check `knowledge_backend` (must be `'pgvector'` — `syncClientTools` in Plan Phase D handles this). |
| SCRAPE4 (custom notes as chunks) | No research yet | **Wave 4.2:** If implemented, adds to the chunk count that Phase 3c checks. No extra work in Phase 3c. | Wave 4 | Same `approved_chunk_count` interface. |
| SCRAPE5 ("add more" CTA) | No research yet | **Wave 1.3:** `NoKnowledge` empty state CTA ("Add FAQs, upload docs...") ALREADY covers this. SCRAPE5's CTA is on `/onboard`, not dashboard. | Wave 1 | No conflict. Different pages, same user intent. |

### 8.3 Data Flow After Both Workstreams Complete

```
Onboarding (SCRAPE territory):
  Step 1: User enters website URL
  Step 6: SCRAPE1 shows editable preview cards (businessFacts, extraQa, serviceTags)
           User toggles approvedFacts[], approvedQa[]
           Data saved to OnboardingData.websiteScrapeResult (localStorage)
  Activate: SCRAPE2 seeds knowledge_chunks from approved items
            syncClientTools() registers queryKnowledge tool
            approved_chunk_count > 0 now

Dashboard (Phase 3c territory):
  First login: onboarding_state.first_login_at = null → trigger tour
               EnhancedChecklist renders with 4 steps
               Step 3 "Train Your Agent" checks approved_chunk_count
               If SCRAPE2 ran → step auto-completes (chunks > 0)
               If SCRAPE2 didn't run → NoKnowledge empty state shows
  Test call:   AgentTestCard → callViaAgent (TRIAL1)
               If queryKnowledge tool registered → agent can answer website facts
               Post-call: "Your agent used queryKnowledge" insight
```

### 8.4 Specific Cross-References to SCRAPE Findings

| Findings Section | Phase 3c Relevance |
|-----------------|-------------------|
| §1 (data flow gaps) | Understanding WHY trial users currently see empty knowledge. Motivates "Train Your Agent" step. |
| §3 (type design: `websiteScrapeResult`) | Not used by Phase 3c directly — lives in `OnboardingData` (localStorage), never reaches dashboard. |
| §6 (`embedChunks` + `syncClientTools`) | **CRITICAL dependency.** These calls create the `knowledge_chunks` rows that Phase 3c checks via `approved_chunk_count`. If §6 fails silently, Phase 3c "Train" step never auto-completes. Plan Phase D wraps in try/catch (non-blocking) — Phase 3c must NOT assume chunks exist. |
| §7 (existing patterns: `approve-website-knowledge`) | Confirms `syncClientTools()` call pattern. Phase 3c doesn't need to call it — SCRAPE handles tool registration. |
| §8-E3 (scrape failure graceful degradation) | If scrape fails, zero chunks seeded. Phase 3c `NoKnowledge` empty state kicks in — "Add FAQs, upload docs...". Correct fallback. |
| §8-E7 (activation failure rollback) | If activation fails AFTER chunks are seeded, chunks may be orphaned. Phase 3c is unaffected — no `client_users` row = redirect to `/onboard`. |
| §11f (natural language preview) | Could integrate with Phase 3c post-call summary: "Your agent already knows 12 things about your business from your website." Enhanced version of the "used X tools" insight in Wave 4.3. Deferred. |
| §11i (knowledge chunk vs prompt duplication) | Important context: website content appears BOTH in the system prompt (flattened text) AND as knowledge chunks (structured, searchable). The agent can answer questions from either source. Phase 3c's post-call "tools used" insight should note when `queryKnowledge` was called vs when the agent answered from prompt context. Complex — deferred to post-launch analytics. |
| §11n (partial chunk seeding error recovery) | If some chunks fail to embed, `approved_chunk_count` may be lower than expected. Phase 3c "Train" step still completes (count > 0), just with fewer chunks. No Phase 3c impact. |

### 8.5 Execution Ordering

SCRAPE and Phase 3c can proceed **in parallel** with one constraint:

```
SCRAPE Phase A-C (type + API + UI)   ← Can happen anytime. No Phase 3c dependency.
SCRAPE Phase D (chunk seeding)       ← Must be DONE before Phase 3c Wave 4.2 verification.
                                        Wave 0-3 don't need chunks to exist — they check dynamically.
Phase 3c Wave 0 (schema + hooks)     ← Independent of SCRAPE entirely.
Phase 3c Wave 1 (checklist + empty)  ← Reads approved_chunk_count. Works with 0 or N chunks.
Phase 3c Wave 2 (WebRTC test)        ← Independent. queryKnowledge tool may or may not be registered.
Phase 3c Wave 3 (driver.js tour)     ← Independent. Targets DOM elements from Wave 1+2.
Phase 3c Wave 4.2 (integration)      ← Verifies SCRAPE data surfaces correctly in checklist + test call.
```

**Coordination rule:** Both workstreams use `approved_chunk_count` as the shared interface. SCRAPE writes chunks → Phase 3c reads chunk count for step completion. No import/export coupling, no shared components, no deployment ordering constraint (except Wave 4.2 verification).

### 8.6 SCRAPE Verification via Phase 3c (Wave 4.2 Test)

SCRAPE Plan Phase F.1 step 6 says: *"Make a WebRTC test call → ask about something from the website → verify AI answers from knowledge."* This depends on Phase 3c's `AgentTestCard` (TRIAL1) being available.

**Verification sequence (Wave 4.5 E2E test):**
1. Create trial with a website URL that has clear facts (e.g., team members, services)
2. Activate trial → SCRAPE2 seeds chunks → `approved_chunk_count > 0`
3. Login to dashboard → "Train Your Agent" step shows as complete (green checkmark)
4. Click "Test Your Agent" → WebRTC connects → ask "What services do you offer?"
5. Agent should answer from knowledge chunks (not just prompt context)
6. Post-call summary should note `queryKnowledge` tool was used
7. Full chain verified: website scrape → chunk seeding → knowledge tool registration → WebRTC test → AI uses knowledge

---

## 9. Testing Strategy

### Unit Tests

| Test File | What |
|-----------|------|
| `onboarding-state.test.ts` | useOnboarding hook: step completion, dismiss, tour state, idempotent calls |
| `agent-test-route.test.ts` | Auth guard, rate limiting, callViaAgent invocation, error responses |

### Integration Tests

| Scenario | How |
|----------|-----|
| Trial user sees checklist | Playwright: login as trial user → assert checklist visible with 4 steps |
| Checklist dismiss persists | Playwright: dismiss → refresh → assert still dismissed |
| Agent test call | Playwright: click "Test Your Agent" → assert WebRTC connection (mock Ultravox) |
| Tour triggers on first login | Playwright: first login → assert driver.js popover visible |
| Tour does NOT re-trigger | Playwright: second login → assert no tour |

### Manual Verification

| Check | How |
|-------|-----|
| Real WebRTC call to own agent | Create trial, login, test call, verify agent responds with correct business name |
| Tool demonstration | During test call, ask about a knowledge doc → verify knowledge query works |
| Mobile checklist | Resize to 375px → verify bottom sheet layout |

---

## 10. Bundle Impact

| Addition | Size (gzipped) | Notes |
|----------|----------------|-------|
| `driver.js` | ~5 KB | Zero dependencies, tree-shakeable |
| `useOnboarding.ts` | ~1 KB | Pure React hook |
| `useUltravoxCall.ts` | ~2 KB | Shared session management |
| `AgentTestCard.tsx` | ~3 KB | Reuses DemoCallVisuals (already loaded) |
| `EnhancedChecklist` | ~3 KB | Replaces existing 166-line component |
| Empty state components | ~2 KB total | 4 lightweight cards |
| `driver-overrides.css` | ~1 KB | CSS only |
| **Total new code** | **~17 KB** | Compared to 30-50 KB for an all-in-one tour library |

`DemoCallVisuals.tsx` is already in the bundle (used by `/try` page) — no additional cost for reusing its components in the dashboard.

---

## Appendix A: Existing Component Inventory

### What we have (reuse, don't rebuild)

| Component | Location | What it does | Reuse for |
|-----------|----------|-------------|-----------|
| `DemoCallVisuals.tsx` | `src/components/` | VoiceOrb, WaveformBars, StatusBadge, CallTimer, TranscriptBubble, PostCallSummary, EndCallButton, createSoundCues, useClassificationTags | AgentTestCard (import visuals) |
| `DemoCall.tsx` | `src/components/` | Full demo call flow (public, demoId-based) | Reference for AgentTestCard architecture (don't import) |
| `BrowserTestCall.tsx` | `src/components/dashboard/` | Admin browser test call (simpler) | Reference for auth pattern |
| `OnboardingChecklist.tsx` | `src/components/dashboard/` | Current 3-step checklist (paid-only) | Rewrite in place |
| `SlidingWindowRateLimiter` | `src/lib/rate-limiter.ts` | Shared rate limiter | Agent test route rate limiting |
| `callViaAgent()` | `src/lib/ultravox.ts` | Agents API call creation | Agent test route call creation |

### What we build new

| Component | Purpose | Depends on |
|-----------|---------|-----------|
| `useOnboarding` | State management for checklist + tour | Supabase `onboarding_state` column |
| `useUltravoxCall` | Shared WebRTC session hook | `ultravox-client` SDK (already installed) |
| `AgentTestCard` | In-dashboard WebRTC test | `useUltravoxCall` + `DemoCallVisuals` |
| `OnboardingTour` | driver.js wrapper | `driver.js` (new dep) + all tour target elements |
| `EmptyState` + variants | Contextual hints | None |
| `TrialBadge` | Feature gating indicator | None |
| `UpgradeCTA` | Upgrade prompt | `clientStatus` from layout |

---

## Appendix B: Research References

| Document | Location | Key Finding |
|----------|----------|-------------|
| Tour library comparison | `docs/research-notes/s12-tour1-onboarding-library-research.md` | driver.js RECOMMENDED (5KB, React 19 safe, 25K stars) |
| Tour UX patterns | `docs/research-notes/s12-tour1-onboarding-tour-research.md` | Checklist + empty states > forced tours. 3x conversion with checklist. |
| Tour library decision | `docs/s12-audit/s12-tour-library-decision.md` | RESOLVED: driver.js for tooltips + custom React for checklist |
| Competitor WebRTC analysis | `docs/s12-audit/s12-trial1-competitor-webrtc-research.md` | Zero SMB competitors have in-browser testing. First-mover opportunity. |
| Ultravox Client SDK | `memory/ultravox-client-sdk-reference.md` | `joinUrl` bridge, UltravoxSession API, client tools |
| WebRTC component map | `memory/webrtc-component-architecture.md` | 3 existing components, shared visuals, API routes |
| Dashboard audit | `docs/s12-audit/client-dashboard-auth-report.md` | Auth flows work, RLS isolation solid, 8 sidebar items |
| Full S12 audit | `docs/s12-audit/AUDIT-REPORT.md` | Trial onboarding was completely broken (all C1-C9 fixed in Phase 1) |

---

## Appendix C: Decisions Log

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Tour library | driver.js (5KB) | NextStepjs (12KB), react-joyride (broken), Onborda (stale) | Smallest, most stable, no React version coupling |
| Persistence | Supabase `client_users.onboarding_state` jsonb | localStorage | Must survive browser clear, cross-device |
| WebRTC component | New AgentTestCard (imports visuals) | Reuse DemoCall directly | DemoCall too coupled to public demo flow |
| Shared hook | Extract `useUltravoxCall` | Copy DemoCall logic | Eliminates 200+ lines of duplication |
| Empty states | Custom React components | Library (empty-state-react) | Too simple to warrant a dependency |
| Checklist approach | 4 trial-aware steps | Expand current 3 steps | Current steps all assume paid client |
| Tour timing | First login + 2s delay | Immediate | Let page render first, don't block |
| Mobile checklist | Bottom sheet pattern | Sidebar collapse | Sidebar takes too much horizontal space on mobile |
