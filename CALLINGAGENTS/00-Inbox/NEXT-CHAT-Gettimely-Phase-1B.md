# NEXT CHAT — Gettimely Phase 1B (Refactor + Real OAuth)

## Cold-start prompt
"Resume Gettimely integration. Phase 1A is shipped on `feat/booking-provider-abstraction` (PR pending). Move to Phase 1B: refactor `/api/calendar/[slug]/{slots,book}` routes to use the dispatcher, then implement real Gettimely OAuth + availability + booking. Test on Nofal Barber. See `CALLINGAGENTS/00-Inbox/gettimely-integration-plan.md` for the full task list."

## State at end of Phase 1A
- Branch: `feat/booking-provider-abstraction` (off `origin/main`)
- D-item: `CALLINGAGENTS/Tracker/D-NEW-gettimely-booking-integration.md`
- Migration: `supabase/migrations/20260505000000_add_booking_provider.sql` (NOT YET APPLIED to prod)
- Provider lib: `src/lib/booking-providers/{types,google,gettimely,index}.ts`
- OAuth stubs: `src/app/api/auth/gettimely/{,callback}/route.ts`
- Settings UI: `BookingCard.tsx` has provider dropdown
- Admin: `src/app/dashboard/admin/integrations/page.tsx`
- Settings PATCH route: `booking_provider` accepted via `FIELD_REGISTRY`

## Required prerequisites (research before coding)
1. Sonar Pro query: "Gettimely REST API authentication OAuth scopes booking endpoints rate limits 2026"
2. Sonar Pro query: "Gettimely API create booking POST endpoint required fields service_id staff_id"
3. Sonar Pro query: "Gettimely API list staff times availability endpoint URL parameters"
4. Apply the Phase 1A migration to prod Supabase before any Phase 1B code runs against prod data:
   ```
   supabase db push --project-ref qwhvblomlgeapzhnuwlb
   ```

## Required env vars (Railway, Phase 1B start)
- `GETTIMELY_CLIENT_ID` — register OAuth app at developer.gettimely.com
- `GETTIMELY_CLIENT_SECRET` — same registration
- `GETTIMELY_REDIRECT_URI` — `https://unmissed.ai/api/auth/gettimely/callback`

## Smoke gate before merging Phase 1B
- [ ] `e2e-test-plumbing-co` Google booking still works (regression — dispatcher refactor must preserve Google behavior byte-for-byte)
- [ ] Nofal Barber connects Gettimely OAuth → `gettimely_refresh_token` saved in clients row
- [ ] Test call books a real Gettimely appointment → appointment visible in Nofal's Gettimely dashboard
- [ ] No regression on the 4 deployed Google clients (audit `clients.tools` after dispatcher refactor)

## Files to touch in Phase 1B
- `src/app/api/calendar/[slug]/slots/route.ts` — dispatcher refactor
- `src/app/api/calendar/[slug]/book/route.ts` — dispatcher refactor
- `src/app/api/auth/gettimely/route.ts` — real OAuth start
- `src/app/api/auth/gettimely/callback/route.ts` — real callback (mirror google callback exactly)
- `src/lib/booking-providers/gettimely.ts` — real Gettimely API calls
- `src/lib/google-calendar.ts` — no changes expected, but verify
- `src/lib/clients/select-columns.ts` — add `gettimely_*` columns to the SELECT
- `src/app/dashboard/settings/page.tsx` — extend `ClientConfig` with Gettimely fields
- New: `src/app/dashboard/settings/gettimely-staff/page.tsx` — staff picker (only if Nofal has multiple staff in Gettimely)
- New: `src/lib/booking-providers/gettimely-auth.ts` — token refresh helper

## Files NOT to touch
- `src/lib/ultravox.ts` (`buildAgentTools`, `buildCalendarBookingTools`) — tool URLs + names unchanged
- `src/lib/prompt-patcher.ts` — calendar block prompt text unchanged
- Any prompt slot file
- The 4 deployed clients' `system_prompt`

## Verification commands
```bash
cd ~/Downloads/CALLING\ AGENTs
npm run typecheck
npm run build
npm run test:all
# Manual smoke:
npm run dev
# 1. Open http://localhost:3000/dashboard/settings (as admin) — pick Gettimely from provider dropdown
# 2. Click "Connect Gettimely" — should redirect to Gettimely OAuth screen
# 3. Authorize on test account → callback writes refresh token → settings page shows "Gettimely connected"
# 4. /api/calendar/<slug>/slots?date=YYYY-MM-DD returns Gettimely slots
# 5. /api/calendar/<slug>/book POST creates a real appointment in Gettimely test account
```
