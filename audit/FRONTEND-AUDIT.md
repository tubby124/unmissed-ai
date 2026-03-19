# unmissed.ai — Front-End Audit
**Date:** 2026-03-19
**Scope:** Homepage, `/try`, `/demo`, and all 6 onboarding wizard steps
**Method:** Live Playwright screenshots + code review of all page/component files
**Out of scope:** Backend, provisioning, database, Railway config

---

## Screenshots Index

| File | What it shows |
|------|--------------|
| `01-homepage-full.png` | Full homepage desktop |
| `02-try-page.png` | /try agent selection (desktop) |
| `03-demo-page.png` | /demo page |
| `04-onboard-step1.png` | Wizard step 1 — blank |
| `04b-onboard-step1-selected.png` | Wizard step 1 — Auto Glass selected |
| `05-onboard-step2-voice.png` | Wizard step 2 — voice picker |
| `06-onboard-step3-business.png` | Wizard step 3 — business basics |
| `07-onboard-step4-knowledge.png` | Wizard step 4 — FAQ/docs upload |
| `08-onboard-step5-callhandling.png` | Wizard step 5 — call handling |
| `09-onboard-step6-review.png` | Wizard step 6 — full-page review + pricing |
| `10-mobile-homepage.png` | Homepage at 390px viewport |
| `11-mobile-try.png` | /try at 390px viewport |

---

## What Users Experience Now

**Homepage → Hero:** User sees a bold headline, two CTAs ("Get My Agent" → `/onboard`, "Hear a Demo →" `#demo`), a phone number input widget ("Call Me"), and a floating "Talk to an Agent" pill at bottom-left linking to `/try`. Four competing demo entry points with no obvious primary path.

**Homepage → /try:** User selects one of 3 demo agents, enters their name (optional), then gets a live WebRTC call in the browser. Works well when mic is granted. The "Prefer to call from your phone?" section shows a dead "Phone demo coming soon" message.

**Homepage → /onboard (wizard):**
- Step 1: Industry selection + business name search + website URL
- Step 2: Voice picker (6 voices) + agent name input
- Step 3: Business basics (5 required fields — Continue disabled until all filled)
- Step 4: Document upload + FAQ pairs (both optional)
- Step 5: SMS follow-up toggle + call handling mode + after-hours option
- Step 6: Full review table + "Talk to [agent]" in-browser demo + plan picker + two CTAs (Start free trial / Activate now)

---

## Top 10 UX Problems

### 1. Four competing demo CTAs with no hierarchy
**Where:** Homepage hero
**Problem:** Users face: (a) `CallMeNowWidget` phone input → calls them, (b) "Hear a Demo →" → scrolls to audio player, (c) "Get My Agent" → onboarding, (d) "Talk to an Agent" FAB → `/try`. A first-time visitor has no idea which one is the primary action. The phone widget and the FAB are both always visible and both described as "demo" actions.
**Fix:** Pick one primary demo path and make it the hero CTA. The phone widget is highest-friction (requires a real number). The FAB is lowest-friction. Hero should have one primary CTA ("Try It Free") and one secondary ("See How It Works").

### 2. Real client identity exposed in public demo
**Where:** `/try` page, `try/page.tsx:29`
**Problem:** The third demo option reads "Hasan Sharif — EXP Realty" — a real client's full name and brokerage brand. Every anonymous visitor, competitor, and bot sees this. The demo-prompts.ts `real_estate` entry also has `clientSlug: 'hasan-sharif'` fetching his live production prompt.
**Fix:** Replace with a fictional company ("Sunrise Realty Group" / "Alex" or similar). The demo should use `demo-real-estate` slug pulling a sanitized demo prompt, not the live production client.

### 3. "Phone demo coming soon" dead-end section
**Where:** `/try` page, `try/page.tsx:220–245`
**Problem:** The section has a heading "Prefer to call from your phone?", full descriptive copy ("press 1 for auto glass, 2 for property management…"), and then renders `<p>Phone demo coming soon</p>` because `NEXT_PUBLIC_DEMO_TWILIO_NUMBER` is unset. The detailed IVR instructions promise something that doesn't exist and make the product look broken.
**Fix:** Conditionally render the entire section only when `demoNumber` is set. Until then, remove it completely.

