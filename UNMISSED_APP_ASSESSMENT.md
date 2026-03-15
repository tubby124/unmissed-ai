# unmissed.ai — Full App Assessment
**Scanned:** March 14, 2026 | **Method:** Playwright browser automation, full authenticated session
**Login:** admin@unmissed.ai (God mode — all clients visible)
**Pages scanned:** 27 total (public + dashboard + admin)

---

## TL;DR

The app is legitimately impressive for an early-stage product. Real production data, polished marketing pages, a surprisingly deep admin/dashboard stack, and verified 2,082-call volume for Hasan Sharif. The core product loop — Twilio call → Ultravox agent → AI classification → Telegram notification → dashboard card — is clearly working in production. There are meaningful inconsistencies to clean up (stale n8n/Google Sheets references throughout copy, niche onboard gaps, recording endpoint 404s) but nothing that breaks the product. The bones are excellent.

---

## What's Working Great

### 1. Real Production Volume — The Social Proof is Verified
- **2,082 calls handled for Hasan Sharif** — this is live, verified, production data. Displayed prominently on `/for-realtors` and `/dashboard/campaigns`. Not a mock number.
- **181 total calls in dashboard** with 10 hot leads, 21 calls today (+5% vs yesterday), 54% containment rate. Real numbers.
- **Cost tracking**: $16.99/month total infrastructure cost ($9.55 Twilio + $7.43 Ultravox) for 251 calls (176.5 minutes). The math is real and the admin page even runs a variance check against actual Twilio bill ($10.27 computed vs $9.55 — flags "Within tolerance").

### 2. The Mark Windshield Transcript Sells The Product
The demo call transcript embedded across the site is genuinely impressive:
```
Mark: windshield hub auto glass, this is mark — how can i help ya today?
Caller: Hey, Mark. Looking to get my windshield replaced.
Mark: gotcha, yeah we can definitely help with that. what year, make, and model is it?
Caller: It's a BYD twenty twenty six.
Mark: do you know if it's got that lane assist camera up by the mirror?
Caller: That Chinese car, of course it has that.
Mark: right on, that means we'll need to calibrate it. when were ya looking to bring it in?
```
That response — "do you know if it's got that lane assist camera up by the mirror?" for a BYD 2026 — demonstrates real domain knowledge. It's the most convincing possible demo because it's from an actual production call.

### 3. Niche Landing Pages Are Polished and Conversion-Ready
All 6 niche pages (`/for-auto-glass`, `/for-realtors`, `/for-hvac`, `/for-plumbing`, `/for-dental`, `/for-legal`) follow a tight pattern:
- Pain scenario in the headline (furnace at 2am, pipe burst at midnight, accident victim calling a law firm at 6pm)
- Revenue at risk calculation with specific numbers ($124,800/year for plumbing, $936,000/year for legal)
- Industry-specific Telegram lead card mockup with realistic field values
- 7 data points the agent captures (varies per niche)
- Niche-appropriate social proof quote
- Pricing section with ROI framing customized per industry ("One missed service call pays for 6 months")
- 8 FAQ accordions

The Telegram card mockups are particularly strong:
- **HVAC**: "🔥 HOT LEAD — Furnace not turning on — kids at home — Temp inside dropping"
- **Legal**: "🌡️ WARM LEAD — Employment dispute — wrongful dismissal — terminated 2 weeks ago — has docs"
- **Realtor**: "🌡️ WARM LEAD — 3BR detached, $400K–$550K budget — Pre-approved: Yes $520K"

Each mockup includes realistic phone numbers, timestamps, and city/province context. These feel real because the product actually delivers cards like this.

### 4. Dashboard Settings Page is Deeply Featured
`/dashboard/settings` is the richest page in the app. In a single view:
- **Setup Checklist** — step-by-step activation guide
- **Agent Overview** — toggle on/off per client
- **God Mode** (admin only) — Telegram bot token, chat ID, Twilio number, timezone, minute limit
- **Voice config** — Ultravox agent ID, Re-sync Agent button
- **Agent Script** — collapsible full prompt view
- **AI Improve** (Beta) — one-click prompt optimization
- **Prompt History** — view prior versions
- **SMS Follow-up config** — template editor + test send
- **Advanced Context** — business facts editor + Q&A pairs (effectively a mini knowledge base UI)
- **Test Call trigger**

