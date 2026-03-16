# Agent Intelligence Features — Implementation Complete
**Date:** 2026-03-15
**Status:** Build passes ✅ | Promptfoo tests 3/3 pass ✅ | Not yet deployed (in-progress other session)

---

## What Was Built

Four major features that transform unmissed.ai agents from "knows what you typed in the wizard" to genuinely intelligent about each client's business.

---

## Feature 1 — Website Auto-Scraping → Richer Prompts

### What it does
When a client provides a `websiteUrl` in step 2 of onboarding, the prompt generation flow scrapes their site and extracts real FAQs, services, pricing mentions, and staff details — then bakes them into the agent's knowledge base.

### Files created/modified
| File | Change |
|------|--------|
| `agent-app/src/lib/firecrawl.ts` | **NEW** — `scrapeAndExtract(url)` calls Firecrawl REST API, returns markdown |
| `agent-app/src/lib/openrouter.ts` | Added `extractWebsiteContent(rawMarkdown)` — Claude Haiku pass to distill scraped content to ~1500 chars |
| `agent-app/src/lib/prompt-builder.ts` | Added `websiteContent?: string` param to `buildPromptFromIntake()` — appended to KB section |
| `agent-app/src/app/api/dashboard/generate-prompt/route.ts` | Scrape step added after Sonar enrichment |
| `agent-app/src/app/api/stripe/create-public-checkout/route.ts` | Same scrape step added (self-serve path) |

### New env var needed
```
FIRECRAWL_API_KEY=...   # add to Railway
```

### How it flows
1. Client enters `https://theirbiz.com` in onboarding step 2
2. On prompt generation (admin or Stripe activation): Firecrawl scrapes the URL
3. Claude Haiku extracts: services, FAQs, pricing, hours, staff names
4. Extracted content is appended to the prompt's PRODUCT KNOWLEDGE BASE section
5. Agent now knows real details from the client's actual website

---

## Feature 2 — CSV / Context Data Injection (all niches)

### What it does
Any client can paste structured data (tenant roster, menu, service catalog, price list) into the dashboard. This data is injected into every call in real-time via Ultravox `templateContext` — the agent can reference it live during conversations.

### Supabase migration applied
```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS context_data TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS context_data_label TEXT;
```

### Files created/modified
| File | Change |
|------|--------|
| `agent-app/src/lib/ultravox.ts` | `contextData` added to `contextSchema` in `createAgent()` + `updateAgent()`. `callViaAgent()` interface extended with `contextData?: string`. `{{contextData}}` appended after validation with `## INJECTED REFERENCE DATA` instruction block |
| `agent-app/src/app/api/webhook/[slug]/inbound/route.ts` | Fetches `context_data` + `context_data_label` from DB. Builds `contextDataStr`. Passes to `callViaAgent()` and to `createCall()` fallback path |
| `agent-app/src/app/api/dashboard/settings/route.ts` | PATCH handling for `context_data`, `context_data_label` |
| `agent-app/src/app/dashboard/settings/SettingsView.tsx` | **New "Context Data" card** in General tab — label field + textarea (8000 char limit) + Save button |
| `agent-app/src/app/dashboard/settings/page.tsx` | Added `context_data`, `context_data_label` to `ClientConfig` interface and Supabase SELECT |
| `agent-app/src/app/onboard/steps/niches/property-management.tsx` | Added optional tenant roster textarea (stores in `nicheAnswers.tenantRoster`) |

### How it works at call time
```
Caller: "I'm in unit 4B — there's a leak"
Agent: [reads injected context silently] → "I see that's Mike Chen in 4B.
       Let me log this maintenance request..."
```
The `{{contextData}}` placeholder resolves to the stored CSV/text at call start. If empty, resolves to `''` (no effect).

### Usage
1. Dashboard → Settings → General → "Context Data" card
2. Set label (e.g. "Tenant List", "Menu", "Price Sheet")
3. Paste CSV or plain text (max 8000 chars / ~1500 tokens)
4. Save — applies to all new calls immediately

---

## Feature 3 — Restaurant Niche (new)

### What it does
Full restaurant/food service niche with menu injection via Feature 2's context data system.

