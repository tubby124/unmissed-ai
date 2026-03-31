---
type: research
tags: [research, competitive, onboarding, zero-config, sonar]
date: 2026-03-31
source: Perplexity Sonar Pro via OpenRouter (6 queries)
status: logged
---

# Research — Zero-Config Agent Creation (2026-03-31)

> 6 Sonar Pro queries researching "business name in → agent ready" for unmissed.ai.

## TL;DR

**No competitor currently offers true zero-config "business name → agent ready."** The closest patterns are website scraping + GBP data + niche templates — which is exactly where our refactor is heading. We're not behind; we're building the right thing.

---

## Query 1: Instant Agent Setup — Competitive Landscape

**Nobody does zero-config.** Every platform requires structured inputs.

| Platform | Minimum Inputs | Time to First Call |
|----------|----------------|-------------------|
| CloudTalk | Template + flows + integrations + voice | Hours |
| Salesforce Agentforce | Name + description + role + voice | Minutes |
| FwdSlash | Use case + knowledge/behavior | < 4 minutes |
| Bland/Vapi/Retell | API setup + prompt + voice + tools | Hours-days |

**FwdSlash claims < 4 minutes** but still requires defining use case and parameters. No platform auto-populates from business name or URL alone.

**Our opportunity:** If we combine GBP auto-import + niche templates + website scrape, we could be the first platform where you pick your business from Google and get a working agent in under 2 minutes. Nobody else does this.

---

## Query 2: Google Business Profile Auto-Import ⭐ ACTIONABLE

**YES — GBP data can be extracted and auto-populated.**

### What we can pull:
- Business name, address, phone
- Hours (day-by-day breakdown)
- Categories/services
- Reviews count + distribution
- Photos, website URL

### How:
| Method | Cost | Auth Needed |
|--------|------|-------------|
| **Apify Google Maps Scraper** | ~$0.05/business | No (public data) |
| **RapidAPI Local Business Data** | Pay-per-use | API key |
| **Official GBP API** | Free | Business ownership |
| **DataForSEO** | Subscription | API key |

**Apify is the play.** We already have Apify MCP configured. $0.05 per business to get hours, services, reviews, contact info. That's 80% of the agent populated from one Google search.

### Recommended D-item: D291 — GBP Auto-Import Onboarding
- User types business name → we search Google Maps via Apify → show results
- User picks their business → auto-populate: name, address, hours, phone, services, reviews
- Reviews become FAQ seed material (common questions from reviews)
- Website URL triggers scrape pipeline (D246 + AI compiler)

**Caveat:** Scraping GBP may violate Google TOS. Use for owned businesses only (user confirms it's theirs). Official API requires business ownership verification.

---

## Query 3: Calendar Booking Integration

**"Just works" patterns exist.** Best approach: Cal.com or direct Google Calendar OAuth.

| Platform | Setup Method | Effort |
|----------|-------------|--------|
| VoiceInfra | cURL paste (1 min) | Lowest |
| Vapy/Eleven Labs | API key + templates | Low |
| VoiceGenie | Cal.com integration | Low |
| Zeeg/Retell | Direct OAuth | Medium |

**Our current state:** We have Google Calendar OAuth + checkCalendarAvailability + bookAppointment tools. It works but requires: enable toggle → OAuth → configure → test.

**What would be better:** 
1. During onboarding, ask "Do you want your agent to book appointments?"
2. If yes → OAuth popup → done. Agent auto-detects calendar availability.
3. No extra config needed. Cal.com as middleware could simplify multi-calendar support.

**Our gap:** The toggle + OAuth exists but the UX doesn't feel "just works." The agent doesn't automatically adapt its conversation flow when booking is enabled (D276 fixes this in Phase 6).

---

## Query 4: Website URL → Full Agent

**Yes, competitors do this in 15-60 minutes.** We're close.

| Platform | Method | Time |
|----------|--------|------|
| n8n/Dify/Langflow | No-code scrapers + RAG | < 1 hour |
| CrewAI/LangChain | Python scraping + function calling | Hours |
| ChatBot.com | URL → auto-generate FAQ | Minutes |

**Our current state:** We have website scraper (D246) + AI compiler + knowledge pipeline + pgvector. But it's manual multi-step: paste URL → wait → approve scrape → approve knowledge chunks.

**What would be better:**
1. Paste URL → auto-scrape in background → show extracted info
2. "Here's what we found: 8 services, 12 FAQ answers, your hours, your location"
3. User confirms → all data flows into template variables → agent built

**We're 80% there.** The pipeline exists. The UX needs to be streamlined from multi-step to one-flow.

---

## Query 5: Call Forwarding Setup ⭐ UNIVERSAL PAIN POINT

**No carrier offers API-based call forwarding setup.** It's manual everywhere.

Best competitor approaches:
- **Retell AI:** 5-step guided setup (assign number, configure in carrier portal, test, monitor)
- **HighLevel:** 3 configuration pathways (phone settings, IVR workflow, voice AI transfer)
- **Pattern:** Conditional forwarding templates (forward if no answer/busy/unreachable)

**This is the #1 friction point and nobody has solved it.** Every user has to:
1. Google their carrier + "conditional call forwarding"
2. Figure out the right *67 or *72 code
3. Dial it from their phone
4. Hope it works
5. Test it

**Our opportunity:** We already have `memory/canadian-carrier-call-forwarding.md` with carrier-specific instructions. Ship a guided setup wizard that:
1. Asks "Who's your carrier?" (Rogers, Bell, Telus, etc.)
2. Shows exact steps + dial codes for that carrier
3. Has a "Test it now" button that calls the user's number
4. Confirms forwarding is working

Nobody else does this well. First to nail it wins the onboarding battle.

---

## Query 6: Competitive Landscape 2026

### Table Stakes (everyone has these):
- Sub-1s latency
- Twilio telephony
- SOC 2 / GDPR compliance
- $0.05-0.10/min pricing
- No-code builder
- < 3 week time-to-first-call

### Premium (differentiating):
- 1M+ concurrent calls (Bland)
- BYO models + 4,200+ configs (Vapi)
- Emotional AI (PolyAI)
- Self-hosting option (Bland, Rasa)
- AI Ops monitoring
- Proven ROI metrics

### Where unmissed.ai fits:
- **Our niche:** Small local businesses (plumbers, dentists, salons) who need a phone agent that "just works"
- **Our differentiator (potential):** Fastest time-to-first-call for non-technical users. GBP import + niche templates + guided forwarding = under 2 minutes from signup to working agent.
- **What we lack vs enterprise:** No multi-language, no self-hosting, no 1M concurrent scale. But our market doesn't need that.

---

## Recommended New D-Items

| D-item | Phase | What |
|--------|-------|------|
| **D291** | 6 | GBP auto-import onboarding — search Google Maps, pick business, auto-populate everything |
| **D292** | 6 | Guided call forwarding wizard — carrier-specific instructions + test button |
| **D293** | 6 | "Paste URL → agent ready" streamlined flow — single-step scrape + approve + build |
| **D294** | 6 | Post-onboarding "Your agent is live" summary — capabilities, knowledge count, test call CTA |

## Key Strategic Insight

**Nobody has cracked "zero-config" yet.** The market is at "configure in 15-60 minutes." If we can get to "pick your business from Google, confirm, agent ready in 2 minutes" — that's a genuine competitive moat for the SMB segment. The architecture refactor (Phases 1-6) is the prerequisite. The GBP import + niche templates + streamlined scrape is the killer feature on top.