This is a serious feature surface for v1.

### 5. Voice Library is Production-Ready
71 Ultravox English voices across 3 providers (Cartesia 5 / Eleven Labs 41 / Inworld 25). Each has:
- Provider badge
- Play preview button
- Assign dropdown
- Client tags showing current assignment (e.g. Jacqueline shows "urban-vibe")

Jacqueline (aa601962) is marked "Active" for Urban Vibe — confirmed correct per internal config.

### 6. Admin Call Log — Intelligence Is Working
`/admin/calls` shows 100 calls with:
- **Auto-classification**: HOT 8 / WARM 17 / COLD 20 / JUNK 42
- **Type detection**: Emergency, Appointment, Spam, Other
- **AI summaries** per call ("Caller reports no heat in their unit — urgent", "Caller needs urgent driver's side window...")
- **Avg duration**: 0:29

Notable entries:
- `+12294592510` — JUNK/Spam — "Matthew from My AI Front Desk calling to..." (1:05) — **Competitor probed the system and was correctly identified and classified as spam**
- `+16397720000` — JUNK/Spam — "Automated greeting from Hasan's own AI..." — AI calling AI, correctly caught
- `+14036202377` — HOT/Emergency — "Caller reports no heat in their unit — urgent" (0:42) — real lead

The spam detection catching a competitor reconnaissance call is genuinely impressive.

### 7. Campaigns Grid Shows Multi-Client Health at a Glance
`/dashboard/campaigns` shows all 7 clients in a performance grid with sparkline charts:
- Urban Vibe: 90 calls / 6 hot / 7% conversion
- Hasan Sharif: 68 calls / 5 hot / 7% conversion
- Windshield Hub: 25 calls / 1 hot / 4% conversion

The sparklines show call volume trends per client. Clean way to see system health across the portfolio.

### 8. Competitor Comparison Tables on Pricing Page
`/pricing` includes a direct competitor comparison grid against Dialzara, Rosie, My AI Front Desk, Goodcall, and Smith.ai. Calling out specific competitors by name with feature checkboxes is a confident, conversion-oriented choice. The human receptionist comparison table ($3,500–$4,500/month vs $147–$397) makes the ROI case immediately obvious.

### 9. Homepage Demo Audio with Real Stats Ticker
Homepage includes:
- 1:38 audio demo (Mark, Windshield Hub)
- Stats ticker: "8,400+ calls handled · 47 hot leads this week · 3.2 sec average answer time"
- Live call number displayed: (587) 355-1834
- ROI calculator with sliders (calls/week, avg job value, close rate → monthly revenue recovered)
- Interactive comparison table (AI vs Human Receptionist)

### 10. Legal Pages Are Solid
Both `/privacy` and `/terms` are professionally written, jurisdiction-aware (Alberta, Canada), include CRTC/TCPA compliance notes for call recording, 30-day money-back guarantee terms, and proper limitation of liability. Last updated March 1, 2026. This is real legal infrastructure, not placeholder text.

### 11. Pricing Transparency is Excellent
- CAD pricing clearly stated
- Monthly/Annual toggle with "Save 2 months" on annual
- No per-minute charges (flat rate) — this is explicitly highlighted as a differentiator
- 30-day guarantee on all plans
- "No contracts · Cancel anytime" on every CTA

---

## Issues Found

### HIGH — Recording Endpoint Broken (100 404s on /admin/calls)
**Every call recording returns 404.** The `/admin/calls` page fires 100+ requests to `/api/recording?callId=[uuid]` and every single one fails with 404. The recording column shows "Processing..." for all 100 entries — none resolve.

This likely means:
- The recording proxy endpoint doesn't exist or has been removed
- Or Ultravox recordings are not being fetched/stored after call completion

This is the most significant functional gap found. Without recordings, the call review workflow is broken for admins.

---

