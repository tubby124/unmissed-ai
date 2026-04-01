# Phase 7: Core Plan Agent Setup Flow
**Status:** In Progress  
**Date Started:** 2026-04-01  
**Last Updated:** 2026-04-01

---

## Overview
Completing the full onboarding and trial agent setup for **Core plan** users. The agent should function as a smart receptionist: greeting warmly, qualifying callers, collecting information, and (when Core+ with booking enabled) scheduling appointments via Google Calendar.

---

## Completed Work ✅

### 1. Slug Deduplication Fix
**File:** `/src/app/api/provision/trial/route.ts`  
**Issue:** Agent creation failed when email produced a slug that already existed  
**Solution:** Added deduplication logic that appends a random 4-character suffix when collision detected  
**Status:** ✅ Implemented and tested (user successfully created agent after fix)

### 2. Calendar Connect Banner Fix
**File:** `/src/components/dashboard/home/UnifiedHomeSection.tsx`  
**Issue:** Calendar Connect banner wasn't visible for Core+ trial users (even though that's exactly when they need it)  
**Root Cause:** `capabilities.hasBooking` returns `false` when calendar isn't connected yet  
**Solution:** Created `shouldShowCalendarBanner` variable that displays banner for Core+ users regardless of booking connection status  
**Status:** ✅ Implemented, build passing

### 3. Dashboard Component Architecture
All required dashboard components are fully built and functional:
- **AgentReadinessRow** (186 lines): 6-dimension readiness tracker with blocker/enhancer classification
- **BookingCalendarTile** (366 lines): Mini calendar + bookings table with Google Calendar connection flow
- **UnifiedHomeSection**: Orchestrates all home dashboard tiles with proper state management
- **KnowledgeInlineTile**: Knowledge base display
- **TestCallCard**: Call testing interface

---

## Current State 🔍

### Agent Provisioning
- ✅ Slug collision detection and deduplication working
- ✅ Trial agent creation now succeeds
- ✅ GBP (Google Business Profile) integration during onboarding stores business data
- ❌ **Not Yet Verified:** End-to-end Core plan provisioning flow

### Dashboard Visibility
- ✅ Calendar Connect banner displays for Core+ trial users
- ✅ AgentReadinessRow shows progress (e.g., "Agent readiness 5/6")
- ❌ **User Reported Missing:** Agent greeting flow, call handling qualification questions, name/phone collection

### Agent Behavior
- ❌ **Core Plan Agent Not Yet Verified:** Should execute this sequence:
  1. Greet warmly as the business
  2. Ask what caller is calling about (filtering question)
  3. Ask niche-specific qualifying questions (e.g., for print shop: type, quantity, timeline)
  4. Collect caller name and phone
  5. Transfer or take message

---

## Remaining Tasks 📋

### Phase 7a: Agent Behavior Validation (BLOCKING)
**Objective:** Verify Core plan agent actually performs the intended call handling

**Task 1:** Verify Core plan prompt/instructions
- Location: `/src/lib/prompt-helpers.ts` or `/src/lib/prompt-slots.ts`
- Check: Does Core plan have greeting → filter → qualify → collect → handoff flow?
- **Expected:** Should call `buildPrompt()` with Core-specific instructions for all 4 stages
- **Status:** 🔴 Unknown - needs verification

**Task 2:** Test Core agent call behavior
- Make a test call to the trial agent created on 2026-04-01
- Verify agent:
  - [ ] Greets warmly with business name
  - [ ] Asks "What are you calling about?"
  - [ ] Asks 2-3 niche-specific qualifying questions
  - [ ] Collects name and phone number
  - [ ] Appropriately closes or transfers
- **Status:** 🔴 Not yet tested

**Task 3:** Verify AgentReadinessRow dimensions link correctly
- All 6 dimension links should navigate to their config pages:
  - Hours → `/dashboard/actions#hours`
  - Routing → `/dashboard/settings?tab=agent#call-routing`
  - Services → `/dashboard/actions`
  - FAQs → `/dashboard/settings?tab=general#knowledge`
  - Calendar → `/dashboard/settings?tab=general#booking`
  - Knowledge → `/dashboard/settings?tab=general#knowledge`
