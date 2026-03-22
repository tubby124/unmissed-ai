# Tour Library Decision — RESOLVED

**Date:** 2026-03-22
**Decision:** **driver.js** for tooltip highlights + **custom React checklist** for persistent progress

---

## Why NOT a single all-in-one library

Two independent research docs produced different recommendations:
- `s12-tour1-onboarding-library-research.md` → driver.js (5KB, zero deps, 25K stars)
- `s12-tour1-onboarding-tour-research.md` → NextStepjs (12KB, purpose-built for Next.js)

Both agreed on the key finding: **the checklist + empty states do more heavy lifting than the tour itself.** The 2025-2026 trend is AWAY from modal overlay tours and TOWARD contextual empty states + progressive checklists.

## Decision: Hybrid approach

| Layer | Tool | Why |
|-------|------|-----|
| **Tooltip highlighting** | driver.js (5KB) | Smallest bundle, zero deps, battle-tested (25K stars), vanilla JS = no React version coupling. SSR-safe in useEffect. |
| **Persistent checklist** | Custom React component | Already have `OnboardingChecklist.tsx` (166 lines). Enhance it — don't replace. Supabase persistence via `client_users.onboarding_state`. |
| **Empty states** | Custom React components | Per-page contextual CTAs. No library needed. |
| **Cross-page routing** | Not needed | Tour is on ONE page (dashboard/calls). Checklist handles cross-page activation. |

## Why driver.js over NextStepjs

| Factor | driver.js | NextStepjs |
|--------|-----------|------------|
| Bundle size | 5 KB | 12 KB + motion dep |
| Community | 25K stars, 394K/wk | 972 stars, 14K/wk |
| Maintenance risk | 1 maintainer + large community | 1 maintainer, smaller community |
| Next.js update breaks it? | Vanilla JS — immune | Tightly coupled — vulnerable |
| Cross-page routing | Manual (we don't need it) | Built-in (overhead we don't need) |
| React 19 | N/A (vanilla JS) | Supported but less battle-tested |

**The deciding factor:** Our tour is 4 steps on a single page. We don't need cross-page routing. driver.js does exactly what we need (highlight elements, show tooltips, backdrop overlay) at 1/3 the weight with 25x the community.

## What we build custom (not library)

1. **Enhanced OnboardingChecklist** — expand from 3 steps to 5-6 trial-aware steps
2. **TourCard component** — dark-themed tooltip card matching our design system
3. **Persistence layer** — `client_users.onboarding_state` jsonb column
4. **Empty state components** — per-section contextual CTAs
5. **Tour trigger logic** — first-login detection, dismiss tracking, re-launch from help menu

## Installation

```bash
npm install driver.js
```

One package. 5 KB. MIT. Done.
