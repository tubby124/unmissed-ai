---
type: client
status: trialing
tags: [client, it-consulting, concierge-candidate, niche-gap]
related: [Features/Callback-Person-Routing, Tracker/D381, Tracker/D389, Tracker/D388]
updated: 2026-04-15
---

# ValleySoft IT Consulting

## Quick Ref
- **Slug:** `it-consulting-it-support-web-consulting-cloud-services`
- **Client ID:** `c7ea9c41-4c0a-4425-8029-12f1ff81f9f6`
- **Real Business Name:** ValleySoft Solutions, Inc (GBP listing ≠ actual name)
- **Niche:** `other` (IT consulting not a recognized niche — niche detection failed)
- **Agent Name:** Sam
- **Status:** Trialing (Core plan) — DIY onboarded April 14 2026
- **Website:** https://valleysoftsol.com/contact
- **Address:** 4599 Alex Dr, San Jose

## What Works
- Urgent triage worked: "internet down" → flagged as URGENT correctly
- Knowledge injection mid-test worked perfectly: $75 remote desktop FAQ inserted → next call recited it exactly
- Today's Update injection worked: "Closed this week" → agent adapted correctly
- Slow computer inquiry handled cleanly — quality_score 62

## Bugs / Issues Found (April 14 live test)
| Bug | Severity | D-item |
|-----|----------|--------|
| Agent introduces as "IT Consulting IT Support Web Consulting Cloud Services" — GBP slug used as name | CRITICAL | [[Tracker/D388]] |
| "i'll get Hasan to call ya back" — owner is NOT Hasan | CRITICAL | [[Tracker/D381]] |
| Niche = "other" — IT consulting falls through to generic slot assembly | HIGH | [[Tracker/D389]] |

## Call Log Summary (April 14 — all WebRTC test calls)
| Score | Caller | Outcome |
|-------|--------|---------|
| 68 | Jonathan | Internet outage → flagged urgent → callback |
| 62 | Joseph | Slow computer → remote desktop → callback |
| 32 | Anonymous | Hours + pricing inquiry → cold |

No real PSTN calls yet.

## Concierge Actions Needed
- [ ] Fix business name: "ValleySoft Solutions" not the GBP listing
- [ ] Fix callback person: Who should Sam route to? (not Hasan)
- [ ] Manually set niche to `it_consulting` once D389 adds it
- [ ] Clean business_facts: "ValleySoft Solutions, Inc is an IT company" is too thin
- [ ] Seed FAQ pairs from IT niche defaults
- [ ] Provision Twilio number when ready

[[Project/Index]]
[[Features/Callback-Person-Routing]]
[[Tracker/D389]]