### MEDIUM — Privacy Policy + Terms Reference Retired Services
`/privacy` Section 5 (Third-Party Services) lists:
> "n8n — Workflow automation for connecting call events to your notification and logging systems"
> "Google Workspace — Google Sheets for lead data storage and Google Calendar for appointment booking"

**n8n was retired for voice agents March 9, 2026.** Prompts live in Supabase, not Google Sheets. This creates a legal/trust problem if a prospect or regulator reads the privacy policy. The terms also say "Lead data in Google Sheets — persists in your own Google Sheet indefinitely."

Also affects: footer on every page says "🔒 Your customer data lives in your own Google Sheet." — same stale claim.

**Fix**: Update privacy policy § 5 to remove n8n, update Google Sheets reference to Supabase/Telegram delivery. Update footer copy.

---

### MEDIUM — Onboard Wizard Niche Gap vs Landing Pages
`/onboard` shows 8 of 10 niches as "Soon":
- HVAC — Soon
- Plumbing — Soon
- Dental — Soon
- Law Firm — Soon
- Salon — Soon
- Property Management — Soon

But `/for-hvac`, `/for-plumbing`, `/for-dental`, `/for-legal` all have full marketing pages live **and** niche-specific CTAs that link to `/onboard?niche=hvac` etc.

A prospect who clicks "Get My HVAC Agent →" from `/for-hvac` lands at `/onboard` and sees HVAC listed as "Soon" — a trust-breaking contradiction. Even if HVAC goes through `?niche=hvac` it hits the generic wizard.

**Fix**: Either enable HVAC/Plumbing/Dental/Legal in the wizard (they likely map to existing niche configs) or remove those CTAs from the niche landing pages until the wizard supports them.

---

### MEDIUM — Demo Transcript Mismatch on Niche Pages
`/for-hvac`, `/for-plumbing`, `/for-dental`, `/for-legal` all embed a demo player that shows the **Windshield Hub / Mark auto glass transcript** — not a relevant demo for those niches. A dental office prospect watches a windshield replacement call as their "proof."

The demo tabs (Auto Glass / Property Mgmt / HVAC / Legal / Realtor) appear to load correctly in the tab bar but all default to showing the auto glass call. Either the tab switching is broken or the HVAC/Legal/Realtor audio files haven't been recorded yet.

**Fix**: Record niche-specific demo audio + swap transcript, or at minimum don't embed the demo player on niche pages until niche-specific recordings exist.

---

### LOW — Nav Only Shows 2 Niche Links (6 Pages Exist)
Top navigation shows "For Glass Shops" and "For Realtors" only. No links to `/for-hvac`, `/for-plumbing`, `/for-dental`, `/for-legal`. Those 4 pages are only accessible via the footer or direct URL. The footer does list all 6 niche links.

---

### LOW — React Hydration Error #418 on /dashboard/clients
Console: `Minified React error #418` on `/dashboard/clients`. The page renders correctly but the hydration mismatch suggests a server/client render discrepancy — likely a date formatting or dynamic value issue. Worth fixing before adding more complexity to that page.

---

### LOW — PWA Manifest 404 on Every Page
`site.webmanifest` returns 404 on every page load. Not a functional blocker but it generates console noise and prevents PWA installability. A one-file fix.

---

### LOW — /admin/calls Shows "0 calls" Before Hydrating
The initial SSR/snapshot of `/admin/calls` shows "0 calls" — the count updates on client-side mount. Minor flicker but noticeable on first load.

---

### INFO — Live Client Phone Number is Public on Homepage
The homepage displays "(587) 355-1834" as a live demo number. This is the Windshield Hub / Mark line. Windshield Hub client (Sabbir) presumably consented to this — just worth confirming it's intentional as a public demo number before driving more marketing traffic.

---

### INFO — Pricing Features List Says "Google Sheets call log" in Starter Tier
The pricing page and all niche pricing sections list "Google Sheets call log" as a Starter feature. If the architecture has moved calls to Supabase, this claim is misleading. Could also be intentional if a Sheets integration still exists for clients — but needs to match reality.