### 4. NicheSelectorGrid preview is desktop-only
**Where:** Homepage NicheSelectorGrid, `NicheSelectorGrid.tsx`
**Problem:** The homepage industry grid instructs users to "Hover a tile to see what lead cards look like for your business." On any touch device, hover never fires and the preview panel is permanently hidden. The hover preview is the entire value proposition of the section on mobile.
**Fix:** Add an `onClick` handler on mobile (detect `window.innerWidth < 768` or use a CSS `@media` + `focus-within`) that opens the preview panel. Or replace with a static carousel that auto-cycles.

### 5. Pricing inconsistency: homepage vs wizard
**Where:** Homepage `PricingCards` (annual toggle default: $147/$247/$397 CAD) vs Wizard step 6 ($49/$99/$199/mo)
**Problem:** These are completely different numbers in the same app with no explanation. A user who reads the homepage pricing and then starts the wizard sees prices 3× lower in the wizard — or vice versa. There's no annotation that the homepage is showing annual pricing or a different tier set.
**Fix:** Both views must derive from the same price constants. If the wizard shows a simplified "get started" pricing and the full page shows CAD annual rates, add a clear label and toggle so the relationship is obvious.

### 6. Back button floats in the middle of Step 6 review table
**Where:** Wizard step 6, visible in `09-onboard-step6-review.png`
**Problem:** The `← Back` button appears visually between the "Business" and "Callback #" rows of the review summary table, not in the bottom sticky bar where it belongs on all other steps. The sticky bottom bar overlaps or displaces into the scrollable content on the final step.
**Fix:** The sticky bottom bar needs `position: sticky; bottom: 0; z-index: 10` enforced. The step 6 review content may be pushing it out. Check that the bottom bar container always sits below the scrollable content.

### 7. Wizard step 3: 5 required fields, zero inline guidance, Continue disabled
**Where:** Wizard step 3 `06-onboard-step3-business.png`
**Problem:** Continue is disabled until all 5 required fields (name, phone, email, city, hours) are filled. There's no tooltip, no asterisk explanation, and no validation showing which field is incomplete. On mobile, all fields don't fit in one viewport — a user scrolling might miss that "Business hours" below the fold is required. The page just refuses to advance.
**Fix:** Add a "Fill in all required fields (*) to continue" note near the Continue button when it's disabled. Add real-time validation so filled fields get a green checkmark and empty required fields get a red border on blur.

### 8. Wizard step 6 "manual steps" warning buries the critical onboarding blockers
**Where:** Wizard step 6 bottom, orange box
**Problem:** The orange box at the very bottom reads: "After activation — 2 quick manual steps: 1. Set up Telegram notifications, 2. Forward your business phone." These aren't optional UX polish — they are **required for the product to function at all**. Without phone forwarding, no call ever reaches the agent. Without Telegram, no notification is received. Calling them "2 quick manual steps" after a $49/mo payment is a support time-bomb.
**Fix:** Either move these instructions to Step 5 (before payment), or add a "What's next" explanation page immediately after payment that walks through forwarding setup step-by-step. Don't hide the critical path behind a yellow box at the bottom of the review.

### 9. No link to /try in the navigation
**Where:** `Navbar.tsx`
**Problem:** The navbar has: How It Works, Pricing, Industries, "Try Free" (→ /onboard), Log In, Sign Up Free. There is no "Live Demo" or "Try It" link pointing to `/try`. The best demo experience in the product is effectively hidden behind a floating FAB and a scrollable section. A high-intent visitor navigating the site by the nav bar never discovers it.
**Fix:** Add "Try Demo" between "Pricing" and "Try Free" in the desktop nav. This is the highest-trust-building page in the product.

### 10. /demo page is an orphan duplicate
**Where:** `/demo/page.tsx`
**Problem:** The `/demo` page renders `DemoAudioPlayer` (already on the homepage) + a static `LeadCard` locked to `niche="auto-glass"`. The footer links to `/demo` ("Demo" link). But the page adds zero new value over scrolling to the `#demo` section on the homepage. It's a dead-end page without navigation to `/try` or `/onboard` in the body content — just the footer.
**Fix:** Either (a) redirect `/demo` → `/#demo`, or (b) reframe `/demo` as a proper landing page for demo seekers with a clear CTA to `/try` prominently at the top.

---

## Top 10 Code / Refactor Problems

### 1. Duplicate AGENTS array — `/try/page.tsx` vs `demo-prompts.ts`
**File:** `src/app/try/page.tsx:10–35`, `src/lib/demo-prompts.ts:29–299`
**Problem:** `DEMO_AGENTS` in `demo-prompts.ts` has company names, agent names, descriptions, voice IDs, and Supabase slugs. The `/try` page defines its own separate `AGENTS` array with the same company/agent names plus colors. If a demo changes (e.g., "Tyler" renamed or auto_glass swapped), two files must be updated.
**Fix:** `/try/page.tsx` should import from `demo-prompts.ts`. Add a `color` field to `DemoAgent` interface and derive the AGENTS array: `Object.values(DEMO_AGENTS).filter(a => a.id !== 'unmissed_demo').map(a => ({...a, color: NICHE_COLORS[a.niche]}))`