### Files created/modified
| File | Change |
|------|--------|
| `agent-app/src/app/onboard/steps/niches/restaurant.tsx` | **NEW** — cuisine type (radio), order types (multi-select), menu textarea (8000 char), phone orders toggle |
| `agent-app/src/app/onboard/steps/step4.tsx` | Added `restaurant: RestaurantNiche` to NICHE_COMPONENTS registry |
| `agent-app/src/app/onboard/page.tsx` | `getStepSequence()` — added `restaurant` to `[1, 2, 4, 7]` fast-track (needs step 4 for menu) |
| `agent-app/src/app/onboard/steps/step1.tsx` | Added `UtensilsCrossed` icon + `restaurant` to `LIVE_NICHES` |
| `agent-app/src/types/onboarding.ts` | Added `"restaurant"` to `Niche` union, `NICHE_CONFIG`, `nicheLabels`, `nicheEmojis`, `defaultAgentNames` |

---

## Feature 4 — Google Calendar Booking (any niche)

### What it does
Agent detects booking intent → checks real Google Calendar availability → offers slots → books appointment → caller gets confirmation. Works for any niche with `booking_enabled=true`.

### Supabase migration applied
```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS booking_service_duration_minutes INT DEFAULT 60;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS booking_buffer_minutes INT DEFAULT 15;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS calendar_beta_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS calendar_auth_status TEXT;
```

### Files created
| File | What it does |
|------|-------------|
| `agent-app/src/lib/google-calendar.ts` | `getAccessToken(refreshToken)` exchange, `listSlots(...)` fetch available times, `createEvent(...)` book appointment |
| `agent-app/src/app/api/auth/google/route.ts` | OAuth initiation — generates nonce, sets httpOnly cookie, redirects to Google consent |
| `agent-app/src/app/api/auth/google/callback/route.ts` | OAuth callback — verifies nonce (CSRF protection), exchanges code for tokens, stores `google_refresh_token` + `google_calendar_id` |
| `agent-app/src/app/api/calendar/[slug]/slots/route.ts` | `GET ?date=YYYY-MM-DD` → returns available time slots in client's timezone. On auth failure: sets `calendar_auth_status='expired'`, returns `{ fallback: true }` |
| `agent-app/src/app/api/calendar/[slug]/book/route.ts` | `POST { date, time, service, callerName }` → re-verifies slot (race condition protection), creates calendar event |

### Files modified
| File | Change |
|------|--------|
| `agent-app/src/app/dashboard/settings/SettingsView.tsx` | **New "Booking" card** — visible when `calendar_beta_enabled=true` or admin. Connect Google Calendar button, auth status, service duration selector, buffer time selector |
| `agent-app/src/app/dashboard/settings/page.tsx` | Added all 7 booking columns to `ClientConfig` + SELECT |
| `agent-app/src/app/api/dashboard/settings/route.ts` | PATCH for `booking_service_duration_minutes`, `booking_buffer_minutes`; admin-only PATCH for `booking_enabled`, `calendar_beta_enabled` |
| `agent-app/src/app/onboard/steps/niches/salon.tsx` | Added booking toggle + explainer note |
| `agent-app/src/lib/prompt-builder.ts` | Salon NICHE_DEFAULTS: 3 calendar error-handling rules (never promise without checking, fallback→callback flow, slot_taken→offer next) |

### Ultravox tools the agent uses
```json
{
  "modelToolName": "checkCalendarAvailability",
  "http": { "baseUrlPattern": "https://unmissed-ai-production.up.railway.app/api/calendar/{slug}/slots" }
},
{
  "modelToolName": "bookAppointment",
  "http": { "baseUrlPattern": "https://unmissed-ai-production.up.railway.app/api/calendar/{slug}/book" }
}
```

### Race condition protection (G11)
`/api/calendar/[slug]/book` re-checks availability before creating the event. If another booking took the slot, returns `{ booked: false, reason: 'slot_taken', nextAvailable: '...' }` and the agent offers the next open time.

### Token expiry handling (G10)
If refresh token fails: `calendar_auth_status` set to `'expired'` in DB, endpoint returns `{ available: false, fallback: true, reason: 'calendar_auth_expired' }`. Agent routes to callback flow instead of promising a booking.

---

## Before Calendar Booking Goes Live (manual steps)

1. **Google Cloud Console** — create OAuth 2.0 credentials
   - Redirect URI: `https://unmissed-ai-production.up.railway.app/api/auth/google/callback`
   - Scopes: `https://www.googleapis.com/auth/calendar`

2. **Railway env vars** — add:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

3. **Add test client emails** to Google Cloud Console test users (avoids "app not verified" warning for beta users — limit: 100)