- **Status:** 🔴 Links built but need validation

### Phase 7b: End-to-End Onboarding (VALIDATION)
**Objective:** Verify the complete onboarding → activation → dashboard flow works

**Task 4:** Verify onboarding flow captures all required data
- [ ] GBP import during step 1 (business name, hours, address)
- [ ] Plan selection displays Core as center option
- [ ] Plan selection step stores `call_handling_mode` correctly
- [ ] Activation step creates agent with all required fields

**Task 5:** Verify dashboard readiness progression
- Create fresh agent with no configuration
- Check readiness shows 0/6 complete
- Set Hours → readiness shows 1/6
- Set Services → readiness shows 2/6
- Set FAQs → readiness shows 3/6
- Set Routing (TRIAGE_DEEP) → readiness shows 4/6
- Verify "Fix this first" CTA always points to highest-priority incomplete item

**Task 6:** Verify Calendar Connect button for Core+ users
- For Core plan (non-booking mode):
  - [ ] No calendar dimension in readiness
  - [ ] Banner may show or not (depends on final design decision)
- For Core+ with `appointment_booking` mode:
  - [ ] Calendar dimension shows as blocker (red/amber)
  - [ ] "Connect Google Calendar →" banner is prominent
  - [ ] Clicking connects to Google Calendar flow
  - [ ] After connection, calendar dimension changes to done (green)

---

## Technical Debt / Known Issues 🐛

1. **Calendar Connect visibility logic** is conditionally rendered in UnifiedHomeSection
   - Only shows for Core+ users with certain conditions
   - May need UX refinement based on user testing

2. **Agent readiness progress** doesn't persist across page refreshes
   - Component receives props from API
   - Verify `/api/dashboard/*` endpoints return current state

3. **Booking calendar tile** shows "No appointments this month" when no bookings exist
   - Verify this doesn't confuse users (some may interpret as "not ready")

---

## Architecture Notes 📐

### Conditional Rendering Strategy
- **AgentReadinessRow:** Returns `null` when all 5-6 dimensions complete (hides the banner)
- **Calendar dimension:** Only included when `callHandlingMode === 'appointment_booking'`
- **BookingCalendarTile:** Three states: disabled → not-connected → active
- **Calendar banner:** Shows for Core+ users via new `shouldShowCalendarBanner` logic

### Feature Entitlements
- **Core plan:** Receptionist mode (greeting, qualifying, collecting info, no booking)
- **Core+ plan:** Receptionist + booking appointments via Google Calendar
- Trial users get all features regardless of plan for testing

### Key Prop Flow
```
UnifiedHomeSection
├── AgentReadinessRow (hoursWeekday, activeServicesCount, faqCount, calendarConnected, callHandlingMode, approvedKnowledgeCount, pendingKnowledgeCount, hasTriage)
├── BookingCalendarTile (hasBooking, calendarConnected)
├── KnowledgeInlineTile
├── TestCallCard
└── QuickConfigStrip
```

---

## Success Criteria ✨

When Phase 7 is complete:
1. ✅ Agent creation works without slug collision errors
2. ✅ Calendar Connect banner displays for Core+ trial users
3. 🔄 Core plan agent executes full receptionist greeting → qualify → collect flow
4. 🔄 AgentReadinessRow accurately tracks all 5-6 dimensions
5. 🔄 Dashboard guides user through setup with working "Fix this first" CTA
6. 🔄 All dimension links navigate to correct config pages
7. 🔄 Calendar connection flow works for Core+ with booking enabled

---

## Next Immediate Action

**Verify Core plan agent behavior** (Task 1 from Phase 7a):
1. Check `/src/lib/prompt-helpers.ts` for Core plan prompt definition
2. Verify it includes all 4 call stages: greeting → filter → qualify → collect
3. Make test call to trial agent to verify actual behavior matches specification