### 2. `DemoAudioPlayer` rendered identically on homepage and `/demo`
**File:** `src/app/page.tsx:79`, `src/app/demo/page.tsx`
**Problem:** Exact same component, same props, same output — two pages. One page (`/demo`) exists only to show this component plus a static `LeadCard`. Pure duplication with no differentiation.
**Fix:** Remove `/demo/page.tsx` or redirect it. Add `id="demo"` anchor to the homepage section (it already exists as `#demo` in the "Hear a Demo →" CTA). The footer "Demo" link should point to `/#demo`.

### 3. `HeroCallMockup.tsx` hardcoded to auto glass
**File:** `src/components/HeroCallMockup.tsx`
**Problem:** The animated hero call mockup hardcodes "Crystal Clear Auto Glass", "Tyler", "Auto Glass" throughout. It's a marketing asset that implies the product only works for auto glass shops.
**Fix:** Accept props or read from `DEMO_AGENTS.auto_glass` constants. Better: animate through multiple niches (cycle every 4 seconds) to show breadth.

### 4. `HowItWorks.tsx` hardcoded stat
**File:** `src/components/HowItWorks.tsx`
**Problem:** "8,445+ calls handled" is a static string. It will become stale and is currently a made-up placeholder that doesn't match reality.
**Fix:** Fetch the real count from `SELECT COUNT(*) FROM call_logs` at build time (or ISR) and pass it as a prop. Or remove the stat entirely until it's real data.

### 5. In-memory rate limiter resets on every Railway redeploy
**File:** `src/app/api/demo/start/route.ts`
**Problem:** `const demoCallCounts = new Map<string, {count: number, resetAt: number}>()` is module-level state. Railway restarts the Node process on every git push (auto-deploy). The rate limiter counter resets to zero on every deploy, providing no real protection against rapid abuse.
**Fix:** Move to Supabase: `INSERT INTO demo_rate_limits (ip, count, reset_at) ON CONFLICT DO UPDATE`. Or use Upstash Redis if latency is a concern. Even a simple `setTimeout`-based in-memory approach is fine for low traffic — just document the limitation.

### 6. `NicheSelectorGrid` wrong href on Property Mgmt tile
**File:** `src/components/NicheSelectorGrid.tsx` (from snapshot: `/for-realtors` link on Property Mgmt tile)
**Problem:** The Property Management tile links to `/for-realtors` — the real estate landing page. Property managers and realtors are different audiences. A property manager clicking "See example →" lands on a page about booking showings and market analysis, not tenant management.
**Fix:** Change the href to `/for-property-mgmt` (or create that page). In the interim, link to `/try` with `?agent=property_mgmt`.

### 7. Pricing values hardcoded in two separate components
**File:** `src/components/PricingCards.tsx` (homepage), `src/app/onboard/` (wizard step 6)
**Problem:** The homepage shows $147/$247/$397 CAD (annual mode default), the wizard shows $49/$99/$199. No shared constants file. If prices change, two codepaths need updating. The relationship between these two sets of numbers (are they the same plan at different billing cycles? different tiers entirely?) is unclear in the code.
**Fix:** Create `src/lib/pricing.ts` with a `PLANS` constant array. Both components import from it. Include both monthly and annual variants. This also makes it easy to A/B test pricing.

### 8. `process.env.NEXT_PUBLIC_DEMO_TWILIO_NUMBER` renders misleading copy
**File:** `src/app/try/page.tsx:220–243`
**Problem:** When the env var is unset, the entire "Prefer to call from your phone?" section renders with full copy (heading, descriptive paragraph, IVR instructions) before falling through to "Phone demo coming soon". The descriptive copy creates a promise that the fallback immediately breaks.
**Fix:** `{demoNumber ? <PhoneDemo number={demoNumber} /> : null}` — remove the entire section when unset. Don't tease features that don't exist.

