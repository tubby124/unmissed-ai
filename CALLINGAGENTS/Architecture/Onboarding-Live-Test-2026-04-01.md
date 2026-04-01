---
type: architecture
title: "Live Onboarding Test — Red Swan Pizza (2026-04-01)"
status: documented
created: 2026-04-01
tags: [onboarding, test, intelligence-pipeline, restaurant, phase7]
related:
  - "[[Architecture/Intelligence-Pipeline-Test-Findings]]"
  - "[[Architecture/Phase7-75-Second-Agent]]"
  - "[[Tracker/D339]]"
  - "[[Tracker/D340]]"
---

# Live Onboarding Test — Red Swan Pizza (2026-04-01)

## Test Parameters
- **Business**: Red Swan Pizza - Calgary Saddle Ridge (real GBP listing)
- **Niche**: restaurant (auto-detected)
- **Plan**: AI Receptionist (Core, $119/mo)
- **Agent**: Sofia
- **Method**: Playwright MCP browser automation on localhost:3000

## Timeline

### Step 1 — GBP Search (~5 seconds)
- Typed "Red Swan Pizza Calgary" in search box
- GBP auto-fill: business name, 4.3★ rating (605 reviews), hours, phone (403-568-1234), website
- Niche auto-detected as `restaurant`
- Agent name auto-assigned: Sofia
- Voice style: Jacqueline (Warm & Friendly) pre-selected
- Caller reason placeholders: niche-adaptive (reservation, catering, menu/allergy)
- **Intelligence generation fired in background** — invisible to user

### Step 2 — Plan Selection (~3 seconds)
- Three plan cards: Call Catcher ($49), AI Receptionist ($119, Popular), Front Desk Pro ($229)
- Selected AI Receptionist
- Auto-advanced to Launch step (plan click = advance)

### Step 3 — Launch (~15 seconds)
- **AgentIntelligenceCard rendered** — intelligence seed arrived in time
  - 5 intents: PLACE TAKEOUT ORDER, PLACE DELIVERY ORDER, DELIVERY AREA CHECK, MENU OR PRICING INQUIRY, URGENT ISSUE
  - 6 urgency triggers: order is wrong, food poisoning, missing items, cold pizza, never arrived, damaged food
  - 4 safety rules: no guaranteed delivery times, no food quality promises, no refunds/discounts, no allergen confirmation
  - Opening line: "Red Swan Pizza - Calgary Saddle Ridge — Sofia here, AI assistant..."
- GBP data summary visible (rating, hours, phone)
- Knowledge summary: 0 facts, 0 Q&As (before website scrape)
- Set email to redswantest@unmissed.ai
- Phone pre-filled from GBP: (403) 568-1234
- Website pre-filled: https://redswanpizza.ca/
- Notifications: Telegram
- Hit "Launch Sofia"

### Provisioning (~12 seconds)
- Status message: "Sofia will represent your 4.3★ reputation to callers in Calgary..."
- Created: Supabase client, Ultravox agent, website scrape triggered
- Redirected to dashboard
- Auto-started WebRTC test call (orb went LIVE)

### Dashboard State (post-provision)
- **Knowledge**: 10 facts, 4 Q&A (from GBP data)
- **Website**: redswanpizza.ca — 15 pages scraped, pending review
- **Agent readiness**: 3/5
- **Setup progress**: 50% (3 of 6)
- **Mode**: AI Receptionist (Active)
- **Trial**: 7 days, 0/50 minutes

### Knowledge Upload Test (user-driven)
- User navigated to Knowledge page → Upload Document
- **Rejected .md file** — only PDF/DOCX accepted → D348
- Uploaded .txt version of pizza menu (pizza_restaurant_menu.txt)
- AI Compiler extracted **12 items** (3.5K chars) in ~5 seconds
- Smart warning: "The source text is a menu for Firestone Pizza Co., not Red Swan Pizza in Calgary Saddle Ridge" (name mismatch detection!)
- Items categorized as **Pricing** with green badges
- Combo deals grouped as single items (e.g. "1 Large Pizza plus 12 Wings plus 2L Pop $34.99...")
- Verification checkboxes on pricing items ("I've verified this is current and accurate")
- "Add 12 items to Knowledge Base" button at bottom

## DB Verification

