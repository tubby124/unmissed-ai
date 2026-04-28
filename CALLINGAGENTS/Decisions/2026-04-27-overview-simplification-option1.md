---
type: decision
status: pending-implementation
tags: [overview, dashboard, simplification, option-1, capabilities-card-deprecation]
related: [[Dashboard Architecture]], [[Phase6-Wave2-Layout-Refactor]], [[Overview-5-Tier-Layout]], [[Dashboard-No-Redesign]]
updated: 2026-04-27
---

# Overview Simplification — Option 1 chosen (2026-04-27)

## Decision
Ship Option 1 (Collapse) for the client Overview page (`UnifiedHomeSection.tsx`). Reduces visible surfaces from **19 → 9** by killing redundant components and consolidating "what's next" signaling into a single readiness band.

## Why
The post-Wave 2 Overview (shipped 2026-04-24, [[2026-04-26-overview-2col-quickadd-beside-orb]]) renders 19 vertical surfaces on first paint. Hasan flagged the page as "very messy" — too much vertical scroll, too many overlapping prompts saying "what to do next." Specifically, **four surfaces** all answer the same question:

1. 8-cell nudge grid
2. QuickConfigStrip (8 capability pills)
3. Setup Progress band
4. AgentReadinessRow

Plus **two** surfaces show the same capability state:

1. Chip pills inside `AgentIdentityCard` (Greeting / SMS / Telegram / IVR / Voicemail / Booking / Transfer / Today)
2. `CapabilitiesCard` ("What your agent can do right now" — Knowledge / Hours / Booking / SMS / Transfer / Website)

## Source-of-truth resolution
- **Chip pills inside `AgentIdentityCard` are the single source of truth for capability state.**
- `CapabilitiesCard.tsx` is deprecated. Delete on ship.
- Why pills win: they live where the user already looks (top of page, beside agent identity), they're click-to-edit, and they include Telegram + IVR + Voicemail + Today's update which `CapabilitiesCard` never showed.

## What ships in Option 1

**Delete:**
- `src/components/dashboard/CapabilitiesCard.tsx`
- `src/components/dashboard/home/QuickConfigStrip.tsx`
- `src/components/dashboard/home/AgentRoutesOnCard.tsx`
- `nudgeItems` block in `UnifiedHomeSection.tsx`
- `setupPct` band in `UnifiedHomeSection.tsx`

**Merge into single `AgentReadinessRow`:**
- `PendingReviewTile` rows
- `UnansweredQuestionsTile` rows
- existing `AgentReadinessRow` dimensions (Hours / Routing / Services / FAQs / Calendar / Knowledge)

**Add to `AgentIdentityCard` pill grid:**
- Website chip (links to scrape modal)
- Google Business Profile chip (links to GBP modal)

**Keep unchanged:**
- `AgentIdentityCard` (top — identity + 10 chips in 2-col layout)
- `TestCallCard` (orb)
- `KnowledgeQuickAddCard` (Upload · Scrape · AI Compile · Browse)
- `AgentKnowsCard` (Facts · FAQs · Services · KB chunks tiles)
- `OverviewCallLog`
- `BillingTile` + upgrade CTA

## Pricing tiers (corrected 2026-04-27, minutes corrected end-of-session)
Two tiers only. The `$29/mo` Lite tier is being retired.

| Plan | Price | Minutes | Includes |
|------|-------|---------|----------|
| Solo | $49/mo | **100 min/mo** | Voice agent · voicemail · SMS follow-up · Telegram alerts |
| AI Receptionist | $119/mo | **200 min/mo** | Everything in Solo + Booking · Live transfer · Knowledge · Triage |

Add-on minutes: $0.15/min over plan limit.

**Important:** The differentiator between tiers is **features**, not minute volume. AI Receptionist is only +100 min over Solo — but unlocks all the high-value capabilities (booking, transfer, knowledge, triage). Pricing logic is feature-gated, not consumption-gated.

This changes:
- Landing page pricing display (currently shows 2 tiers per [[Refactor-phase-tracker]] D379, but the lower tier label/price may need a sweep)
- Stripe products config — verify both tiers exist in Stripe
- `BillingTile.tsx` copy + the upgrade CTA modal in mockup

## Mockup
Static HTML preview at `dashboard-mockup.html` in repo root. Shows 4 directional views:
1. **Current (19 surfaces)** — annotated with "REDUNDANT" badge on `CapabilitiesCard`
2. **Option 1 — Collapse (recommended, default)** — what we're shipping
3. Option 2 — Drawer (5 summary tiles → side sheets) — rejected, too much hiding
4. Option 3 — Phase-based — rejected, additional complexity not worth payoff for now

Every editable element in Option 1 opens a modal showing the actual production form fields, DB column, and API endpoint that would handle the save.

## Estimated effort
4–6 hours of code. No new APIs needed — every modal in the mockup maps to an existing route:
- `/api/dashboard/variables` (agent name, business, callback, greeting)
- `/api/dashboard/voices/[id]/preview` (voice picker preview audio)
- `/api/dashboard/scrape-website` (website chip)
- `/api/onboard/places-details` (GBP chip — already wired per [[Refactor-phase-tracker]] D291)
- `/api/dashboard/knowledge/compile/apply` (AI compile)
- Stripe checkout (upgrade)

## Risk / open questions
- Need to confirm: does the trial-mode pill render correctly when paid clients view the page? (`StatsHeroCard` already handles both — should carry over cleanly.)
- Does removing `CapabilitiesCard` break any tracker D-items that reference it? Check D262 (capability badges → modal) — partially obsolete now, since pills already are click-to-modal in AgentIdentityCard.
- Pricing tier change ($29 → $49 minimum) — does Stripe webhook handler still recognize legacy Lite plan IDs for existing trial users?

## Next step
Hasan green-lights → I draft PR against [tubby124/unmissed-ai](https://github.com/tubby124/unmissed-ai).

## Reviewer instructions (for whoever Hasan shares the mockup with)
1. Open `dashboard-mockup.html` (or the Netlify preview URL)
2. Default view = Option 1 (recommended)
3. Click anything labeled or chip-shaped — every modal opens with the real production form
4. Compare against current view via the top tab switcher
5. Feedback expected: layout / wording / which fields to surface — not "is this technically possible" (everything in Option 1 maps to existing production code)