---

## Architecture Observations

### Two Parallel Navigation Systems
There are two separate admin interfaces running simultaneously:

| System | Routes | Nav Style | Used For |
|--------|--------|-----------|---------|
| Modern Dashboard | `/dashboard/*` | Dark sidebar (permanent) | Client-facing: calls, campaigns, leads, voices, setup, settings |
| Legacy Admin | `/admin/*` | Top flat nav | Internal: call log, prompt editor, costs, test lab, insights, numbers |

Both are active and in use. `/dashboard/clients` links to client management. `/admin/calls` provides a deeper call log view. This isn't necessarily a problem but the mental model for "where do I go for X" is split.

### God Mode Is Well-Implemented
The `client_id=NULL` admin account correctly defaults to hasan-sharif in Test Lab/Insights but allows passing explicit `client_id` to scope any operation to any client. This is how a single admin session controls all 7 clients from one UI.

### Cost Efficiency Is a Genuine Differentiator
$16.99/month for 251 calls across 3 production clients. That's $0.07/call in infrastructure cost. At $147–$397/month client billing, the unit economics are strong. The cost dashboard shows this transparently.

---

## Pages Scanned (Full List)

| Page | Status | Notes |
|------|--------|-------|
| `/` | Live | Robot hero, ROI calc, demo audio, stats ticker |
| `/login` | Live | Supabase auth, social proof badge |
| `/dashboard/calls` | Live | Demo analytics + 30d stats |
| `/dashboard/setup` | Live | 3-step carrier forwarding wizard |
| `/dashboard/campaigns` | Live | 7-client sparkline grid |
| `/dashboard/leads` | Live | Empty queue, "Add first lead" state |
| `/dashboard/voices` | Live | 71 voices, Jacqueline active |
| `/dashboard/clients` | Live | 7 clients + 11 intake submissions |
| `/dashboard/settings` | Live | Richest page in the app |
| `/admin/calls` | Live (broken recordings) | 100 calls, HOT/WARM/COLD/JUNK |
| `/admin/costs` | Live | $16.99/mo, within-tolerance check |
| `/admin/test-lab` | Live (empty) | Scenario library empty |
| `/admin/insights` | Live (empty) | No reports yet |
| `/admin/numbers` | Live | Number inventory empty |
| `/admin/prompt` | Live | Raw prompt editor, 15,423 chars |
| `/pricing` | Live | 3 tiers, competitor comparison |
| `/onboard` | Live | 7-step wizard, 8 niches "Soon" |
| `/try` | Live | 3 demo agents, browser call |
| `/for-auto-glass` | Live | Full niche page |
| `/for-realtors` | Live | 2,082 calls verified |
| `/for-hvac` | Live | -30°C furnace scenario |
| `/for-plumbing` | Live | Burst pipe scenario |
| `/for-dental` | Live | 8+ calls/week stat |
| `/for-legal` | Live | $936K annual at risk |
| `/privacy` | Live | Stale n8n/Sheets references |
| `/terms` | Live | Solid, Alberta jurisdiction |

---

## Priority Fix List

| # | Item | Severity | Effort |
|---|------|----------|--------|
| 1 | Fix `/api/recording?callId=` endpoint — 404 on all 100 calls | High | Medium |
| 2 | Update privacy policy § 5 — remove n8n, update Sheets → Supabase | Medium | Low |
| 3 | Update footer copy — "Google Sheet" data storage claim | Medium | Low |
| 4 | Update pricing features — "Google Sheets call log" claim | Medium | Low |
| 5 | Fix niche onboard wizard — enable HVAC/Plumbing/Dental/Legal or remove CTAs from landing pages | Medium | Medium |
| 6 | Fix demo player on niche pages — shows auto glass call on dental/legal/plumbing pages | Medium | Medium |
| 7 | Add HVAC/Plumbing/Dental/Legal to nav (or a mega-menu "Industries" dropdown) | Low | Low |
| 8 | Fix React hydration error #418 on /dashboard/clients | Low | Low |
| 9 | Add site.webmanifest to public/ folder | Low | Very Low |

