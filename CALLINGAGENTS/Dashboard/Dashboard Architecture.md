---
type: dashboard
tags: [dashboard, frontend, architecture]
related: [Dashboard/Settings Cards, Product/Onboarding Flow]
updated: 2026-03-31
---

# Dashboard Architecture

## Pages
```
/dashboard                → UnifiedHomeSection (home)
/dashboard/calls          → call log, lead status, callback tracking
/dashboard/knowledge      → knowledge base, scrape, AI compiler
/dashboard/settings       → AgentTab (19 settings cards)
/dashboard/billing        → plan, usage, upgrade
/admin                    → God Mode (admin only)
```

## Home Page (UnifiedHomeSection)
Shows:
- Agent health / last sync status
- Minutes used this month (% bar)
- Recent calls with lead tier (HOT/WARM/COLD)
- Capabilities grid (feature badges)
- Quick-action CTAs

**Open gaps:**
- D223 — agent health indicator (last_agent_sync_status column exists, not surfaced)
- D218 — minutes usage warning banner at 75%/90%
- D228 — AgentReadinessRow.tsx exists but not rendered anywhere
- D229 — "Call back now" button on HOT/WARM call rows

## Calls Page (/dashboard/calls)
Shows call log. Lead status (HOT/WARM/COLD/JUNK) from AI classification.

**Open gaps:**
- D175 — empty state CTA (no calls yet → forwarding guide)
- D220 — Lead queue / callback tracking view (HOT/WARM grouped, "mark called back")
- D224 — CSV export

## Knowledge Page (/dashboard/knowledge)
Shows: knowledge chunks, scrape status, AI compiler tab.

**Untracked routes not wired:**
- D227 — knowledge/conflicts, knowledge/docs, preview-question all built but not connected to UI

## Trial vs Paid Split (D189 — open)
Trial dashboard hides: IVR, SMS toggle, Telegram, advanced features.
**Problem:** creates confusion — user doesn't know what they'd get on paid plan.
**Fix:** one view, locked features show "upgrade to unlock" preview, not blank.

## Connections
- → [[Dashboard/Settings Cards]] (settings tab)
- → [[Tracker/D189]] (trial/paid split — HIGH priority)
- → [[Tracker/D190]] (feature unlock CTAs)
- → [[Tracker/D220]] (lead queue)
- → [[Tracker/D228]] (AgentReadinessRow not wired)