4. **Enable per client** — admin dashboard:
   - `calendar_beta_enabled = true` → shows Booking card
   - Client clicks "Connect Google Calendar" → OAuth flow
   - `booking_enabled = true` → calendar tools added to Ultravox agent

---

## Feature 5 — Business Facts + Extra Q&A Runtime Injection

**Date:** 2026-03-15

### What it does
Two new per-client knowledge fields, editable from the dashboard Settings → General tab, injected at call time via Ultravox `templateContext` — same runtime injection pattern as `context_data` (Feature 2).

- **Business Facts** — stable prose a client types once: hours exceptions, key staff names, parking notes, nearby landmarks. Injected as `## Business Facts\n[text]`.
- **Extra Q&A** — up to 10 custom Q&A pairs covering questions the wizard didn't ask. Formatted as `"[question]" → "[answer]"` and injected as `## Q&A\n[pairs]`.

Both are skipped silently if empty (null, `[]`, or all-blank pairs — no empty block appears in the prompt).

### Injection order (stable → dynamic)
```
[system prompt]
[callerContext]         ← returning-caller history
[businessFacts]         ← stable business info (new)
[extraQa]               ← custom Q&A pairs (new)
## INJECTED REFERENCE DATA
[contextData]           ← per-call lookup data (tenant roster, menu, etc.)
```

### Files modified
| File | Change |
|------|--------|
| `agent-app/src/app/api/webhook/[slug]/inbound/route.ts` | SELECT adds `business_facts, extra_qa`; builds injection blocks; passes to `templateContext` + fallback `promptFull` |
| `agent-app/src/lib/ultravox.ts` | `createAgent` + `updateAgent` contextSchema adds `businessFacts`/`extraQa`; systemPrompt template includes new placeholders; `updateAgent` guard is backwards-compatible (appends missing placeholders on next deploy); `callViaAgent` always passes all 4 templateContext keys |
| `agent-app/src/app/api/dashboard/browser-test-call/route.ts` | SELECT + same injection blocks as inbound webhook |
| `agent-app/src/app/dashboard/settings/SettingsView.tsx` | `saveAdvanced()` + card UI already existed — this session: no changes needed |

### Supabase columns
`business_facts TEXT` and `extra_qa JSONB` — already existed on `clients` table before this session. Settings PATCH route was already writing to them.

### Prompt deploys
After implementing, all 3 prod clients were redeployed to patch the Ultravox agents with the updated contextSchema:
- hasan-sharif v14 | windshield-hub v6 | urban-vibe v9
- Backwards-compat guard in `updateAgent()` ensures existing agents missing the new placeholders get them on next `/prompt-deploy`.

### Extra Q&A shape
```ts
{ q: string, a: string }[]   // stored as JSONB in clients.extra_qa
```
Formatted at injection time — never stored pre-formatted.

### Prompt History "View →" modal
Also added in this session: each Prompt History entry now has a "View →" button that opens a read-only modal showing the full prompt text. Closes on backdrop click or ×.
- New state: `viewingVersion: PromptVersion | null`
- Modal renders inside the General tab, outside the accordion

---

## Build Status

```
npm run build   ✅ PASSES (clean .next build, no TypeScript errors)
promptfoo tests ✅ 3/3 clients pass (hasan-sharif, windshield-hub, urban-vibe)
```

---

## API Key Model (current)

Feature 1 (scraping) and the Haiku extraction step both use **platform keys** stored in Railway env vars:
- `FIRECRAWL_API_KEY` — platform pays, no client UI
- `OPENROUTER_API_KEY` — platform pays, no client UI

Scraping runs automatically for any client with a `websiteUrl`. There's no per-client toggle yet — if you want to gate it later, add a `scraping_enabled BOOLEAN DEFAULT true` column and check it in `generate-prompt/route.ts`. BYOK (clients supply their own keys) is a future option once usage costs are meaningful.

---

## What's NOT Included (deferred)

- Booking tool registration in `createAgent()`/`updateAgent()` — currently only wired in Salon niche via prompt-builder instructions. Full tool injection into Ultravox agent's `selectedTools` when `booking_enabled=true` needs to be added to the provisioning path.
- "Rebuild from website" button in dashboard settings (Feature 1 UI trigger)
- Restaurant niche prompt builder entry in `NICHE_DEFAULTS` (prompt-builder.ts) — restaurant uses generic `other` prompt currently; needs a dedicated prompt template
