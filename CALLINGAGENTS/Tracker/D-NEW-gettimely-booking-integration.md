---
type: tracker
status: in-progress
priority: P1
phase: Phase-7-Onboarding
related:
  - Architecture/Control-Plane-Mutation-Contract
  - Features/Booking
  - Tracker/D374
opened: 2026-05-05
owner: Hasan
---

# D-NEW — Gettimely booking provider integration (extends Booking → multi-provider)

## Status
**IN-PROGRESS** — Phase 1A scaffolding shipped on `feat/booking-provider-abstraction`. No production redeploys until Phase 1B test call passes on Nofal's account.

## Why this exists
First barbershop client (Nofal Barber, Saskatoon) uses **Gettimely** (`bookings.gettimely.com/nofalbarber`) as their booking system, not Google Calendar. Today the booking pipeline only supports Google Calendar OAuth — `clients.google_refresh_token` is the single auth path. Voice agent currently has no way to read Nofal's availability or write a confirmed booking.

Gettimely → Google Calendar sync is one-way (Gettimely pushes out, doesn't pull in), so a "just sync to Google Calendar" workaround can read availability but cannot create confirmed Gettimely appointments. Busy operators (barber cutting hair) cannot tap-confirm 15× per day.

## Problem
- One booking provider hard-coded across the stack:
  - DB: `clients.google_refresh_token`, `clients.google_calendar_id`, `clients.calendar_auth_status`
  - OAuth: `/api/auth/google` → `/api/auth/google/callback`
  - Tool routes: `/api/calendar/[slug]/slots`, `/api/calendar/[slug]/book` directly call `lib/google-calendar.ts`
  - UI: BookingCard shows only "Connect Google Calendar"
- No salon/barber/spa booking integration. Any non-Google booking system is a manual-handoff niche.

## Goal
Add **Gettimely** as a second booking provider behind the same tool names (`checkCalendarAvailability`, `bookAppointment`) so the agent prompt and Ultravox tool registration are unchanged. Generalize the architecture so Vagaro, Acuity, Square Appointments, Booksy can plug in later via the same dispatcher.

## Mutation classification
- `clients.booking_provider` (text, default `'google'`) — `DB_ONLY` (no prompt impact, no agent sync — tool URLs don't change)
- `clients.gettimely_account_id`, `clients.gettimely_refresh_token`, `clients.gettimely_staff_id`, `clients.gettimely_service_map jsonb` — `DB_ONLY` (auth + mapping only)
- `clients.calendar_auth_status` — already exists, semantics broadened to "any provider connected"
- `clients.booking_enabled` — unchanged class (`DB_PLUS_PROMPT_PLUS_TOOLS`). Tool URLs stay `/api/calendar/[slug]/{slots,book}` — the route dispatches to the provider internally.

## Phase plan

### Phase 1A — Scaffolding (this branch)
- [x] Branch `feat/booking-provider-abstraction` off `origin/main`
- [x] DB migration: add `booking_provider`, Gettimely auth columns. Backfill existing rows where `calendar_auth_status='connected'` to `booking_provider='google'` for byte-identical behavior.
- [x] Provider abstraction lib: `src/lib/booking-providers/{types,google,gettimely,index}.ts` — Google adapter wraps existing `lib/google-calendar.ts` (no logic change). Gettimely adapter throws 501 with `provider_not_implemented` reason.
- [x] OAuth route stubs: `/api/auth/gettimely/{,callback}` return 501 with helpful redirect
- [x] BookingCard: provider dropdown (Google = working, Gettimely = "coming soon" with disabled connect)
- [x] Admin Integrations page: `/dashboard/admin/integrations` — per-client booking_provider + connection status table
- [x] Settings PATCH route + FIELD_REGISTRY accept `booking_provider`
- [x] capability-flags: provider-agnostic `hasBooking` (already correct — derives from `booking_enabled` + `calendar_auth_status` + plan)
- [x] Plan + cold-start doc

**No production redeploys. No Ultravox tool changes. No prompt changes. No live tool route refactor.**

### Phase 1B — Refactor + Gettimely API (next session)
- [ ] Refactor `/api/calendar/[slug]/slots` and `/book` routes to use `getBookingProvider(client)` dispatcher
- [ ] Implement Gettimely OAuth (real `/api/auth/gettimely` redirect to `https://api.gettimely.com/oauth/authorize`)
- [ ] Implement Gettimely callback — store refresh token + staff selection
- [ ] Implement Gettimely availability lookup (`GET /booking/staff/{staffId}/times`)
- [ ] Implement Gettimely booking creation (`POST /booking/bookings`)
- [ ] Service catalog → Gettimely service ID mapping (`gettimely_service_map`)
- [ ] Add `gettimely_access_token` refresh helper in provider lib
- [ ] Test on Nofal Barber account (test mode → live)

### Phase 1C — Post-booking SMS confirmation hook
- [ ] After successful `bookAppointment` (any provider) → send Twilio SMS to caller with provider's reschedule URL
- [ ] Hook into existing `sendSmsTracked()` path in `/api/calendar/[slug]/book/route.ts`
- [ ] Per-provider reschedule URL builder (Google: confirmation email handles it; Gettimely: deep-link to bookings page)

### Phase 1D — Vagaro / Acuity / Square Appointments
- [ ] Same dispatcher pattern, additional adapter files
- [ ] Provider chooser shows all 4 once each adapter is real

## Surface area

### Created
- `supabase/migrations/20260505000000_add_booking_provider.sql`
- `src/lib/booking-providers/types.ts`
- `src/lib/booking-providers/google.ts`
- `src/lib/booking-providers/gettimely.ts`
- `src/lib/booking-providers/index.ts`
- `src/app/api/auth/gettimely/route.ts`
- `src/app/api/auth/gettimely/callback/route.ts`
- `src/app/dashboard/admin/integrations/page.tsx`
- `CALLINGAGENTS/00-Inbox/gettimely-integration-plan.md`
- `CALLINGAGENTS/00-Inbox/NEXT-CHAT-Gettimely-Phase-1B.md`

### Modified
- `src/lib/settings-schema.ts` — add `booking_provider` to FIELD_REGISTRY + zod
- `src/components/dashboard/settings/BookingCard.tsx` — provider dropdown
- `src/app/api/dashboard/home/route.ts` — surface `booking_provider` to capabilities (read-only)

### Untouched (intentional)
- `src/lib/ultravox.ts` (`buildAgentTools`, `buildCalendarBookingTools`) — tool names + URLs unchanged
- `src/lib/prompt-patcher.ts` (`patchCalendarBlock`) — prompt text unchanged
- `src/app/api/calendar/[slug]/{slots,book}/route.ts` — Phase 1B refactors these
- `src/app/api/auth/google/{,callback}/route.ts` — google flow unchanged; callback already writes `calendar_auth_status='connected'`. Phase 1A migration sets `booking_provider='google'` for those rows.

## Acceptance criteria — Phase 1A
- [x] `npm run build` passes
- [x] `npm run typecheck` passes
- [ ] Existing 4 deployed clients: `booking_provider='google'` written by migration, behavior identical pre/post (no redeploy)
- [x] BookingCard renders provider dropdown when admin or `calendar_beta_enabled=true`
- [x] Gettimely "Connect" button shows `Coming soon — Phase 1B` and is disabled
- [x] Admin Integrations page lists every client with their provider + connection state
- [x] D-item committed; PR opened as draft

## Acceptance criteria — Phase 1B (deferred)
- [ ] Nofal Barber connects Gettimely OAuth → `gettimely_refresh_token` saved
- [ ] Test call books a real appointment in Nofal's Gettimely → appointment shows in his Gettimely dashboard
- [ ] No regression on existing 4 Google Calendar clients

## Connections
- → [[Architecture/Control-Plane-Mutation-Contract]] — `booking_provider` + Gettimely auth fields classified DB_ONLY
- → [[Features/Booking]] — provider abstraction added under existing booking surface
- → [[Tracker/D374]] — calendar connect → auto-upgrade prompt; will fire for any provider once Phase 1B ships
