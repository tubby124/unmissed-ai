---
type: decision
status: decided
date: 2026-03-31
tags: [dashboard, layout, phase6-wave2]
related: [[Architecture/Phase6-Wave2-Dashboard-Matrix]], [[Tracker/D278]], [[Decisions/Dashboard-Tab-Naming]]
---

# Decision: Overview Page — 5 Tiers, Not 8

## Context
Initial planning proposed 8 tiers on the Overview. Sonar Pro validation (2026-03-31) flagged:
- 8 tiers = too much vertical scroll, "frankendashboard" risk
- Capabilities checklist in top-left violates F-pattern (config ≠ monitoring)
- 15+ expandable sections = cognitive overload
- Top SaaS products cap at 3-5 tiers on main page

## Decision
Cut to 5 tiers. Move configuration-heavy sections to their dedicated pages.

## Final Layout

### Tier 1 — Hero (3-col, above fold)
- **Left:** Call stats (calls this month, HOT leads, time saved, last call) + Readiness pills
- **Center:** Talk to Agent orb (WebRTC test call) + try-asking prompts
- **Right:** Today's Update (inline edit) + minutes bar + agent name/status + notification status

### Tier 2 — Agent Identity (full width, compact)
- One-line: agent name, personality, voice. "Change voice" dropdown trigger.
- Setup progress ring (shows only if < 100%)

### Tier 3 — Call Log (full width)
- Rich cards: HOT/WARM badges, topic tags, action items, sentiment
- Condensed filter bar: All / HOT / WARM / More
- Inline expand per call (summary, fields, "add to agent")
- "View all calls →" links to Calls & Leads

### Tier 4 — Unanswered Questions (full width)
- Top 5 HOT questions with frequency
- Inline answer flow (KB suggestion + AI generate + save)
- "View all" links to Knowledge page

### Tier 5 — Quick Config (2x2 grid)
- Call Routing + SMS | Knowledge Base sources
- Bookings calendar | Plan + Upgrade CTA

## What was CUT (stays on dedicated pages)
| Component | Stays on | Reason |
|---|---|---|
| Business Hours editor | Settings > Hours | Low-frequency, once-set |
| Business Facts list | Knowledge page | Already editable there |
| Google Listing | Knowledge page | Connect-once |
| Ask Your Agent | Knowledge page | Low daily use |
| Capabilities full checklist | Settings | Config, not monitoring — readiness pills are the overview summary |

## Key Decisions Locked
- Tab name: **Overview** (not Agent Brain)
- Voice picker: dropdown with preview, inline on Tier 2
- Call log: condensed filters, rich cards, inline expand
- Mobile priority: Orb first → Stats → Readiness
- Trial vs Paid: same layout, empty states replace data

## Sonar Research
- Validated 2026-03-31 via Perplexity Sonar Pro (3 queries)
- F-pattern: top-left = North Star metric, not config
- Progressive disclosure caps at 2-3 levels
- Role-based views > universal 8-tier gauntlet