| Field | Value | Status |
|-------|-------|--------|
| slug | red-swan-pizza-calgary-saddle-ridge | ✅ |
| niche | restaurant | ✅ |
| selected_plan | core | ✅ |
| subscription_status | trialing | ✅ |
| TRIAGE_DEEP | present (5 intents) | ✅ |
| GREETING_LINE | present | ✅ |
| URGENCY_KEYWORDS | present | ✅ |
| FORBIDDEN_EXTRA | present | ✅ |
| CLOSE_PERSON | "Red" | ⚠️ BUG — D347 |
| system_prompt length | 18,847 chars | ⚠️ See investigation below |
| ultravox_agent_id | present | ✅ |

## Bugs Found

### BUG 1 — TRIAGE_DEEP JSON array string not converted (FIXED)
- **Severity**: HIGH
- **Root cause**: Haiku returns TRIAGE_DEEP as `"[{...}]"` (string containing JSON array). Code checked `typeof === 'string'` first and passed it through raw. The `Array.isArray` branch never fired.
- **Fix**: Added detection for JSON array strings — if string starts with `[`, parse and convert.
- **Commit**: cf3f624

### BUG 2 — CLOSE_PERSON gets first word of business name, not owner name
- **Severity**: MEDIUM
- **Root cause**: `provision/trial/route.ts` line 91: `(data.ownerName || data.businessName || '').split(' ')[0]`. GBP doesn't provide owner name, so it falls back to business name → "Red" from "Red Swan Pizza".
- **D-item**: D347

### BUG 3 — Prompt is 18,847 chars (INVESTIGATED — not blocking)
- **Severity**: LOW (design, not runtime bug)
- **Investigation**: DB prompt does NOT contain `{{callerContext}}`, `{{businessFacts}}`, `{{contextData}}` placeholders. These are appended by `createAgent()` / `updateAgent()` in ultravox.ts (line 774-776) when sending to Ultravox. The DB stores the raw prompt; Ultravox gets the prompt + placeholders.
- **12K limit**: The `validatePrompt()` 12K limit is only enforced on the settings PATCH path, not on provision. The provision route bypasses validation. This is a design gap but not a runtime issue — Ultravox accepts longer prompts.
- **Recommendation**: Add `validatePrompt()` to provision route OR increase the limit for auto-generated prompts that include TRIAGE_DEEP (which is inherently verbose).

### BUG 4 — .md file rejected by document uploader
- **Severity**: MEDIUM
- Upload modal only accepts PDF/DOCX. Markdown and plain text are common formats for menus/info.
- User had to save as .txt to upload.
- **D-item**: D348

## UX Observations

### AI Compiler is smart
- Correctly detected name mismatch ("Firestone Pizza Co." in menu vs "Red Swan Pizza" in business name)
- Categorized items as Pricing with green badges
- Verification checkbox pattern for pricing items is good trust signal
- Combo deals grouped correctly (all items + price in one line)

### Combo grouping issue
- Combo deals come through as one long string: "1 Large Pizza plus 12 Wings plus 2L Pop $34.99, 2 Medium Pizzas plus Cheesy Bread $31.99..."
- At call time, the agent will likely recite the whole combo as one block
- Future: could split combos into individual items with a "combo" tag
- Acceptable for now — tweakable post-launch

### Missing loading indicator during intelligence generation
- **D-item**: D345

### Knowledge upload not obvious from Overview
- User said "I want to be able to upload PDFs directly on the Overview"
- **D-item**: D346

### Orb should be global loading indicator
- User said the orb should be THE loading icon for all AI operations
- **D-item**: D349

## New D-items Created
- **D345** — Intelligence loading indicator UX
- **D346** — PDF/knowledge upload CTA on Overview page
- **D347** — CLOSE_PERSON fallback when no owner name
- **D348** — .md file upload rejected
- **D349** — Orb as global loading indicator

## What Worked Well
1. GBP auto-fill is fast and accurate — pulled name, rating, reviews, hours, phone, website in one search
2. Intelligence seed generated business-specific intents, not generic ones — PLACE_TAKEOUT_ORDER vs generic INFO_REQUEST
3. AgentIntelligenceCard on Launch step is a great confidence builder — "your agent already knows 5 intents"
4. 3-step flow is dramatically faster than old 7-step — estimate ~45 seconds total
5. Plan cards are clear and the auto-advance after selection reduces clicks
6. Website auto-scrape on provision means knowledge starts building immediately
7. AI Compiler name mismatch detection is smart and builds trust
8. Pricing verification checkboxes are a good pattern for high-risk knowledge
