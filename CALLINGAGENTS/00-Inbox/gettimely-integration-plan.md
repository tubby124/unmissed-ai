---
type: plan
status: in-progress
phase: Phase-7-Onboarding
related:
  - Tracker/D-NEW-gettimely-booking-integration
  - Architecture/Control-Plane-Mutation-Contract
opened: 2026-05-05
---

# Gettimely Booking Provider — Implementation Plan

> Branch: `feat/booking-provider-abstraction` (off `origin/main`)
> Tracker: [[Tracker/D-NEW-gettimely-booking-integration]]
> First client: Nofal Barber, Saskatoon

## Why this exists
First barbershop client uses Gettimely, not Google Calendar. Today the booking pipeline only supports Google. Gettimely → Google Calendar one-way sync can read availability but cannot write a confirmed Gettimely appointment, so a busy barber would still have to tap-confirm every booking. Native Gettimely integration is the only way to ship "auto-book on the call" for barbershop/salon/spa clients.

## Architecture choice — single dispatcher behind unchanged tool names

The Ultravox tools `checkCalendarAvailability` and `bookAppointment` always hit the same URLs:
- `/api/calendar/[slug]/slots` (GET)
- `/api/calendar/[slug]/book` (POST)

Those routes will dispatch on `clients.booking_provider` and call the matching adapter. The agent's prompt, tool registration, plan gating, and capability flags are untouched. This means:

- No prompt patcher changes
- No `lib/ultravox.ts` changes
- No prompt slot changes
- No `system_prompt` rewrite for the 4 deployed clients (no-redeploy rule honored)
- Adding Vagaro/Acuity/Square/Booksy in Phase 1D is a one-file change (one new adapter)

## Phase plan

### Phase 1A — Scaffolding (this commit) ✅
- Migration: `booking_provider` + `gettimely_*` columns. Backfill sets `booking_provider='google'` for connected clients.
- Provider abstraction lib: `src/lib/booking-providers/{types,google,gettimely,index}.ts`. Google adapter wraps existing logic byte-for-byte. Gettimely adapter throws `ProviderNotImplementedError` and returns `provider_not_implemented` in `book()`.
- OAuth route stubs: `/api/auth/gettimely/{,callback}` redirect to settings with informative flags. No real OAuth yet.
- Settings UI: BookingCard gets a provider dropdown. Gettimely shows "coming soon" + disabled connect button.
- Admin Integrations panel: `/dashboard/admin/integrations` — read-only audit view of every client's booking provider + connection state.
- Settings PATCH route: `booking_provider` accepted via FIELD_REGISTRY (DB_ONLY, no agent sync).
- `clients.booking_provider` threaded into `CLIENT_CONFIG_SELECT`, `ClientConfig` type, home route.

**No production redeploys. No live tool route refactor. No Ultravox tool changes.**

### Phase 1B — Refactor + Gettimely API (next session)

Tasks in execution order:

1. **Refactor `/api/calendar/[slug]/slots` route**
   - Read `booking_provider` in the client SELECT
   - Replace inline `lib/google-calendar.ts` calls with `getBookingProvider(client).listSlots(client, args)`
   - Map provider errors to existing fallback shape (the agent already handles `available: false` + `reason`)

2. **Refactor `/api/calendar/[slug]/book` route**
   - Same pattern as `/slots`
   - Preserve race-condition re-check (G11) — moved into Google adapter, replicated in Gettimely adapter
   - Preserve `bookings` table insert + Telegram alert side effects (provider-agnostic)

3. **Implement real Gettimely OAuth start** (`/api/auth/gettimely`)
   - Mirror `/api/auth/google` exactly: auth gate, client_users lookup, nonce + state, cookie set
   - Redirect to `https://api.gettimely.com/oauth/authorize?...` with scopes for booking + staff + services

