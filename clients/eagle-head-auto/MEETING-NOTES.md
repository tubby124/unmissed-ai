# Eagle Head Auto — Meeting Notes

## Meeting 1 — Initial Barry Intro (approx. March 9, 2026)

**Source:** Brain dump entry `20260310-0434`
**Attendees:** Hasan, Barry (Ray's IT friend)
**Note:** Barry also runs Free2Call INC (VoIP/ISP). He sent MSP partnership materials March 14 — see `~/Downloads/PIXEL CALYX SYSTEMS INC. /mssp/Free2Call-Barry-Redman/` (Pixel Calyx opportunity, separate from Eagle Head AI build).

### What Was Discussed
- Barry gave a harsh reality check: he needs the AI to "carry the request through to completion"
- Current AI solutions are "glorified IVRs" — they just take messages, human still has to call back
- Target is to fully replace the parts desk person: take the call, check stock, get payment, process the order
- Barry warned: parts software vendor is "highly unlikely" to give API access
- **Pitched to Barry:**
  - RAG to train AI on their database for inventory queries
  - Phase 2: computer use / screen control to enter orders into POS (if no API)
  - Human-in-the-loop: AI takes order → WhatsApp YES/NO to owner to confirm
- Barry's response: willing to test. Said he'd check with Johnny (business owner) for greenlight.

### Action Items from Meeting 1
- [ ] Wait for Johnny greenlight
- [ ] Investigate Claude Computer Use API for RPA feasibility
- [ ] Find out exact software name (don't assume no API — check dev docs)

---

## Meeting 2 — In-Person Pitch to Barry + John (March 14, 2026)

**Source:** Brain dump entry `20260314-1043`
**Attendees:** Hasan, Barry, John Carreon (Johnny)

### Key Facts Confirmed
- **Call volume:** 80-90 inbound calls/day — high enough to fully justify the build
- **Inventory software:** Hollander by Solera (confirmed on-site)
- **Two-plan pitch presented:**
  - **Plan A:** Hollander REST API — real-time, live inventory (ideal)
  - **Plan B:** CSV export from Hollander → RAG knowledge base, scheduled refresh
- **Committed to:** Draft email for John to forward to Hollander/Solera requesting API access + port/firewall specs (see `HOLLANDER-EMAIL-DRAFT.md`)
- **Barry's hosting ask:** AWS Ubuntu VM, fully managed by unmissed.ai — Barry does NOT want to support or deploy post-launch
- **Barry's stance:** Technical but explicitly stated he will not support/deploy without Hasan managing it

### Action Items from Meeting 2
- [x] Draft Hollander API request email (see `HOLLANDER-EMAIL-DRAFT.md`)
- [ ] John to forward email to Hollander/Solera rep
- [ ] Wait for Hollander API response
- [ ] If API available: build `checkOwnInventory` HTTP tool
- [ ] If API denied: proceed with Plan B (CSV export + RAG + confirmation gate)
- [ ] Scaffold `auto_recycler` niche in prompt-builder

---

## Post-Meeting Call — Ray's Reality Check (March 14, 2026)

**Source:** Brain dump entry `20260314-1131`
**Attendees:** Hasan, Ray Kassam (landlord/connector)

### Ray's Background (critical context)
- Built a massive PBX phone dating service in Calgary in the 90s (charged $5/minute, voice changers, the whole thing)
- Sold it to LavaLife (later acquired by Match.com)
- **Seeded Marcus Frind for Plenty of Fish** — registered the domain, gave seed money
- When Match.com bought POF for $500M, Marcus sent Ray a **$2,000,000 USD check (2017)**
- Ray used it to buy US properties
- Now owns **72 properties** (grandfathered before current insurance/lending limits), buys in cash and refinances
- Has a 1937 Jaguar, throws garage parties
- Runs an AWS VoIP company ("Free to Call") with his buddy Anderson

### Ray's Vision for unmissed.ai
- Wants to be **board of directors / money guy**, make Hasan CEO
- Goal: **2,000-3,000 customers, take the company public**
- Called out Hasan for showing up to the meeting unprepared — should have had domain, portal, and live demo number ready

### Ray's Advice (take this seriously)
1. **Auto parts is a trap.** Hollander inventory changes by the minute. If the API request is denied, Plan B (CSV) will produce stale data → AI sells parts John no longer has → refund headaches.
2. **Target restaurants instead.** A menu is static. AI takes the order, sends it to the kitchen. Infinitely easier to scale. Ray specifically mentioned Farad's (restaurant contact).
3. **Stop treating this like a sandbox.** Hard deadline: **next Saturday** — pick a final name, register the official domain, get the portal live, set up a demo phone number.

### Ray's Assessment of John
- John is a "bullshitter" — overcharged Ray $1,500 on a truck repair
- Still fine to do business with, but don't over-invest before API question is answered
- Barry is Ray's actual best friend — Barry is the real champion here

### Action Items from Ray's Call
- [ ] **Hollander email** — send it this week (already drafted)
- [ ] **Restaurant demo** — build a demo agent for a restaurant (Farad's or similar). Static menu = fast to build, easy to demo.
- [ ] **Real company steps (Ray's Saturday deadline):**
  - [ ] Pick a final name
  - [ ] Register the official domain
  - [ ] Get the portal live with real onboarding
  - [ ] Set up a live demo phone number people can actually call
- [ ] **AWS VM scope** — if Eagle Head proceeds, price out managed AWS Ubuntu VM hosting as a line item

---

## Notes on Ray as a Potential Investor
Ray isn't just a referral — he's positioning himself as a co-founder / board member. He has:
- The capital (POF payout + 72 properties)
- The domain expertise (literally built the same business in the 90s)
- The network (tech founders, VoIP operators, property portfolio)
- The urgency (wants to scale to IPO, not a lifestyle side project)

This relationship is more valuable than the Eagle Head contract itself. Handle Ray carefully.
