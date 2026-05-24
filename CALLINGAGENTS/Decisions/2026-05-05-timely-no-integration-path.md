---
type: decision
status: accepted
date: 2026-05-05
related:
  - Tracker/D-NEW-gettimely-booking-integration
  - Features/Booking
tags:
  - booking
  - integrations
  - third-party-api
  - vendor-strategy
---

# Decision — No integration path with Timely (gettimely.com) salon software

## Context
First barbershop client (Nofal Barber, Saskatoon) uses Timely (gettimely.com) — bookings live at `bookings.gettimely.com/nofalbarber`. Goal was to ship native voice-agent → Timely booking integration so the agent can auto-book during a live call (the same UX that Google Calendar clients get today via `checkCalendarAvailability` + `bookAppointment` tools).

Phase 1A of D-NEW-gettimely-booking-integration shipped on `feat/booking-provider-abstraction` (PR #74) — provider abstraction layer + scaffolding. The plan was to fill in real Gettimely OAuth + REST API in Phase 1B.

## Findings (validated 2026-05-05 via web search + WebFetch + Sonar Pro × 3)

### 1. Timely (Gettimely) has no public REST API
- No `developer.gettimely.com`, no `api.gettimely.com`, no `dev.gettimely.com` domain exists.
- Search results consistently confused this product with `timelyapp.com` (the unrelated time-tracking SaaS, which DOES have an API at `developer.timely.com` / `dev.timelyapp.com`). Every public API documentation hit returned for "Timely" in 2026 belongs to the time tracker, not the salon product.
- Make.com community thread on the topic: "From what I have found at the timely website, there is no public API. There is only an option for Zapier."

### 2. The Zapier integration is read-only on customers
- Single trigger: "Customer Trigger" — fires on new/updated customer records, polled every 15 min on free tier.
- **Zero actions.** Zapier cannot create, update, or cancel bookings in Timely. The action picker in Zapier shows no Timely write operations.
- The per-account API key (Settings → Add-Ons → Zapier → Activate) is scoped to this Zapier surface only. There is no documented way to use it against booking endpoints.

### 3. The booking creation endpoint is internal-only
- The customer-facing widget at `bookings.gettimely.com/{slug}/book` does make HTTP calls to create bookings (anyone can book without auth). Those endpoints are not documented and not part of any partner surface.
- Reverse-engineering them would technically work but: (a) ToS violation, (b) breaks on any Gettimely UI/endpoint update, (c) Gettimely would eventually fingerprint and block automated traffic, (d) "we book directly into Timely" can't appear on sales materials without inviting a cease-and-desist.

### 4. Timely's partner program does not grant API access
- Two commercial tiers documented at [app.gettimely.com/public/partnerterms](https://app.gettimely.com/public/partnerterms):
  - **Referrer Program** — free signup, 20% commission on referred customers for 12 months. No API access.
  - **Certified Reseller** — $199 + certification + customer support obligation, 20% commission ongoing. No API access.
- No "Technology Partner" or "Integration Partner" tier exists. No language in the Terms of Service references API access, software integrations, or developer partnerships.
- Partner programs are positioned for **selling Timely to salons**, not **building software that integrates with Timely**.
- Cold-emailing partners@gettimely.com to request API access is theoretically possible but has near-zero leverage from a standing start (zero existing salon clients on Timely, unproven product, mature SaaS that has deliberately chosen a closed-API strategy for years).

## Decision

**Do not pursue Timely native integration. Phase 1B-real (Timely OAuth + REST API) cannot be built — there is no API to build against.**

For Nofal specifically: revisit only if/when a credible API path opens. He's not blocking on us shipping his agent today.

For the broader product: **stop pitching to Timely-using salons** until something in the landscape changes. Focus barbershop/salon TAM on Vagaro, Acuity Scheduling, Square Appointments, and Booksy — those have public REST APIs and the Phase 1A booking-provider abstraction handles them cleanly.

## What stays

- **Phase 1A scaffolding (PR #74) — keep as draft.** The provider abstraction layer (`src/lib/booking-providers/`) is still correct work. Vagaro, Acuity, Square, Booksy adapters all plug into it. Just don't merge the `gettimely` enum value or the Gettimely stub adapter — strip those before merge OR replace with the first real adapter (Vagaro or Acuity).
- **D-item D-NEW-gettimely-booking-integration** — set status to `deferred-no-api-path`. Document this finding inline.

## What gets removed before PR merges

- `'gettimely'` from the `booking_provider` CHECK constraint in the migration
- `src/lib/booking-providers/gettimely.ts` (the stub adapter)
- `/api/auth/gettimely/{,callback}/route.ts`
- The Gettimely option in the BookingCard provider dropdown
- "Gettimely — Phase 1B" text in the admin Integrations panel

Replace with at least one real adapter (Vagaro most likely — well-documented public API + similar barber/salon clientele) so the abstraction has a second concrete implementation and isn't speculative.

## Path for Nofal

Migrate to Google Calendar. Same-week onboard, working voice-agent auto-book today. He keeps his Timely customer-facing booking page if he wants both. Phase 1A's existing Google Calendar flow handles him with zero new code.

## Wrong estimate to correct

Earlier in the same session, the assistant told Hasan "2-6 weeks for partner API approval" — that estimate was wrong. It assumed Timely had a Technology Partner tier with a yes/no application path. They don't. The correct estimate is "indefinite, with near-zero probability from a cold-email standing start."

## What changes about future intake

Add `existing_booking_system` field to onboarding intake — values: `google_calendar`, `vagaro`, `acuity`, `square_appointments`, `booksy`, `timely`, `other`, `none`. Routing logic:
- `google_calendar` / `none` → ship as-is on the Google adapter
- `vagaro` / `acuity` / `square_appointments` / `booksy` → Phase 1B real (build the matching adapter when first lead lands)
- `timely` → "Voice agent works on Google Calendar — quick migration. Timely doesn't open up booking integrations to third-party software."
- `other` → manual review

## Connections
- → [[Tracker/D-NEW-gettimely-booking-integration]] (status update + this ADR linked)
- → [[Features/Booking]]
- → [[Architecture/Control-Plane-Mutation-Contract]] — `booking_provider` field stays, just without `gettimely` enum value
- → PR #74 (`feat/booking-provider-abstraction`) — kept open as draft pending Vagaro/Acuity adapter substitution

## Sources (validated 2026-05-05)
- [Timely Partner Terms of Service](https://app.gettimely.com/public/partnerterms) — two commercial tiers, no API tier
- [Timely Partner Portal Registration](https://app.gettimely.com/partner/public/register?partner=1) — Referrer/Reseller signup
- [Zapier Timely Integrations](https://zapier.com/apps/timely/integrations) — 1 trigger, 0 actions
- [Make.com community on Timely integration](https://community.make.com/t/has-anyone-had-any-experience-with-integrating-with-timely-gettimely-com/66980) — "no public API, only Zapier"
- [How to connect Zapier with Timely](https://help.gettimely.com/hc/en-gb/articles/1500002512181-How-to-connect-Zapier-with-Timely) — API key location (Settings → Add-Ons)
- [Sygnal Webflow integration for GetTimely](https://attr.sygnal.com/sa5-booking/gettimely) — iframe/widget embed only, no programmatic API
