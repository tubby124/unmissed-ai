---
type: client
status: trialing
tags: [client, salon, barbershop, concierge-candidate]
related: [Features/Callback-Person-Routing, Tracker/D381, Tracker/D388, Tracker/D393]
updated: 2026-04-15
---

# The Vine, Classic Barbershop

## Quick Ref
- **Slug:** `the-vine-classic-barbershop`
- **Client ID:** `635303ba-48e8-464a-811e-26ff723abc0f`
- **Niche:** salon
- **Agent Name:** Jamie
- **Status:** Trialing (Lite plan) — DIY onboarded April 14 2026
- **Website:** none
- **Address:** 243 Willow St, San Jose (from GBP)
- **Booking enabled:** Yes (calendar rules baked in even if not connected)

## Team Members
- Johnny (barber) — does skin fades
- Jonas (barber)
- Jess (barber) — does NOT do skin fades (this distinction already in FAQ)

## What Works
- Agent correctly routed "Jose" away from Jess (doesn't do skin fades) to Johnny — quality_score 78
- Beard trim + specific barber request handled cleanly — quality_score 68
- FAQ pairs for booking + availability are functional

## Bugs / Issues Found (April 14 live test)
| Bug | Severity | D-item |
|-----|----------|--------|
| "i'll get Hasan to call ya back" — owner is NOT Hasan | CRITICAL | [[Tracker/D381]] |
| Business facts contain raw/embarrassing content ("ball sack trimming and unibrow") | HIGH | [[Tracker/D388]] |
| Phantom calendar/booking rules 12–19 in FORBIDDEN ACTIONS — booking likely not connected | MEDIUM | [[Tracker/D390]] |
| Inline example B says "Hasan'll check Sarah's schedule" — property_mgmt template contamination | MEDIUM | [[Tracker/D393]] |
| No FAQ pairs shown as "configured" in prompt footer | LOW | — |

## Call Log Summary (April 14 — all WebRTC test calls)
| Score | Caller | Outcome |
|-------|--------|---------|
| 78 | Jose (returning) | Skin fade → Johnny → 2pm booked |
| 68 | Jose | Beard trim → Johnny → callback |
| 65 | Evelyn | Haircut ("a beer") → frustrated → callback |
| 48 | Generic | Callback, no service specified |
| 32 | Browser | Browsing, refused name |

No real PSTN calls yet — no Twilio number provisioned.

## Concierge Actions Needed
- [ ] Fix callback person: Who should Jamie say will call back? (owner name)
- [ ] Clean business facts — remove embarrassing content, add proper service menu
- [ ] Confirm booking enabled or remove phantom rules
- [ ] Seed FAQ pairs from salon niche template
- [ ] Provision Twilio number when ready to go live

[[Project/Index]]
[[Features/Callback-Person-Routing]]
