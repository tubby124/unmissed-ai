# Eagle Head Auto Parts — Domain Knowledge

## Business Overview
- **Business:** Eagle Head Auto Parts Ltd.
- **Type:** Full-service salvage yard / auto parts dismantler
- **Location:** 704 Westridge Rd, Strathmore AB T1P 1H8 (~50 km east of Calgary)
- **Phone:** 403-934-3434
- **Email:** eaglehead@live.ca
- **Website:** eaglehead.ca (basic static HTML, no SSL, no online ordering)
- **Call volume:** 80-90 inbound calls/day
- **Affiliations:** URG/AARDA affiliated, listed on car-part.com

## Key Contacts
| Name | Role | Notes |
|------|------|-------|
| John Carreon ("Johnny") | Owner / operator | Must greenlight the project. Ray warns he can be a "bullshitter" but is fine to do business with. |
| Barry | IT contact (Ray's best friend) | Technical champion. Knows what he wants. Does NOT want to support/deploy post-launch — wants unmissed.ai to fully manage. |
| Ray Kassam | Connector / potential investor | Hasan's landlord. Tech veteran (90s PBX dating lines → sold to LavaLife). Seeded Plenty of Fish ($2M USD payout 2017). 72 properties. Wants board-level stake in unmissed.ai. |

## What the Business Does
- Acquires old vehicles (e.g. 1999 Ford F-150s, various makes)
- Strips and catalogs usable parts (brake calipers, engines, doors, etc.)
- Logs parts into Hollander POS inventory system
- Sells parts over the phone and counter
- Parts desk handles 80-90 calls/day — this is the entire business flow

## Inventory System
- **Software:** Hollander by Solera (confirmed March 14, 2026)
- **Listed on:** car-part.com (URG member)
- **Plan A:** Hollander REST API — query live inventory in real time. Email drafted for John to send to Hollander/Solera requesting API access + port/firewall specs.
- **Plan B:** CSV export from Hollander → upload to RAG knowledge base → nightly/hourly refresh. Staff confirmation gate fires before payment link sends (prevents selling stale inventory).

## What Barry Wants (the requirements)
1. AI answers the call
2. AI checks inventory live
3. AI quotes price and availability
4. Customer pays (no card numbers over the phone — payment link via SMS)
5. Order entered into Hollander POS
6. Staff only pulls the physical part

Barry's words: AI must "carry the request through to completion." He explicitly rejected "glorified IVR" message-taking.

## Technical Architecture (proposed)
| Layer | Solution |
|-------|---------|
| Voice agent | unmissed.ai inbound agent (auto_recycler niche — to be scaffolded) |
| Inventory lookup (Plan A) | HTTP tool → Hollander REST API (real-time) |
| Inventory lookup (Plan B) | RAG knowledge base (CSV export, hourly refresh) + staff confirmation gate |
| Payment | SMS Stripe Checkout link (PCI SAQ-A — no card data on our system) |
| Order entry | Post-call RPA: Claude Computer Use (desktop POS) or Playwright (web-based) |
| Hosting | AWS Ubuntu VM — managed by unmissed.ai (Barry's explicit requirement) |
| Staff notifications | SMS/WhatsApp YES/NO confirmation before payment link fires |

## What We Cannot Do
- Search external yards via car-part.com — no public API exists
- Real-time inventory without Hollander API or very frequent CSV refresh
- Fully unattended order entry without human review step (RPA is 70-90% reliable)

## Call Flow (Phase 1)
1. AI answers: identifies caller need (part, year/make/model)
2. AI searches knowledge base / Hollander API
3. AI quotes price + availability
4. AI captures order details + caller phone (from caller ID)
5. Call ends — "Our team confirms availability and texts you a payment link in a few minutes"
6. Staff gets instant SMS notification: YES/NO to confirm part is on shelf
7. YES → Stripe Checkout link fires to customer via SMS
8. NO → Customer SMS: "Sorry, that part just sold"
9. Payment confirmed → SMS to customer, staff notified to pull part
10. (Phase 3) Background RPA enters order into Hollander POS

## Common Caller Scenarios
1. Part availability check — "Do you have a brake caliper for a '99 F-150?"
2. Price quote — "How much for a driver door on a 2005 Silverado?"
3. Year/make/model variations — callers often unsure of exact trim/specs
4. Part condition — OEM vs aftermarket, grade A/B/C
5. Pickup vs. shipping — local pickup in Strathmore or shipping options

## Information to Collect on Every Call
- Part name / description
- Vehicle: year, make, model (and trim if relevant)
- Caller name
- Caller phone (auto-captured from caller ID — never ask)
- Pickup or shipping preference

## FAQs (draft)
- Do you have [part]? — "Let me check our inventory right now — what's the year, make, and model?"
- Can you ship? — "We can arrange shipping. Our team will confirm that when they send your payment link."
- What condition is it in? — "I'll note that in the order and our team will confirm the grade when they verify availability."
- Do you price-match? — Route to callback — "Our team will go over pricing when they follow up."

## What NOT to Promise
- Real-time inventory accuracy (Plan B has refresh lag — hence the confirmation gate)
- Searching other yards (car-part.com has no API)
- Instant payment processing without staff confirmation step (Phase 1)
- Unsupervised RPA order entry (human review required in Phase 3)

## Status Log
| Date | Event |
|------|-------|
| 2026-03-09 | Initial notes — Barry pitched, harsh reality check on IVR vs full execution |
| 2026-03-14 | In-person pitch to Barry + John. 80-90 calls/day confirmed. Hollander confirmed as POS. Plan A (API) / Plan B (CSV) presented. Hollander email committed. Barry wants AWS Ubuntu VM managed by us. Ray revealed as tech veteran / potential investor. Ray gave hard deadline: next Saturday — stop treating this like a sandbox. |