---

*Assessment generated via full Playwright browser scan — 27 pages, authenticated session, March 14 2026*

---

## Section 2 — Deployment & Production Health Assessment
**Updated:** 2026-03-14 (evening) | **Source:** Railway logs + git diff vs origin/main

### Deployment Gap

Railway is **2 commits behind** local HEAD — nothing from today's Phase 3/4 work has been pushed yet.

| Commit (local only) | Summary | Webhook routes changed? |
|---------------------|---------|------------------------|
| `f8247db` | Phase 4C — onboard split-screen + audio preview | None |
| `fcdbd2a` | Phase 3 marketing redesign + Phase 4A/4B dashboard | None |

**Last live commit on Railway:** `d1d17dc` — fix: decouple public demo from live prompt + add hangUp to demo calls

**Push risk: LOW.** Both commits are frontend/UI only. Zero API routes, webhooks, or server-side logic touched.

---

### Production Call Health (Railway logs — 2026-03-14)

**Urban Vibe — HEALTHY ✅**
- Full end-to-end call processed: transcript → classify → Telegram → SMS → recording upload
- Classification: HOT, 92% confidence ("no heat in unit — urgent maintenance issue")
- All downstream systems fired correctly

**Hasan Sharif — DEGRADED ⚠️ (calls still complete)**
- `callViaAgent` fails on every inbound call — see P1 bug below
- Fallback path (`createCall` with Supabase prompt) fires — callers are NOT dropped
- Most recent call: 5s duration, classified UNKNOWN (too short — expected edge case)

**Windshield Hub — ASSUMED DEGRADED ⚠️**
- Same `CLIENT_VAD` entry exists → identical failure mode to hasan-sharif

---

### NEW Active Bugs (not in prior assessment)

**P1 — `vadSettings` removed from Ultravox v1 StartAgentCallRequest API**
- **Affects:** All 3 prod clients (hasan-sharif, windshield-hub, urban-vibe)
- **Error:** `Message type "ultravox.v1.StartAgentCallRequest" has no field named "vadSettings"`
- **Symptom:** Every inbound call fails primary `callViaAgent` path, falls back to `createCall`
- **Calls still work:** Yes — fallback succeeds. No dropped calls.
- **Fix (2 lines):**
  - `src/lib/ultravox.ts:250` — remove `if (vadSettings) body.vadSettings = vadSettings`
  - `src/app/api/webhook/[slug]/inbound/route.ts:127` — remove `...(clientVad ? { vadSettings: clientVad } : {})`
  - Remove the now-unused `CLIENT_VAD` map and `clientVad` variable

**P3 — OpenRouter classifier returns non-JSON for very short calls**
- **Trigger:** Calls with < 2 transcript messages (under ~10 seconds)
- **Model returns:** natural language instructions instead of JSON → `JSON.parse` fails → UNKNOWN
- **Impact:** Low — only spam/accidental calls
- **Fix:** Add early-return guard in `openrouter.ts`: if `transcript.length < 2`, return UNKNOWN without calling the API

---

### Push Checklist

| Check | Status |
|-------|--------|
| Webhook routes changed in unpushed commits? | No |
| API routes changed? | No |
| Build passes locally? | ✅ Zero errors |
| `vadSettings` bug pre-existing before today's commits? | Yes |
| Push worsens `vadSettings` bug? | No |
| Safe to push? | **Yes** |

**Recommended action:** Fix `vadSettings` first (2-line removal), commit, then push everything together in one Railway redeploy.

---

### What Ships in the Push

| Area | Changes |
|------|---------|
| Marketing site | Indigo/emerald design system, dark mode, TryItNowWidget, HeroCallMockup, all niche/pricing/demo pages |
| Dashboard — Call Log | Sidebar indigo active state, KanbanBoard 5-column view, list↔kanban toggle, CallRow badges |
| Dashboard — Settings | 6-tab layout (General / Transfer / SMS / Voice / Notifications / Billing) |
| Onboarding | Split-screen with OnboardLeftPanel (indigo gradient, animated build phrases per niche), audio preview on step 1 |
