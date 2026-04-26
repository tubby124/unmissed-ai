---
type: decision
status: shipped
date: 2026-04-26
tags: [overview, dashboard, ui, phase-2-v3.5]
related:
  - "[[Overview-5-Tier-Layout]]"
  - "[[Dashboard-No-Redesign]]"
---

# Overview — 2-col Layout + Quick Add beside Orb

## Decision
Restructure the client Overview page hero from 3-col to 2-col, with a new
**Knowledge Quick Add** card sitting beside the Test Call orb. CapabilitiesCard
+ Stats/CallMe move into a second 2-col band immediately below.

## Why
- Mockup pass at `~/.claude/plans/pulling-okay-so-i-m-squishy-hamming.html` proposed
  v3.5 layout with Quick Add adjacent to orb. Owner approved.
- 3-col hero was visually crowded on mid-width screens; CapabilitiesCard kept getting
  squeezed.
- Owner wanted the page to feel less like a 1-col stack of full-width sections.

## What changed
1. **New component:** `src/components/dashboard/home/KnowledgeQuickAddCard.tsx`
   - 4 link buttons: Upload, Scrape, AI Compile, Browse
   - Each links to `/dashboard/knowledge?quickAdd={action}`
   - No drawer state of its own — pure link card

2. **Restructured:** `src/components/dashboard/home/UnifiedHomeSection.tsx`
   - Hero band: `md:grid-cols-3` → `md:grid-cols-2`
     - Left col: TestCallCard + PendingReviewTile + UnansweredQuestionsTile
     - Right col: KnowledgeQuickAddCard
   - New band right below: `md:grid-cols-2`
     - Left col: CapabilitiesCard
     - Right col: CallMe + TrialModeSwitcher + StatsHeroCard

3. **Deep link handler:** `src/app/dashboard/knowledge/KnowledgePageView.tsx`
   - useEffect reads `?quickAdd=` query, calls `setDrawerContent` + `setDrawerOpen`
   - Strips param via `router.replace` so reload doesn't re-trigger

## Why link out instead of mounting drawer on Overview
Mounting `KnowledgeDrawer` on Overview would require pulling full `ClientConfig`
(facts, qa, injected_note, context_data, knowledge_backend, timezone) into
`HomeData`. That widens the home API contract for a feature that already lives
on the Knowledge page. Link-out keeps Overview lean and reuses existing drawer state.

## Anti-patterns avoided
- **Did NOT** duplicate the Quick Add panel JSX between Overview and Knowledge — Overview gets a thin link-card, Knowledge keeps the full panel + drawer mount.
- **Did NOT** widen `/api/dashboard/home` response — no new fields needed.
- **Did NOT** redeploy any voice agent (this is pure client-side UI).

## Files changed
- ✨ NEW: [src/components/dashboard/home/KnowledgeQuickAddCard.tsx](../../src/components/dashboard/home/KnowledgeQuickAddCard.tsx)
- ✏️ [src/components/dashboard/home/UnifiedHomeSection.tsx](../../src/components/dashboard/home/UnifiedHomeSection.tsx)
- ✏️ [src/app/dashboard/knowledge/KnowledgePageView.tsx](../../src/app/dashboard/knowledge/KnowledgePageView.tsx)
- ✏️ [src/components/dashboard/home/AgentIdentityCard.tsx](../../src/components/dashboard/home/AgentIdentityCard.tsx) — internal 2-col grid

## Follow-up — AgentIdentityCard 2-col internal layout
Same session, same theme. AgentIdentityCard was rendering 7 stacked full-width rows
on wide screens — wasted horizontal space. Restructured per `/ui-ux-pro-max` rules:

**New internal layout (md+):**
- Row 1 grid: [Agent name | Business name]
- Row 2 grid: [Callback contact | Voice button]
- Voice expanded panel: full-width when open (slides in below grid)
- Greeting: full-width (needs the room — multi-line)
- After-call SMS: full-width
- Today's update: full-width collapsible

**Mobile:** stacks vertically as before — `grid-cols-1 md:grid-cols-2`.

**Refactor wins:**
- Extracted `renderField()` helper to dedupe the 3 short-field render blocks (~50 lines × 3 → 1 helper)
- Greeting now uses the same helper with `multiline: true` option
- Removed dead `IDENTITY_FIELDS` constant
- All save/PATCH paths unchanged — variable keys (AGENT_NAME, BUSINESS_NAME, CLOSE_PERSON, GREETING_LINE) and endpoints (`/api/dashboard/variables`, `/api/dashboard/settings`) untouched
- Borders honored: vertical divider between cols (md+), horizontal divider between rows
- Voice button keeps `aria-expanded` + accessible label (per touch-interaction rules)

**Verification:** `npx tsc --noEmit` clean (exit 0).

## Verification
- `npx tsc --noEmit` clean (exit 0)
- Deep links tested via URL: `/dashboard/knowledge?quickAdd=upload` opens upload drawer

## Mockup parity
Static HTML mockup at `~/.claude/plans/pulling-okay-so-i-m-squishy-hamming.html` is the
reference design — kept for future iteration.