4. **Implement Gettimely OAuth callback** (`/api/auth/gettimely/callback`)
   - Exchange code for refresh token at `https://api.gettimely.com/oauth/token`
   - Fetch staff list via `GET /v1/staff`. If exactly one staff member, auto-pick. Otherwise redirect to a staff-picker page (new — `/dashboard/settings/gettimely-staff`)
   - Save: `gettimely_account_id`, `gettimely_refresh_token`, `gettimely_staff_id`, `booking_provider='gettimely'`, `calendar_auth_status='connected'`, `booking_enabled=true`
   - Patch prompt with `patchCalendarBlock()` (same as Google callback)
   - Sync Ultravox tools via `syncClientTools()`

5. **Implement Gettimely adapter — `listSlots`**
   - `getGettimelyAccessToken(client)` — refresh using `gettimely_refresh_token`, cache for 50 min in-memory
   - `GET /v1/booking/staff/{staffId}/times?date=YYYY-MM-DD&service_id=N&duration=M`
   - Convert response to `AvailabilitySlot[]`. Sort by proximity to `args.preferredTime`. Cap at `args.maxSlots ?? 3`.

6. **Implement Gettimely adapter — `book`**
   - Re-fetch availability slots for the requested time (race-condition guard)
   - `POST /v1/booking/bookings` with `{staff_id, service_id, customer_name, customer_phone, start_time}`
   - Return `{booked: true, externalId: response.booking_id, rescheduleUrl: nofalRescheduleUrl}`

7. **Service catalog mapping**
   - Add a "Map services" UI panel to BookingCard when `booking_provider='gettimely'` AND service_catalog is populated
   - Stores `gettimely_service_map: { "haircut": 12345, "beard trim": 12346 }`

8. **Test on Nofal Barber**
   - Provision new client `nofal-barber` via `/onboard-client`
   - Connect Gettimely OAuth
   - Run `/test-call` end-to-end
   - Verify booking appears in Nofal's Gettimely dashboard
   - Verify SMS confirmation sent

### Phase 1C — Post-booking SMS confirmation
- After successful `book()` (any provider) → `sendSmsTracked()` fires to caller
- SMS body: "Booked at [business] — [service] [day] [time]. Reschedule: [rescheduleUrl]"
- Per-provider reschedule URL builder

### Phase 1D — Additional providers
- Vagaro adapter (book.vagaro.com API)
- Acuity adapter (Acuity Scheduling API)
- Square Appointments adapter
- Booksy adapter (if API available)

Each is a one-file change in `src/lib/booking-providers/` plus an entry in `index.ts` + the `BOOKING_PROVIDER` check constraint in a 5-line migration.

## Why no live redeploy in Phase 1A

The 4 deployed clients are protected by the no-redeploy rule. Phase 1A:
- Migration default `'google'` covers them
- Capability flags read `calendar_auth_status` — unchanged
- Tool routes still call Google directly — unchanged
- No prompt changes, no Ultravox tool changes

A `npm run build` is the smoke test. Phase 1B is when the dispatcher goes live, and that needs a smoke test against `e2e-test-plumbing-co` before any production traffic touches it.

## Acceptance criteria (Phase 1A)
- [x] `npm run build` passes
- [x] `npm run typecheck` passes
- [ ] Migration applied on prod Supabase (manual gate)
- [x] BookingCard shows provider dropdown; Gettimely shows "coming soon"
- [x] `/dashboard/admin/integrations` lists every active client + provider
- [x] D-item filed and tracked

## Risks
- **Migration order**: existing rows pre-migration have `booking_provider IS NULL` → constraint check would fail. The migration sets DEFAULT 'google' and explicitly UPDATEs the backfill. Tested locally via `psql --dry-run` pattern.
- **Gettimely API rate limits**: not yet researched. Phase 1B prerequisite — Sonar Pro query for current Gettimely API rate limits + auth model + service catalog endpoints.
- **Service mapping UX**: Phase 1B may need an admin-only mapping UI before Nofal can self-serve.