### 9. `DemoCall.tsx` lazily loads `ultravox-client` on call start
**File:** `src/components/DemoCall.tsx`
**Problem:** The Ultravox client SDK is dynamically imported (`import('ultravox-client')`) inside the `startCall` function that runs on mount. This adds a network round-trip at the moment the user is most excited to start. On a slow connection, there's a blank "connecting" state for 2–3 extra seconds while the SDK loads.
**Fix:** Import `ultravox-client` at the module level (it's already a `"use client"` component, so it won't SSR). The bundle impact is acceptable for a dedicated demo page.

### 10. Wizard state is not persisted across browser refresh
**File:** `src/app/onboard/` (implied by client-side `useState` architecture)
**Problem:** All wizard state lives in React state. If the user refreshes on step 4 (after filling in business basics), they restart from step 1 with everything cleared. On mobile, this happens easily if the browser background-kills the tab.
**Fix:** Persist wizard state to `localStorage` (keyed by a session UUID) with a short TTL (1 hour). On mount, check localStorage for in-progress state and offer to resume. This is a standard onboarding pattern and reduces drop-off on slow form steps.

---

## Phased Fix Plan

### Phase 1 — Critical bugs (break/mislead the user)
**Effort: ~3 hours | Files: 3**

1. **Remove "Phone demo coming soon" copy** — `try/page.tsx`: wrap entire phone section in `{demoNumber && (...)}`, delete the misleading IVR instructions
2. **Fix Property Mgmt NicheSelectorGrid href** — `NicheSelectorGrid.tsx`: change `/for-realtors` → `/for-property-mgmt`
3. **Replace "Hasan Sharif — EXP Realty" in /try** — `try/page.tsx`: use fictional real_estate demo company name; point to sanitized `demo-real-estate` Supabase slug

### Phase 2 — Data consistency
**Effort: ~2 hours | Files: 2–3**

4. **Unify AGENTS with DEMO_AGENTS** — Add `color` + derived display array to `demo-prompts.ts`; `/try/page.tsx` imports from it
5. **Create `src/lib/pricing.ts` constants** — Both PricingCards and wizard step 6 import from shared source; resolve the $49 vs $147 discrepancy with clear monthly/annual/CAD labels

### Phase 3 — CTA clarity + navigation
**Effort: ~3 hours | Files: 2–3**

6. **Add "Try Demo" to Navbar** — `Navbar.tsx`: insert link between "Pricing" and "Try Free"
7. **Hero CTA consolidation** — `page.tsx` + `HeroContent.tsx`: Remove or deprioritize one of the four demo entry points; establish one primary ("Try It") and one secondary ("How It Works")
8. **Remove or redirect `/demo`** — Delete `app/demo/page.tsx` or redirect to `/#demo`; update Footer link

### Phase 4 — Onboarding UX polish
**Effort: ~4 hours | Files: 2–4**

9. **Wizard step 3: inline validation + Continue guidance** — Add per-field blur validation + "Fill required fields to continue" tooltip near disabled button
10. **Wizard step 6: Back button layout fix** — Audit sticky bar CSS on final step; ensure `← Back` is always in the bottom bar
11. **Wizard: move "manual steps" earlier** — Move phone forwarding + Telegram setup explanation to a dedicated "What happens next" page immediately post-payment, not buried in the pre-payment review

### Phase 5 — Code quality
**Effort: ~3 hours | Files: 3–4**

12. **Persist wizard state to localStorage** — Prevent data loss on refresh
13. **Fix in-memory rate limiter** — Move to Supabase or document the limitation
14. **Remove `DemoAudioPlayer` duplication** — Consolidate to homepage section only
15. **HeroCallMockup: read from DEMO_AGENTS** — Remove hardcoded "Crystal Clear"/"Tyler" strings

---

## Files to Change First (Priority Order)

| Priority | File | Change |
|----------|------|--------|
| P0 | `src/app/try/page.tsx` | Remove "phone demo coming soon" section; replace Hasan Sharif with fictional agent |
| P0 | `src/components/NicheSelectorGrid.tsx` | Fix Property Mgmt href |
| P1 | `src/app/try/page.tsx` | Import AGENTS from demo-prompts.ts |
| P1 | `src/lib/pricing.ts` (new) | Shared price constants |
| P1 | `src/components/PricingCards.tsx` | Import from pricing.ts |
| P1 | `src/components/Navbar.tsx` | Add "Try Demo" link |
| P2 | `src/app/page.tsx` | Consolidate hero CTAs |
| P2 | `src/app/demo/page.tsx` | Delete or redirect |
| P2 | `src/app/onboard/` step 3 | Add inline validation |
| P3 | `src/components/DemoCall.tsx` | Move import to module level |
| P3 | `src/app/api/demo/start/route.ts` | Persistent rate limiter |
